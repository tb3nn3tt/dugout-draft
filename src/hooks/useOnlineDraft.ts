import { useCallback } from 'react';
import { useOnlineGame } from '../contexts/OnlineGameContext';
import { db } from '../lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import {
  rebuildCardPool, getNextPicker, getDraftRoundType,
  shuffleArray, hydratePlayerIds, buildAllPlayersMap,
} from '../utils/draftLogic';
import { TOTAL_ROSTER_SIZE } from '../types';

export function useOnlineDraft() {
  const { phaseData, isMyTurn, myRole, match, updatePhaseData, turnTimer, opponentUsername } = useOnlineGame();

  const pickNumber = (phaseData.pickNumber as number) || 1;
  const roundType = getDraftRoundType(pickNumber);

  const pickPlayer = useCallback(async (playerId: string) => {
    if (!isMyTurn || !db || !match || !myRole) return;

    const matchRef = doc(db, 'matches', match.id);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pd = (data.phase_data || {}) as Record<string, unknown>;

      const cardPool = (pd.cardPool as string[]) || [];
      const pickedFromPool = (pd.pickedFromPool as string[]) || [];
      const pn = (pd.pickNumber as number) || 1;
      const currentPick = pd.currentPick as string;

      // Validate
      if (currentPick !== myRole) return;
      if (!cardPool.includes(playerId)) return;
      if (pickedFromPool.includes(playerId)) return;

      const rosterKey = myRole === 'player1' ? 'player1Roster' : 'player2Roster';
      const currentRoster = (pd[rosterKey] as string[]) || [];

      const newRoster = [...currentRoster, playerId];
      const newPickedFromPool = [...pickedFromPool, playerId];

      let newPickNumber = pn + 1;
      let nextPicker = getNextPicker(currentPick as 'player1' | 'player2', newPickNumber);

      const totalPicks = TOTAL_ROSTER_SIZE * 2;
      const isSecondPickOfRound = (newPickNumber % 2 === 0);

      let newCardPool = cardPool;
      let newPickedList = newPickedFromPool;

      if (!isSecondPickOfRound) {
        // First pick of new round — Player 1 will generate new pool via useEffect
        newCardPool = [];
        newPickedList = [];
      }

      const updates: Record<string, unknown> = {
        [rosterKey]: newRoster,
        pickNumber: newPickNumber,
        currentPick: nextPicker,
        cardPool: newCardPool,
        pickedFromPool: newPickedList,
        lastPickedPlayerId: playerId,
      };

      if (newPickNumber > totalPicks) {
        transaction.update(matchRef, {
          phase_data: { ...pd, ...updates },
          status: 'team_setup',
        });
      } else {
        transaction.update(matchRef, {
          phase_data: { ...pd, ...updates },
        });
      }
    });
  }, [isMyTurn, db, match, myRole]);

  // Generate card pool (called by Player 1 when pool is empty)
  const generateAndWriteCardPool = useCallback(async () => {
    if (!db || !match || myRole !== 'player1') return;

    const matchRef = doc(db, 'matches', match.id);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pd = (data.phase_data || {}) as Record<string, unknown>;

      const pn = (pd.pickNumber as number) || 1;
      const player1Roster = (pd.player1Roster as string[]) || [];
      const player2Roster = (pd.player2Roster as string[]) || [];
      const currentPick = (pd.currentPick as string) || 'player1';

      const currentRoundType = getDraftRoundType(pn);

      // If auction round, generate elite player + auction state instead of card pool
      if (currentRoundType === 'auction') {
        const draftedIds = new Set([...player1Roster, ...player2Roster]);
        const allPlayersMap = buildAllPlayersMap();
        const available = Array.from(allPlayersMap.values()).filter(p => !draftedIds.has(p.id));

        // Find elite player (90+ overall, or highest available)
        const eliteCandidates = available.filter(p => p.overall >= 90);
        let elitePlayer;
        if (eliteCandidates.length > 0) {
          elitePlayer = eliteCandidates[Math.floor(Math.random() * eliteCandidates.length)];
        } else {
          const sorted = [...available].sort((a, b) => b.overall - a.overall);
          elitePlayer = sorted[0];
        }
        if (!elitePlayer) return;

        transaction.update(matchRef, {
          phase_data: {
            ...pd,
            cardPool: [],
            pickedFromPool: [],
            auctionState: {
              elitePlayerId: elitePlayer.id,
              phase: 'offer_p1',
              player1OfferId: null,
              player2OfferId: null,
              winnerId: null,
            },
          },
        });
        return;
      }

      // Get all available players (all minus drafted)
      const draftedIds = new Set([...player1Roster, ...player2Roster]);
      const allPlayersMap = buildAllPlayersMap();
      const available = Array.from(allPlayersMap.values()).filter(p => !draftedIds.has(p.id));

      // Hydrate rosters for position-aware pool building
      const team1Roster = hydratePlayerIds(player1Roster);
      const team2Roster = hydratePlayerIds(player2Roster);

      const newPool = rebuildCardPool(
        available, 4, team1Roster, team2Roster,
        currentPick as 'player1' | 'player2', pn
      );

      transaction.update(matchRef, {
        phase_data: {
          ...pd,
          cardPool: newPool.map(p => p.id),
          pickedFromPool: [],
        },
      });
    });
  }, [db, match, myRole]);

  // Submit auction offer (each player offers one of their roster players)
  const submitAuctionOffer = useCallback(async (offeredPlayerId: string) => {
    if (!db || !match || !myRole) return;

    const matchRef = doc(db, 'matches', match.id);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pd = (data.phase_data || {}) as Record<string, unknown>;
      const auctionState = pd.auctionState as Record<string, unknown> | null;
      if (!auctionState) return;

      const phase = auctionState.phase as string;

      if (myRole === 'player1' && phase === 'offer_p1') {
        transaction.update(matchRef, {
          phase_data: {
            ...pd,
            auctionState: {
              ...auctionState,
              player1OfferId: offeredPlayerId,
              phase: 'offer_p2',
            },
          },
        });
      } else if (myRole === 'player2' && phase === 'offer_p2') {
        // Player 2 submits — determine winner
        const allPlayersMap = buildAllPlayersMap();
        const p1OfferId = auctionState.player1OfferId as string;
        const p1Offer = allPlayersMap.get(p1OfferId);
        const p2Offer = allPlayersMap.get(offeredPlayerId);

        let winner: 'player1' | 'player2';
        if (p1Offer && p2Offer) {
          if (p1Offer.overall > p2Offer.overall) {
            winner = 'player1';
          } else if (p2Offer.overall > p1Offer.overall) {
            winner = 'player2';
          } else {
            winner = Math.random() < 0.5 ? 'player1' : 'player2';
          }
        } else {
          winner = 'player1';
        }

        transaction.update(matchRef, {
          phase_data: {
            ...pd,
            auctionState: {
              ...auctionState,
              player2OfferId: offeredPlayerId,
              phase: 'reveal',
              winnerId: winner,
            },
          },
        });
      }
    });
  }, [db, match, myRole]);

  // Resolve auction: winner swaps offered player for elite, advance picks
  const resolveAuction = useCallback(async () => {
    if (!db || !match || !myRole) return;

    const matchRef = doc(db, 'matches', match.id);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pd = (data.phase_data || {}) as Record<string, unknown>;
      const auctionState = pd.auctionState as Record<string, unknown> | null;
      if (!auctionState || auctionState.phase !== 'reveal') return;

      const winner = auctionState.winnerId as 'player1' | 'player2';
      const elitePlayerId = auctionState.elitePlayerId as string;
      const winnerOfferId = winner === 'player1'
        ? auctionState.player1OfferId as string
        : auctionState.player2OfferId as string;

      const winnerRosterKey = winner === 'player1' ? 'player1Roster' : 'player2Roster';
      const winnerRoster = (pd[winnerRosterKey] as string[]) || [];

      // Winner: remove offered player, add elite player
      const newWinnerRoster = winnerRoster.filter(id => id !== winnerOfferId);
      newWinnerRoster.push(elitePlayerId);

      // Advance by 2 picks (auction counts as a round)
      const pn = (pd.pickNumber as number) || 1;
      const newPickNumber = pn + 2;
      const currentPick = (pd.currentPick as string) || 'player1';
      const nextPicker = getNextPicker(currentPick as 'player1' | 'player2', newPickNumber);

      const totalPicks = TOTAL_ROSTER_SIZE * 2;

      const updates: Record<string, unknown> = {
        [winnerRosterKey]: newWinnerRoster,
        pickNumber: newPickNumber,
        currentPick: nextPicker,
        cardPool: [],
        pickedFromPool: [],
        auctionState: null,
      };

      if (newPickNumber > totalPicks) {
        transaction.update(matchRef, {
          phase_data: { ...pd, ...updates },
          status: 'team_setup',
        });
      } else {
        transaction.update(matchRef, {
          phase_data: { ...pd, ...updates },
        });
      }
    });
  }, [db, match, myRole]);

  // Initialize draft (called once by Player 1 when match starts)
  const initializeDraft = useCallback(async () => {
    if (!db || !match || myRole !== 'player1') return;

    const allPlayersPool = Array.from(buildAllPlayersMap().values());
    const shuffled = shuffleArray(allPlayersPool);
    const initialPool = rebuildCardPool(shuffled, 4, [], [], 'player1', 1);

    await updatePhaseData({
      currentPick: 'player1',
      pickNumber: 1,
      cardPool: initialPool.map(p => p.id),
      player1Roster: [],
      player2Roster: [],
      pickedFromPool: [],
    });
  }, [db, match, myRole, updatePhaseData]);

  return {
    cardPool: (phaseData.cardPool as string[]) || [],
    currentPick: phaseData.currentPick as string,
    pickNumber,
    roundType,
    myRoster: myRole === 'player1'
      ? (phaseData.player1Roster as string[]) || []
      : (phaseData.player2Roster as string[]) || [],
    opponentRoster: myRole === 'player1'
      ? (phaseData.player2Roster as string[]) || []
      : (phaseData.player1Roster as string[]) || [],
    opponentRosterSize: myRole === 'player1'
      ? ((phaseData.player2Roster as string[]) || []).length
      : ((phaseData.player1Roster as string[]) || []).length,
    isMyTurn,
    myRole,
    turnTimer,
    opponentUsername,
    pickedFromPool: (phaseData.pickedFromPool as string[]) || [],
    lastPickedPlayerId: phaseData.lastPickedPlayerId as string | undefined,
    auctionState: phaseData.auctionState as {
      elitePlayerId: string;
      phase: 'offer_p1' | 'offer_p2' | 'reveal' | 'done';
      player1OfferId: string | null;
      player2OfferId: string | null;
      winnerId: 'player1' | 'player2' | null;
    } | null,
    pickPlayer,
    generateAndWriteCardPool,
    initializeDraft,
    submitAuctionOffer,
    resolveAuction,
  };
}
