import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Player, DraftedTeam, GamePhase, SeriesState, GameState, TOTAL_ROSTER_SIZE, QUICK_ROSTER_SIZE, GameMode, GameBoxScore, TeamBoxScore, PowerCardState, PlayLogEntry, AuctionState } from '../types';
import { initializePowerCardState } from '../utils/powerCards';
import { generateTeamNames, generateCPUName } from '../utils/teamNames';
import {
  shuffleArray,
  getNextPicker,
  getPlayerTier,
  getCurrentRoundTier,
  getDraftRoundType,
  getDraftRoundTypeQuick,
  rebuildCardPool,
  buildAllPlayersMap,
  getRemainingNeedCount,
  getNeededPositions,
  playerFillsPosition,
  Tier,
} from '../utils/draftLogic';

interface AppState {
  phase: GamePhase;
  availablePlayers: Player[];
  cardPool: Player[];
  currentPick: 'player1' | 'player2';
  pickNumber: number;
  team1: DraftedTeam;
  team2: DraftedTeam;
  series: SeriesState | null;
  currentGame: GameState | null;
  playLog: PlayLogEntry[];
  powerCards: PowerCardState;
  pickedFromPool: string[];
  auctionState: AuctionState | null;
  mysteryRevealPlayer: Player | null;
  isCPU: boolean;
  gameMode: GameMode;
}

type Action =
  | { type: 'START_DRAFT'; isCPU?: boolean; team1Name?: string; team2Name?: string }
  | { type: 'START_DRAFT_VS_CPU'; team1Name?: string }
  | { type: 'START_QUICK_PLAY'; isCPU?: boolean; team1Name?: string; team2Name?: string }
  | { type: 'PICK_PLAYER'; playerId: string }
  | { type: 'SET_BATTING_ORDER'; team: 'player1' | 'player2'; order: Player[] }
  | { type: 'SET_ROTATION'; team: 'player1' | 'player2'; rotation: Player[] }
  | { type: 'SET_CLOSER'; team: 'player1' | 'player2'; closer: Player }
  | { type: 'SET_BULLPEN'; team: 'player1' | 'player2'; bullpen: Player[] }
  | { type: 'FINISH_TEAM_SETUP' }
  | { type: 'START_SERIES' }
  | { type: 'START_GAME'; gameNumber: number }
  | { type: 'UPDATE_GAME_STATE'; state: Partial<GameState> }
  | { type: 'END_GAME'; awayScore: number; homeScore: number; boxScore?: GameBoxScore; lineScore?: number[][] }
  | { type: 'ADD_PLAY_LOG'; entry: PlayLogEntry }
  | { type: 'CLEAR_PLAY_LOG' }
  | { type: 'RESET_GAME' }
  // Power Card Actions
  | { type: 'USE_POWER_CARD'; cardId: string; player: 'player1' | 'player2' }
  | { type: 'SHUFFLE_DECK' }
  | { type: 'REVERSE_ORDER' }
  | { type: 'RETURN_PLAYER'; player: 'player1' | 'player2' }
  | { type: 'STEAL_PLAYER'; fromPlayer: 'player1' | 'player2'; playerId: string }
  | { type: 'SKIP_TURN'; targetPlayer: 'player1' | 'player2' }
  | { type: 'DOUBLE_PICK'; player: 'player1' | 'player2' }
  | { type: 'CLEAR_DOUBLE_PICK' }
  | { type: 'UPGRADE_TIER' }
  | { type: 'TRADE_PLAYERS'; player1PlayerId: string; player2PlayerId: string }
  | { type: 'SET_PEEK_POOL'; pool: Player[] | null }
  | { type: 'GENERATE_PEEK_POOL' }
  | { type: 'SABOTAGE' }
  | { type: 'IMMUNITY'; player: 'player1' | 'player2' }
  // Auction Actions
  | { type: 'START_AUCTION' }
  | { type: 'PLACE_BID'; player: 'player1' | 'player2'; bid: Player }
  | { type: 'RESOLVE_AUCTION' }
  | { type: 'AUCTION_CONSOLATION_PICK'; playerId: string }
  | { type: 'DISMISS_MYSTERY_REVEAL' }
  | { type: 'DISMISS_AUCTION' }
  // Multiplayer Actions
  | { type: 'SYNC_MULTIPLAYER_STATE'; availablePlayers?: Player[]; cardPool?: Player[]; pickNumber?: number; currentPick?: 'player1' | 'player2'; pickedFromPool?: string[]; team1Roster?: Player[]; team2Roster?: Player[] }
  | { type: 'FORCE_PHASE'; phase: GamePhase };

function createInitialTeam(owner: 'player1' | 'player2', name: string): DraftedTeam {
  return {
    owner,
    name,
    roster: [],
    battingOrder: [],
    rotation: [],
    closer: null,
    bullpen: [],
  };
}

// Use ALL players (regular + special sets) for the draft pool
const allPlayersPool: Player[] = Array.from(buildAllPlayersMap().values());

function createEmptyTeamBoxScore(battingOrder: Player[], startingPitcher: Player): TeamBoxScore {
  return {
    batters: battingOrder.map(p => ({
      playerId: p.id,
      name: p.name,
      position: p.positions[0],
      ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0,
    })),
    pitchers: [{
      playerId: startingPitcher.id,
      name: startingPitcher.name,
      ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0,
    }],
    totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
  };
}

function createEmptyBoxScore(
  awayBattingOrder: Player[],
  homeBattingOrder: Player[],
  awayPitcher: Player,
  homePitcher: Player
): GameBoxScore {
  return {
    away: createEmptyTeamBoxScore(awayBattingOrder, awayPitcher),
    home: createEmptyTeamBoxScore(homeBattingOrder, homePitcher),
    lineScore: [[], []],
  };
}

function createInitialState(): AppState {
  const shuffled = shuffleArray(allPlayersPool);
  // Build initial card pool for Diamond round (pick 1)
  const initialPool = rebuildCardPool(shuffled, 4, [], [], 'player1', 1);
  const [name1, name2] = generateTeamNames();
  return {
    phase: 'start',
    availablePlayers: shuffled,
    cardPool: initialPool,
    currentPick: 'player1',
    pickNumber: 1,
    team1: createInitialTeam('player1', name1),
    team2: createInitialTeam('player2', name2),
    series: null,
    currentGame: null,
    playLog: [],
    powerCards: initializePowerCardState(),
    pickedFromPool: [],
    auctionState: null,
    mysteryRevealPlayer: null,
    isCPU: false,
    gameMode: 'standard',
  };
}

function gameReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'START_DRAFT': {
      const shuffled = shuffleArray(allPlayersPool);
      const initialPool = rebuildCardPool(shuffled, 4, [], [], 'player1', 1);
      const [draftName1, draftName2] = generateTeamNames();
      return {
        ...state,
        phase: 'draft',
        availablePlayers: shuffled,
        cardPool: initialPool,
        currentPick: 'player1',
        pickNumber: 1,
        team1: createInitialTeam('player1', action.team1Name || draftName1),
        team2: createInitialTeam('player2', action.team2Name || draftName2),
        powerCards: initializePowerCardState(),
        pickedFromPool: [],
        auctionState: null,
        mysteryRevealPlayer: null,
        isCPU: action.isCPU ?? false,
        gameMode: 'standard',
      };
    }

    case 'START_DRAFT_VS_CPU': {
      const shuffled = shuffleArray(allPlayersPool);
      const initialPool = rebuildCardPool(shuffled, 4, [], [], 'player1', 1);
      const [cpuDraftName1] = generateTeamNames();
      const cpuName = generateCPUName();
      return {
        ...state,
        phase: 'draft',
        availablePlayers: shuffled,
        cardPool: initialPool,
        currentPick: 'player1',
        pickNumber: 1,
        team1: createInitialTeam('player1', action.team1Name || cpuDraftName1),
        team2: createInitialTeam('player2', cpuName),
        powerCards: initializePowerCardState(),
        pickedFromPool: [],
        auctionState: null,
        mysteryRevealPlayer: null,
        isCPU: true,
        gameMode: 'standard',
      };
    }

    case 'START_QUICK_PLAY': {
      const shuffled = shuffleArray(allPlayersPool);
      const initialPool = rebuildCardPool(shuffled, 4, [], [], 'player1', 1, 'quick');
      const [qpName1, qpName2] = generateTeamNames();
      const qpTeam2Name = action.team2Name || (action.isCPU === false ? qpName2 : generateCPUName());
      return {
        ...state,
        phase: 'draft',
        availablePlayers: shuffled,
        cardPool: initialPool,
        currentPick: 'player1',
        pickNumber: 1,
        team1: createInitialTeam('player1', action.team1Name || qpName1),
        team2: createInitialTeam('player2', qpTeam2Name),
        powerCards: initializePowerCardState(),
        pickedFromPool: [],
        auctionState: null,
        mysteryRevealPlayer: null,
        isCPU: action.isCPU ?? true,
        gameMode: 'quick',
      };
    }

    case 'PICK_PLAYER': {
      const player = state.cardPool.find(p => p.id === action.playerId);
      if (!player) return state;
      // Don't allow picking a player already taken from this pool
      if (state.pickedFromPool.includes(action.playerId)) return state;

      // If pickForTeam is set (from Swap Turns), add to that team instead
      const pickOwner = state.powerCards.pickForTeam || state.currentPick;
      const team = pickOwner === 'player1' ? 'team1' : 'team2';

      // Block picks that don't fill needs when no slack remains
      const rosterSize = state.gameMode === 'quick' ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;
      const pickingRoster = state[team].roster;
      const remaining = rosterSize - pickingRoster.length;
      const needCount = getRemainingNeedCount(pickingRoster, state.gameMode);
      if (remaining <= needCount) {
        const needs = getNeededPositions(pickingRoster, state.gameMode);
        if (!playerFillsPosition(player, needs)) {
          return state; // Must fill a needed position
        }
      }

      const isMysteryPick = state.gameMode === 'quick'
        ? getDraftRoundTypeQuick(state.pickNumber) === 'mystery'
        : getDraftRoundType(state.pickNumber) === 'mystery';
      // Skip the drumroll reveal for CPU picks — they have their own reveal overlay
      const isCPUPicking = state.isCPU && state.currentPick === 'player2';
      const newRoster = [...state[team].roster, player];
      const newAvailable = state.availablePlayers.filter(p => p.id !== action.playerId);
      const newPickedFromPool = [...state.pickedFromPool, action.playerId];

      // Check if this player has double pick active
      const hasDoublePick = state.powerCards.doublePick === state.currentPick;

      let newPickNumber = state.pickNumber;
      let actualNextPicker = state.currentPick;

      if (hasDoublePick) {
        actualNextPicker = state.currentPick;
      } else {
        newPickNumber = state.pickNumber + 1;
        actualNextPicker = getNextPicker(state.currentPick, newPickNumber);

        if (state.powerCards.skipNextTurn === actualNextPicker) {
          newPickNumber++;
          actualNextPicker = getNextPicker(actualNextPicker, newPickNumber);
        }
      }

      const totalPicks = rosterSize * 2;
      const newTeam1Roster = team === 'team1' ? newRoster : state.team1.roster;
      const newTeam2Roster = team === 'team2' ? newRoster : state.team2.roster;

      // Shared pool logic:
      // Odd pick number = first pick of a new round pair → rebuild 4 fresh cards
      // Even pick number = second pick → keep current pool (show picked card as disabled)
      const isSecondPickOfRound = (newPickNumber % 2 === 0);
      let newCardPool: Player[];
      let newPickedList: string[];

      if (isSecondPickOfRound || hasDoublePick) {
        // Second pick of round or double pick: reuse same pool, grey out picked cards
        newCardPool = state.cardPool;
        newPickedList = newPickedFromPool;
      } else {
        // First pick of new round → fresh pool of 4
        newCardPool = rebuildCardPool(
          newAvailable,
          4,
          newTeam1Roster,
          newTeam2Roster,
          actualNextPicker,
          newPickNumber,
          state.gameMode,
        );
        newPickedList = [];
      }

      // Sabotage: force bronze/common pool for sabotaged player
      let clearSabotage = false;
      if (state.powerCards.sabotageNextPool === actualNextPicker && !isSecondPickOfRound && !hasDoublePick) {
        const roundType = state.gameMode === 'quick' ? getDraftRoundTypeQuick(newPickNumber) : getDraftRoundType(newPickNumber);
        if (roundType === 'normal') {
          const lowTier = newAvailable.filter(p => {
            const t = getPlayerTier(p.overall);
            return t === 'bronze' || t === 'common';
          });
          if (lowTier.length >= 4) {
            const shuffled = shuffleArray(lowTier);
            newCardPool = shuffled.slice(0, 4);
          }
        }
        clearSabotage = true;
      }

      const newPowerCards = {
        ...state.powerCards,
        doublePick: hasDoublePick ? null : state.powerCards.doublePick,
        skipNextTurn: state.powerCards.skipNextTurn === actualNextPicker ? null : state.powerCards.skipNextTurn,
        pickForTeam: null, // Clear after pick
        ...(clearSabotage ? { sabotageNextPool: null } : {}),
      };

      if (newPickNumber > totalPicks) {
        return {
          ...state,
          [team]: { ...state[team], roster: newRoster },
          availablePlayers: newAvailable,
          cardPool: newCardPool,
          phase: 'team-setup',
          pickNumber: newPickNumber,
          powerCards: newPowerCards,
          pickedFromPool: newPickedList,
          auctionState: null,
          mysteryRevealPlayer: null,
        };
      }

      return {
        ...state,
        [team]: { ...state[team], roster: newRoster },
        availablePlayers: newAvailable,
        cardPool: newCardPool,
        currentPick: actualNextPicker,
        pickNumber: newPickNumber,
        powerCards: newPowerCards,
        pickedFromPool: newPickedList,
        mysteryRevealPlayer: (isMysteryPick && !isCPUPicking) ? player : null,
      };
    }

    case 'SET_BATTING_ORDER': {
      const team = action.team === 'player1' ? 'team1' : 'team2';
      return {
        ...state,
        [team]: { ...state[team], battingOrder: action.order },
      };
    }

    case 'SET_ROTATION': {
      const team = action.team === 'player1' ? 'team1' : 'team2';
      return {
        ...state,
        [team]: { ...state[team], rotation: action.rotation },
      };
    }

    case 'SET_CLOSER': {
      const team = action.team === 'player1' ? 'team1' : 'team2';
      return {
        ...state,
        [team]: { ...state[team], closer: action.closer },
      };
    }

    case 'SET_BULLPEN': {
      const team = action.team === 'player1' ? 'team1' : 'team2';
      return {
        ...state,
        [team]: { ...state[team], bullpen: action.bullpen },
      };
    }

    case 'FINISH_TEAM_SETUP': {
      return {
        ...state,
        phase: 'simulation',
      };
    }

    case 'START_SERIES': {
      // Randomly determine home team for games 1, 2, 6, 7
      const homeTeam = Math.random() < 0.5 ? 'player1' : 'player2';
      return {
        ...state,
        series: {
          games: [],
          currentGame: 0,
          homeTeam,
        },
        playLog: [],
      };
    }

    case 'START_GAME': {
      const series = state.series;
      if (!series) return state;

      // Home field: Games 1,2,6,7 at homeTeam, Games 3,4,5 at other team
      const gameNum = action.gameNumber;
      const isHomeGame = [1, 2, 6, 7].includes(gameNum);
      const homeTeam = isHomeGame ? series.homeTeam : (series.homeTeam === 'player1' ? 'player2' : 'player1');

      const homeTeamData = homeTeam === 'player1' ? state.team1 : state.team2;
      const awayTeamData = homeTeam === 'player1' ? state.team2 : state.team1;

      // Get the starting pitcher based on rotation (use modulo of actual rotation size)
      const homeRotSize = homeTeamData.rotation.length || 1;
      const awayRotSize = awayTeamData.rotation.length || 1;
      const homePitcher = homeTeamData.rotation[(gameNum - 1) % homeRotSize];
      const awayPitcher = awayTeamData.rotation[(gameNum - 1) % awayRotSize];

      // Initialize boxscore
      const boxScore = createEmptyBoxScore(
        awayTeamData.battingOrder,
        homeTeamData.battingOrder,
        awayPitcher,
        homePitcher
      );

      return {
        ...state,
        currentGame: {
          inning: 1,
          halfInning: 'top',
          outs: 0,
          runners: [false, false, false],
          score: [0, 0],
          currentBatterIndex: 0,
          currentPitcher: homePitcher, // Top of inning = away team bats, home pitcher pitches
          pitchCount: 0,
          boxScore,
          lineScore: [[], []],
        },
        playLog: [{
          id: `game-${gameNum}-start`,
          description: `Game ${gameNum} - ${awayTeamData.name} @ ${homeTeamData.name}`,
          type: 'inning',
          batterId: '',
          batterName: '',
          inning: 1,
          half: 'top',
          timestamp: Date.now(),
        }],
      };
    }

    case 'UPDATE_GAME_STATE': {
      if (!state.currentGame) return state;
      return {
        ...state,
        currentGame: { ...state.currentGame, ...action.state },
      };
    }

    case 'END_GAME': {
      if (!state.series) return state;

      // Compute actual home team for THIS game (home field alternates in a 7-game series)
      const endGameNum = state.series.games.length + 1;
      const endIsHomeGame = [1, 2, 6, 7].includes(endGameNum);
      const endActualHome = endIsHomeGame
        ? state.series.homeTeam
        : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');

      const winner = action.homeScore > action.awayScore
        ? endActualHome
        : (endActualHome === 'player1' ? 'player2' : 'player1');

      const newGames = [...state.series.games, {
        score: [action.awayScore, action.homeScore] as [number, number],
        winner,
        innings: [],
        boxScore: action.boxScore,
      }];

      return {
        ...state,
        series: { ...state.series, games: newGames, currentGame: newGames.length },
        currentGame: null,
      };
    }

    case 'ADD_PLAY_LOG': {
      return {
        ...state,
        playLog: [...state.playLog, action.entry],
      };
    }

    case 'CLEAR_PLAY_LOG': {
      return {
        ...state,
        playLog: [],
      };
    }

    case 'RESET_GAME': {
      return createInitialState();
    }

    case 'DISMISS_MYSTERY_REVEAL': {
      return { ...state, mysteryRevealPlayer: null };
    }

    case 'DISMISS_AUCTION': {
      return { ...state, auctionState: null };
    }

    // Power Card Actions
    case 'USE_POWER_CARD': {
      const hand = action.player === 'player1' ? state.powerCards.player1Hand : state.powerCards.player2Hand;
      const updatedHand = hand.map(card =>
        card.id === action.cardId ? { ...card, used: true } : card
      );

      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          [action.player === 'player1' ? 'player1Hand' : 'player2Hand']: updatedHand,
          lastUsedTurn: {
            ...state.powerCards.lastUsedTurn,
            [hand.find(c => c.id === action.cardId)?.type || '']: state.pickNumber,
          },
        },
      };
    }

    case 'SHUFFLE_DECK': {
      const newPool = rebuildCardPool(
        state.availablePlayers,
        4,
        state.team1.roster,
        state.team2.roster,
        state.currentPick,
        state.pickNumber,
        state.gameMode,
      );
      return {
        ...state,
        cardPool: newPool,
      };
    }

    case 'RETURN_PLAYER': {
      const team = action.player === 'player1' ? 'team1' : 'team2';
      const roster = state[team].roster;
      if (roster.length === 0) return state;

      const lastPlayer = roster[roster.length - 1];
      // Block returning coaches and stadiums
      if (lastPlayer.positions.includes('HC') || lastPlayer.positions.includes('ST')) return state;
      const newRoster = roster.slice(0, -1);

      return {
        ...state,
        [team]: { ...state[team], roster: newRoster },
        availablePlayers: [...state.availablePlayers, lastPlayer],
        cardPool: [...state.cardPool, lastPlayer].slice(0, 4),
      };
    }

    case 'STEAL_PLAYER': {
      const fromTeam = action.fromPlayer === 'player1' ? 'team1' : 'team2';
      const toTeam = action.fromPlayer === 'player1' ? 'team2' : 'team1';

      // Immunity check: can't steal from immune player
      if (state.powerCards.immuneUntilTurn[action.fromPlayer] > state.pickNumber) return state;

      const stolenPlayer = state[fromTeam].roster.find(p => p.id === action.playerId);
      if (!stolenPlayer) return state;
      // Block stealing coaches and stadiums
      if (stolenPlayer.positions.includes('HC') || stolenPlayer.positions.includes('ST')) return state;
      // Guard: prevent roster from exceeding max size
      const maxRoster = state.gameMode === 'quick' ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;
      if (state[toTeam].roster.length >= maxRoster) return state;

      return {
        ...state,
        [fromTeam]: {
          ...state[fromTeam],
          roster: state[fromTeam].roster.filter(p => p.id !== action.playerId),
        },
        [toTeam]: {
          ...state[toTeam],
          roster: [...state[toTeam].roster, stolenPlayer],
        },
      };
    }

    case 'SKIP_TURN': {
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          skipNextTurn: action.targetPlayer,
        },
      };
    }

    case 'DOUBLE_PICK': {
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          doublePick: action.player,
        },
      };
    }

    case 'CLEAR_DOUBLE_PICK': {
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          doublePick: null,
        },
      };
    }

    case 'UPGRADE_TIER': {
      // Determine current tier and bump it up one level
      const currentTier = getCurrentRoundTier(state.pickNumber);
      const tierUpgrade: Record<Tier, Tier> = {
        common: 'bronze',
        bronze: 'silver',
        silver: 'gold',
        gold: 'diamond',
        diamond: 'diamond',
      };
      const upgradedTier = tierUpgrade[currentTier];

      // Draw 4 players from the upgraded tier
      const pool: Player[] = [];
      const shuffledAvail = shuffleArray([...state.availablePlayers]);
      const tierPlayers = shuffledAvail.filter(p => getPlayerTier(p.overall) === upgradedTier);
      const fallback = tierPlayers.length > 0 ? tierPlayers : shuffledAvail;

      for (let i = 0; i < 4 && fallback.length > pool.length; i++) {
        const candidate = fallback.find(p => !pool.some(pp => pp.id === p.id));
        if (candidate) pool.push(candidate);
      }

      return {
        ...state,
        cardPool: pool,
      };
    }

    case 'TRADE_PLAYERS': {
      // Immunity check: can't trade with immune player
      if (state.powerCards.immuneUntilTurn.player1 > state.pickNumber ||
          state.powerCards.immuneUntilTurn.player2 > state.pickNumber) return state;

      const player1Player = state.team1.roster.find(p => p.id === action.player1PlayerId);
      const player2Player = state.team2.roster.find(p => p.id === action.player2PlayerId);

      if (!player1Player || !player2Player) return state;
      // Block trading coaches and stadiums
      if (player1Player.positions.includes('HC') || player2Player.positions.includes('HC') ||
          player1Player.positions.includes('ST') || player2Player.positions.includes('ST')) return state;

      return {
        ...state,
        team1: {
          ...state.team1,
          roster: [
            ...state.team1.roster.filter(p => p.id !== action.player1PlayerId),
            player2Player,
          ],
        },
        team2: {
          ...state.team2,
          roster: [
            ...state.team2.roster.filter(p => p.id !== action.player2PlayerId),
            player1Player,
          ],
        },
      };
    }

    case 'REVERSE_ORDER': {
      // Swap Turns: opponent picks from current pool, but player goes to YOUR roster
      const swappedPicker = state.currentPick === 'player1' ? 'player2' : 'player1';
      return {
        ...state,
        currentPick: swappedPicker,
        powerCards: {
          ...state.powerCards,
          pickForTeam: state.currentPick, // picked player goes to the card user's team
        },
      };
    }

    case 'SABOTAGE': {
      // Opponent's next pool will be bronze/common tier
      const targetPlayer = state.currentPick === 'player1' ? 'player2' : 'player1';
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          sabotageNextPool: targetPlayer,
        },
      };
    }

    case 'IMMUNITY': {
      // Protect roster from steal and trade for 3 turns
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          immuneUntilTurn: {
            ...state.powerCards.immuneUntilTurn,
            [action.player]: state.pickNumber + 6, // ~3 of their turns (6 total picks)
          },
        },
      };
    }

    case 'SET_PEEK_POOL': {
      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          peekPool: action.pool,
        },
      };
    }

    case 'GENERATE_PEEK_POOL': {
      // Figure out the next round's first pick number
      const currentPick = state.pickNumber;
      // Next round starts at the next odd pick number after current round
      const currentRoundStart = currentPick % 2 === 1 ? currentPick : currentPick - 1;
      const nextRoundStart = currentRoundStart + 2;
      const nextPicker = getNextPicker(state.currentPick, nextRoundStart);

      const peekPool = rebuildCardPool(
        state.availablePlayers,
        4,
        state.team1.roster,
        state.team2.roster,
        nextPicker,
        nextRoundStart,
        state.gameMode,
      );

      return {
        ...state,
        powerCards: {
          ...state.powerCards,
          peekPool: peekPool,
        },
      };
    }

    // Auction Actions
    case 'START_AUCTION': {
      // Find an elite player (90+ overall) from available players
      const eliteCandidates = state.availablePlayers.filter(p => p.overall >= 90);
      let elitePlayer: Player;

      if (eliteCandidates.length > 0) {
        elitePlayer = eliteCandidates[Math.floor(Math.random() * eliteCandidates.length)];
      } else {
        // Fallback: highest available player
        const sorted = [...state.availablePlayers].sort((a, b) => b.overall - a.overall);
        elitePlayer = sorted[0];
      }

      if (!elitePlayer) return state;

      return {
        ...state,
        auctionState: {
          elitePlayer,
          phase: 'offer_p1',
          player1Offer: null,
          player2Offer: null,
          winner: null,
        },
      };
    }

    case 'PLACE_BID': {
      if (!state.auctionState) return state;

      if (action.player === 'player1') {
        return {
          ...state,
          auctionState: {
            ...state.auctionState,
            player1Offer: action.bid,
            phase: 'offer_p2',
          },
        };
      } else {
        return {
          ...state,
          auctionState: {
            ...state.auctionState,
            player2Offer: action.bid,
            phase: 'reveal',
          },
        };
      }
    }

    case 'RESOLVE_AUCTION': {
      if (!state.auctionState) return state;
      const { elitePlayer: auctionPlayer, player1Offer, player2Offer } = state.auctionState;

      if (!player1Offer || !player2Offer) return state;

      let auctionWinner: 'player1' | 'player2';
      if (player1Offer.overall > player2Offer.overall) {
        auctionWinner = 'player1';
      } else if (player2Offer.overall > player1Offer.overall) {
        auctionWinner = 'player2';
      } else {
        // Tie: coin flip
        auctionWinner = Math.random() < 0.5 ? 'player1' : 'player2';
      }

      // Winner: swap their offered player for the elite player
      const winnerTeamKey = auctionWinner === 'player1' ? 'team1' : 'team2';
      const winnerOffer = auctionWinner === 'player1' ? player1Offer : player2Offer;
      const newWinnerRoster = [
        ...state[winnerTeamKey].roster.filter(p => p.id !== winnerOffer.id),
        auctionPlayer,
      ];

      // Remove elite player from available, add the offered player back
      const newAvail = [
        ...state.availablePlayers.filter(p => p.id !== auctionPlayer.id),
        winnerOffer,
      ];

      // Advance both picks (auction counts as 2 picks)
      const newPickNum = state.pickNumber + 2;
      const nextPicker = getNextPicker(state.currentPick, newPickNum);

      // Rebuild card pool for next round
      const newTeam1Roster = winnerTeamKey === 'team1' ? newWinnerRoster : state.team1.roster;
      const newTeam2Roster = winnerTeamKey === 'team2' ? newWinnerRoster : state.team2.roster;
      const nextPool = rebuildCardPool(
        newAvail,
        4,
        newTeam1Roster,
        newTeam2Roster,
        nextPicker,
        newPickNum,
        state.gameMode,
      );

      const auctionRosterSize = state.gameMode === 'quick' ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;
      const totalPicks = auctionRosterSize * 2;
      if (newPickNum > totalPicks) {
        return {
          ...state,
          [winnerTeamKey]: { ...state[winnerTeamKey], roster: newWinnerRoster },
          availablePlayers: newAvail,
          cardPool: nextPool,
          phase: 'team-setup',
          pickNumber: newPickNum,
          pickedFromPool: [],
          auctionState: {
            ...state.auctionState,
            winner: auctionWinner,
            phase: 'done',
          },
        };
      }

      return {
        ...state,
        [winnerTeamKey]: { ...state[winnerTeamKey], roster: newWinnerRoster },
        availablePlayers: newAvail,
        cardPool: nextPool,
        currentPick: nextPicker,
        pickNumber: newPickNum,
        pickedFromPool: [],
        auctionState: {
          ...state.auctionState,
          winner: auctionWinner,
          phase: 'done',
        },
      };
    }

    case 'AUCTION_CONSOLATION_PICK': {
      // No longer used but keep for type safety
      return state;
    }

    // Multiplayer Actions
    case 'SYNC_MULTIPLAYER_STATE': {
      return {
        ...state,
        phase: 'draft',
        availablePlayers: action.availablePlayers ?? state.availablePlayers,
        cardPool: action.cardPool ?? state.cardPool,
        pickNumber: action.pickNumber ?? state.pickNumber,
        currentPick: action.currentPick ?? state.currentPick,
        pickedFromPool: action.pickedFromPool ?? state.pickedFromPool,
        team1: action.team1Roster ? { ...state.team1, roster: action.team1Roster } : state.team1,
        team2: action.team2Roster ? { ...state.team2, roster: action.team2Roster } : state.team2,
      };
    }

    case 'FORCE_PHASE': {
      return {
        ...state,
        phase: action.phase,
      };
    }

    default:
      return state;
  }
}

interface GameContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
