import { useState, useEffect, useRef, useCallback } from 'react';
import { OnlineGameProvider, useOnlineGame } from '../../contexts/OnlineGameContext';
import { useOnlineDraft } from '../../hooks/useOnlineDraft';
import { useOnlineSync } from '../../hooks/useOnlineSync';
import { TurnTimer } from './TurnTimer';
import { Button } from '../shared/Button';
import { Player, DraftRoundType, Position, ROSTER_REQUIREMENTS } from '../../types';
import { buildAllPlayersMap, getNeededPositions } from '../../utils/draftLogic';
import {
  getPositionColor, getOverallRating, gradeToLetter, getGradeColor,
  isPitcher, getDisplayName, getSpecialtyBadge, getCategoryBadge,
} from '../../utils/helpers';
import { inferGradesFromStats } from '../../utils/simulation';
import { SpecialRoundBanner } from '../Draft/SpecialRoundBanner';
import { MysteryReveal } from '../Draft/MysteryReveal';
import { ScoutingBars } from '../Draft/ScoutingBars';
import { PlayerScoutingModal } from '../Draft/PlayerScoutingModal';
import '../Draft/CardPool.css';

interface OnlineDraftScreenProps {
  matchId: string;
  onPhaseComplete: () => void;
  onAbandon: () => void;
}

// Build a lookup map of all players by ID
const allPlayersMap = buildAllPlayersMap();

function hydratePlayerIds(ids: string[]): Player[] {
  return ids.map(id => allPlayersMap.get(id)).filter(Boolean) as Player[];
}

// --- Shared helper components (mirroring CardPool.tsx) ---

function StatChip({ label, grade }: { label: string; grade: number }) {
  return (
    <div className="stat-chip">
      <span className="stat-abbr">{label}</span>
      <span className="stat-grade" style={{ color: getGradeColor(grade) }}>{gradeToLetter(grade)}</span>
    </div>
  );
}

function hashPlayerIndex(id: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % count;
}

function MysteryStats({ player }: { player: Player }) {
  const grades = player.grades ?? inferGradesFromStats(player);
  const pitcher = isPitcher(player);

  const chips: { label: string; grade: number }[] = pitcher
    ? [
        { label: 'VEL', grade: grades.fastball ?? 50 },
        { label: 'MOV', grade: grades.breaking ?? 50 },
        { label: 'CMD', grade: grades.control ?? 50 },
        { label: 'STM', grade: grades.stamina ?? 50 },
      ]
    : [
        { label: 'BAT', grade: grades.contact ?? 50 },
        { label: 'POW', grade: grades.power ?? 50 },
        { label: 'EYE', grade: grades.eye ?? 50 },
        { label: 'SPD', grade: grades.speed ?? 50 },
        { label: 'DEF', grade: grades.fielding ?? 50 },
      ];

  const revealedIndex = hashPlayerIndex(player.id, chips.length);

  return (
    <div className="compact-stats mystery-stats">
      {chips.map((chip, i) => (
        <div key={chip.label} className={`stat-chip ${i !== revealedIndex ? 'mystery-blur' : 'mystery-revealed'}`}>
          <span className="stat-abbr">{i === revealedIndex ? chip.label : '???'}</span>
          <span
            className="stat-grade"
            style={{ color: i === revealedIndex ? getGradeColor(chip.grade) : undefined }}
          >
            {i === revealedIndex ? gradeToLetter(chip.grade) : '?'}
          </span>
        </div>
      ))}
    </div>
  );
}

function CompactStats({ player }: { player: Player }) {
  const grades = player.grades ?? inferGradesFromStats(player);
  const pitcher = isPitcher(player);

  if (pitcher) {
    return (
      <div className="compact-stats">
        <StatChip label="VEL" grade={grades.fastball ?? 50} />
        <StatChip label="MOV" grade={grades.breaking ?? 50} />
        <StatChip label="CMD" grade={grades.control ?? 50} />
        <StatChip label="STM" grade={grades.stamina ?? 50} />
      </div>
    );
  }

  return (
    <div className="compact-stats">
      <StatChip label="BAT" grade={grades.contact ?? 50} />
      <StatChip label="POW" grade={grades.power ?? 50} />
      <StatChip label="EYE" grade={grades.eye ?? 50} />
      <StatChip label="SPD" grade={grades.speed ?? 50} />
      <StatChip label="DEF" grade={grades.fielding ?? 50} />
    </div>
  );
}

type RoundTier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'common';

function getPoolTier(pool: Player[]): { tier: RoundTier; label: string; color: string } {
  if (pool.length === 0) return { tier: 'common', label: 'Common', color: '#888888' };
  const maxOverall = Math.max(...pool.map(p => p.overall));
  if (maxOverall >= 90) return { tier: 'diamond', label: 'Diamond', color: '#00d4ff' };
  if (maxOverall >= 85) return { tier: 'gold', label: 'Gold', color: '#ffd700' };
  if (maxOverall >= 80) return { tier: 'silver', label: 'Silver', color: '#c0c0c0' };
  if (maxOverall >= 75) return { tier: 'bronze', label: 'Bronze', color: '#cd7f32' };
  return { tier: 'common', label: 'Common', color: '#888888' };
}

function getSpecialCardClass(roundType: DraftRoundType): string {
  switch (roundType) {
    case 'legends': return 'legend-card';
    case 'peak': return 'peak-card';
    case 'fictional': return 'fictional-card';
    case 'niners': return 'niners-card';
    case 'decade_classic': return 'decade-card';
    case 'decade_modern': return 'decade-card';
    case 'playoff_heroes': return 'playoff-card';
    case 'one_year_wonders': return 'peak-card';
    case 'busts': return 'busts-card';
    case 'mystery': return 'mystery-card';
    default: return '';
  }
}

function getSpecialBadge(roundType: DraftRoundType): string {
  switch (roundType) {
    case 'legends': return '\u{1F3C6}';
    case 'peak': return '\u2B50';
    case 'fictional': return '\u{1F3AC}';
    case 'niners': return '\u26BE';
    case 'decade_classic': return '\u{1F4FB}';
    case 'decade_modern': return '\u{1F4FC}';
    case 'playoff_heroes': return '\u{1F3DF}\uFE0F';
    case 'one_year_wonders': return '\u26A1';
    case 'mystery': return '\u2753';
    default: return '';
  }
}

// Lineup position grouping for roster display
const LINEUP_ORDER: { label: string; positions: Position[] }[] = [
  { label: 'Catchers', positions: ['C'] },
  { label: 'Infield', positions: ['1B', '2B', '3B', 'SS'] },
  { label: 'Outfield', positions: ['LF', 'CF', 'RF'] },
  { label: 'DH', positions: ['DH'] },
  { label: 'Bench', positions: ['BC', 'PH', 'PR', 'IFD', 'OFD'] },
  { label: 'Starting Pitchers', positions: ['SP'] },
  { label: 'Bullpen', positions: ['CL', 'SU', 'MRP', 'LRP', 'LOOGY'] },
];

function OnlineDraftInner({ onPhaseComplete, onAbandon }: Omit<OnlineDraftScreenProps, 'matchId'>) {
  const { match, connectionStatus } = useOnlineGame();
  const {
    cardPool: cardPoolIds,
    pickNumber,
    roundType,
    isMyTurn,
    myRole,
    myRoster: myRosterIds,
    opponentRosterSize,
    turnTimer,
    opponentUsername,
    pickedFromPool,
    lastPickedPlayerId,
    auctionState,
    pickPlayer,
    generateAndWriteCardPool,
    initializeDraft,
    submitAuctionOffer,
    resolveAuction,
  } = useOnlineDraft();

  const matchId = match?.id || '';
  useOnlineSync(matchId);

  const cardPool = hydratePlayerIds(cardPoolIds);
  const myRoster = hydratePlayerIds(myRosterIds);
  const initializedRef = useRef(false);

  // Pick notification state (transient 2.5s banner)
  const [pickNotification, setPickNotification] = useState<Player | null>(null);
  // Persistent opponent last pick (stays until you pick)
  const [opponentLastPick, setOpponentLastPick] = useState<Player | null>(null);
  const prevPickNumberRef = useRef(pickNumber);

  // Mystery reveal state
  const [revealingPlayer, setRevealingPlayer] = useState<Player | null>(null);

  // Auction offer state
  const [selectedOffer, setSelectedOffer] = useState<Player | null>(null);

  // Scouting preview modal
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null);

  // Local optimistic pick state — prevents double picks and gives immediate UI feedback
  const [localPickingId, setLocalPickingId] = useState<string | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Track pick notifications — both transient banner and persistent display
  useEffect(() => {
    if (pickNumber > prevPickNumberRef.current && lastPickedPlayerId) {
      const player = allPlayersMap.get(lastPickedPlayerId);
      if (player) {
        // Show transient banner
        setPickNotification(player);
        const timer = setTimeout(() => setPickNotification(null), 2500);

        // If it was the opponent's pick, set persistent display
        // (opponent picked when it was NOT my turn before the pick)
        if (isMyTurn) {
          // It's now my turn, meaning opponent just picked
          setOpponentLastPick(player);
        }

        prevPickNumberRef.current = pickNumber;
        return () => clearTimeout(timer);
      }
    }
    prevPickNumberRef.current = pickNumber;
  }, [pickNumber, lastPickedPlayerId, isMyTurn]);

  // Reset local optimistic state when turn changes (onSnapshot confirmed)
  useEffect(() => {
    setLocalPickingId(null);
    setWaitingForOpponent(!isMyTurn);
  }, [isMyTurn, pickNumber]);

  // Player 1 initializes the draft when phase_data is empty
  useEffect(() => {
    if (myRole === 'player1' && match && !initializedRef.current && cardPoolIds.length === 0 && pickNumber <= 1) {
      initializedRef.current = true;
      initializeDraft();
    }
  }, [myRole, match, cardPoolIds.length, pickNumber, initializeDraft]);

  // Player 1 generates new card pool when it's empty (after round pair)
  // IMPORTANT: Skip for auction rounds (rebuildCardPool returns [] for auction, causing infinite loop)
  useEffect(() => {
    if (myRole === 'player1' && cardPoolIds.length === 0 && pickNumber > 1 && roundType !== 'auction') {
      if (!auctionState) {
        generateAndWriteCardPool();
      }
    }
  }, [myRole, cardPoolIds.length, pickNumber, roundType, auctionState, generateAndWriteCardPool]);

  // Check if draft is complete (match status changed)
  useEffect(() => {
    if (match?.status === 'team_setup') {
      onPhaseComplete();
    }
  }, [match?.status, onPhaseComplete]);

  const handlePickPlayer = useCallback(async (playerId: string) => {
    // Immediately block further interaction (optimistic)
    if (localPickingId || waitingForOpponent) return;
    setLocalPickingId(playerId);
    setWaitingForOpponent(true);

    const isMysteryRound = roundType === 'mystery';

    // Clear opponent's last pick display when user picks
    setOpponentLastPick(null);

    await pickPlayer(playerId);

    if (isMysteryRound) {
      const player = allPlayersMap.get(playerId);
      if (player) {
        setRevealingPlayer(player);
      }
    }
  }, [pickPlayer, roundType, localPickingId, waitingForOpponent]);

  const handleAuctionOffer = useCallback(async () => {
    if (!selectedOffer) return;
    await submitAuctionOffer(selectedOffer.id);
    setSelectedOffer(null);
  }, [selectedOffer, submitAuctionOffer]);

  const isMystery = roundType === 'mystery';
  const isAuction = roundType === 'auction';
  const isSpecialRound = roundType !== 'normal';
  const roundNumber = Math.ceil(pickNumber / 2);
  const canPickNow = isMyTurn && !waitingForOpponent && !localPickingId;

  // Derive usernames from match
  const myUsername = match
    ? (myRole === 'player1' ? match.player1_username : match.player2_username)
    : 'You';

  // Position need/full helpers
  const neededPositions = getNeededPositions(myRoster);

  const playerFillsNeed = (player: Player): boolean => {
    return player.positions.some(pos => neededPositions.includes(pos));
  };

  const isPositionFull = (player: Player): boolean => {
    const counts: Partial<Record<Position, number>> = {};
    myRoster.forEach(p => {
      const pos = p.positions[0];
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return player.positions.every(pos => {
      const max = ROSTER_REQUIREMENTS[pos] ?? 0;
      return max > 0 && (counts[pos] || 0) >= max;
    });
  };

  // Pool tier & special card styling
  const round = getPoolTier(cardPool);
  const specialCardClass = getSpecialCardClass(roundType);
  const specialBadge = getSpecialBadge(roundType);

  // Resolve auction elite player
  const auctionElitePlayer = auctionState?.elitePlayerId
    ? allPlayersMap.get(auctionState.elitePlayerId) || null
    : null;
  const p1Offer = auctionState?.player1OfferId
    ? allPlayersMap.get(auctionState.player1OfferId) || null
    : null;
  const p2Offer = auctionState?.player2OfferId
    ? allPlayersMap.get(auctionState.player2OfferId) || null
    : null;

  // Group roster by position for display
  const groupedRoster = LINEUP_ORDER.map(group => ({
    ...group,
    players: myRoster.filter(p => p.positions.some(pos => group.positions.includes(pos))),
  })).filter(g => g.players.length > 0);

  return (
    <div className="card-pool" style={{ position: 'relative' }}>
      {connectionStatus !== 'connected' && (
        <div className="connection-banner">
          {connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Connection lost - retrying...'}
        </div>
      )}

      {/* Pick notification banner */}
      {pickNotification && (
        <div className="pick-notification">
          <span className="pick-notification-label">DRAFTED</span>
          <span className="pick-notification-ovr" style={{ backgroundColor: getOverallRating(pickNotification.overall).color }}>
            {pickNotification.overall}
          </span>
          <span className="pick-notification-name">{pickNotification.name}</span>
          <span className="pick-notification-pos" style={{ backgroundColor: getPositionColor(pickNotification.positions[0]) }}>
            {pickNotification.positions.join('/')}
          </span>
        </div>
      )}

      {/* Header - matches CardPool layout */}
      <div className={`card-pool-header ${canPickNow ? 'player1' : 'player2'}-turn`}>
        <div className="turn-indicator">
          <span className={`turn-badge ${canPickNow ? 'player1' : 'player2'}`}>
            {canPickNow ? `${myUsername}'s Turn` : `${opponentUsername}'s Turn`}
          </span>
          <div className="round-info">
            {!isSpecialRound && (
              <span className="round-tier" style={{ backgroundColor: round.color }}>
                {round.label}
              </span>
            )}
            <span className="pick-number">Pick {pickNumber}/52</span>
          </div>
        </div>
        <div className="draft-progress">
          <div className="progress-bars">
            <div className="progress-item">
              <span>{myUsername}</span>
              <div className="mini-bar">
                <div className="mini-fill" style={{ width: `${(myRoster.length / 26) * 100}%` }} />
              </div>
              <span>{myRoster.length}</span>
            </div>
            <div className="progress-item">
              <span>{opponentUsername}</span>
              <div className="mini-bar">
                <div className="mini-fill" style={{ width: `${(opponentRosterSize / 26) * 100}%` }} />
              </div>
              <span>{opponentRosterSize}</span>
            </div>
          </div>
        </div>
      </div>

      <TurnTimer seconds={turnTimer} isMyTurn={canPickNow} />

      {/* Persistent opponent last pick display */}
      {opponentLastPick && isMyTurn && (
        <div className="cpu-last-pick">
          <span className="cpu-last-pick-label">{opponentUsername} picked:</span>
          <span className="cpu-last-pick-overall" style={{ backgroundColor: getOverallRating(opponentLastPick.overall).color }}>
            {opponentLastPick.overall}
          </span>
          <span className="cpu-last-pick-name">{opponentLastPick.name}</span>
          <span className="cpu-last-pick-pos" style={{ backgroundColor: getPositionColor(opponentLastPick.positions[0]) }}>
            {opponentLastPick.positions.join('/')}
          </span>
        </div>
      )}

      {/* Special round banner */}
      {isSpecialRound && !isAuction && (
        <SpecialRoundBanner roundType={roundType} roundNumber={roundNumber} />
      )}

      {/* Mystery reveal modal */}
      {revealingPlayer && (
        <MysteryReveal
          player={revealingPlayer}
          onDismiss={() => setRevealingPlayer(null)}
        />
      )}

      {/* Auction UI */}
      {isAuction && auctionState && auctionElitePlayer ? (
        <div className="online-auction-container">
          <div className="auction-header-online">
            <span className="auction-icon-big">&#x1F4B0;</span>
            <h2>Auction Round</h2>
            <p>Offer one of your players to win the elite!</p>
          </div>

          {/* Elite player card */}
          <div className="auction-elite-display">
            <div className="elite-glow-online" />
            <div className="auction-elite-ovr" style={{ backgroundColor: getOverallRating(auctionElitePlayer.overall).color }}>
              {auctionElitePlayer.overall}
            </div>
            <div className="auction-elite-info">
              <div className="auction-elite-name">{auctionElitePlayer.name}</div>
              <div className="auction-elite-meta">
                <span className="player-pos" style={{ backgroundColor: getPositionColor(auctionElitePlayer.positions[0]) }}>
                  {auctionElitePlayer.positions.join('/')}
                </span>
                <span className="player-team">{auctionElitePlayer.team}</span>
              </div>
            </div>
          </div>

          {/* Offer phase UI */}
          {auctionState.phase === 'offer_p1' && myRole === 'player1' && (
            <div className="auction-offer-phase">
              <h3>Your Turn - Choose a Player to Offer</h3>
              <p className="auction-hint">Highest overall offer wins the elite player!</p>
              <div className="auction-roster-grid">
                {myRoster.map(player => (
                  <div
                    key={player.id}
                    className={`auction-offer-card ${selectedOffer?.id === player.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOffer(player)}
                  >
                    <div className="auction-offer-ovr" style={{ backgroundColor: getOverallRating(player.overall).color }}>
                      {player.overall}
                    </div>
                    <span className="auction-offer-name">{getDisplayName(player.name)}</span>
                    <span className="auction-offer-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
                      {player.positions[0]}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" onClick={handleAuctionOffer} disabled={!selectedOffer}>
                Lock In Offer
              </Button>
            </div>
          )}

          {auctionState.phase === 'offer_p1' && myRole === 'player2' && (
            <div className="auction-waiting">
              <div className="matchmaking-spinner" />
              <p>Waiting for {match?.player1_username || 'opponent'} to make their offer...</p>
            </div>
          )}

          {auctionState.phase === 'offer_p2' && myRole === 'player2' && (
            <div className="auction-offer-phase">
              <h3>Your Turn - Choose a Player to Offer</h3>
              <p className="auction-hint">Highest overall offer wins the elite player!</p>
              <div className="auction-roster-grid">
                {myRoster.map(player => (
                  <div
                    key={player.id}
                    className={`auction-offer-card ${selectedOffer?.id === player.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOffer(player)}
                  >
                    <div className="auction-offer-ovr" style={{ backgroundColor: getOverallRating(player.overall).color }}>
                      {player.overall}
                    </div>
                    <span className="auction-offer-name">{getDisplayName(player.name)}</span>
                    <span className="auction-offer-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
                      {player.positions[0]}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" onClick={handleAuctionOffer} disabled={!selectedOffer}>
                Lock In Offer
              </Button>
            </div>
          )}

          {auctionState.phase === 'offer_p2' && myRole === 'player1' && (
            <div className="auction-waiting">
              <div className="matchmaking-spinner" />
              <p>Waiting for {opponentUsername} to make their offer...</p>
            </div>
          )}

          {auctionState.phase === 'reveal' && p1Offer && p2Offer && (
            <div className="auction-reveal-phase">
              <h3>The Offers Are In!</h3>
              <div className="auction-reveal-offers">
                <div className={`auction-reveal-card ${auctionState.winnerId === 'player1' ? 'winner' : 'loser'}`}>
                  <div className="auction-reveal-label">{match?.player1_username || 'Team 1'} offered:</div>
                  <div className="auction-reveal-ovr" style={{ backgroundColor: getOverallRating(p1Offer.overall).color }}>
                    {p1Offer.overall}
                  </div>
                  <div className="auction-reveal-name">{p1Offer.name}</div>
                  {auctionState.winnerId === 'player1' && <div className="auction-winner-badge">WINNER</div>}
                </div>
                <div className="auction-reveal-vs">VS</div>
                <div className={`auction-reveal-card ${auctionState.winnerId === 'player2' ? 'winner' : 'loser'}`}>
                  <div className="auction-reveal-label">{match?.player2_username || 'Team 2'} offered:</div>
                  <div className="auction-reveal-ovr" style={{ backgroundColor: getOverallRating(p2Offer.overall).color }}>
                    {p2Offer.overall}
                  </div>
                  <div className="auction-reveal-name">{p2Offer.name}</div>
                  {auctionState.winnerId === 'player2' && <div className="auction-winner-badge">WINNER</div>}
                </div>
              </div>
              <p className="auction-result-text">
                {auctionState.winnerId === myRole ? 'You win the elite player!' : 'Opponent wins the elite player!'}
              </p>
              <Button variant="primary" size="lg" onClick={resolveAuction}>
                Continue Draft
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Normal / Special / Mystery card pool — using CardPool.css classes */
        <div className="player-list">
          {cardPool.length === 0 && (
            <div className="pool-loading" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Generating card pool...
            </div>
          )}
          {cardPool.map(player => {
            const isPicked = pickedFromPool.includes(player.id) || player.id === localPickingId;
            const canPick = isMyTurn && !waitingForOpponent && !localPickingId;
            const fillsNeed = !isPicked && playerFillsNeed(player);
            const posFull = !isPicked && !isMystery && isPositionFull(player);
            const rating = getOverallRating(player.overall);
            const playerNickname = player.nickname;
            const playerEra = player.era;
            const specialty = getSpecialtyBadge(player);
            const categoryBadge = getCategoryBadge(player.category);

            return (
              <div
                key={player.id}
                className={`player-row ${isPicked ? 'picked' : ''} ${fillsNeed && !isMystery ? 'fills-need' : ''} ${posFull ? 'pos-full' : ''} ${isSpecialRound ? specialCardClass : ''} ${player.category ? `category-${player.category}` : ''}`}
                onClick={() => {
                  if (!isPicked && canPick) handlePickPlayer(player.id);
                }}
              >
                {isMystery ? (
                  <span className="special-badge">{'\u2753'}</span>
                ) : (isSpecialRound && specialBadge) || categoryBadge ? (
                  <span className="special-badge">{categoryBadge || specialBadge}</span>
                ) : null}

                <div className="player-overall" style={{ backgroundColor: isMystery ? '#8b5cf6' : rating.color }}>
                  {isMystery ? '??' : player.overall}
                </div>
                <div className="player-main">
                  <div className="player-name-row">
                    <span className="player-name">{isMystery ? '???' : player.name}</span>
                    {fillsNeed && !isMystery && <span className="need-tag">NEED</span>}
                    {posFull && <span className="full-tag">FULL</span>}
                  </div>
                  {!isMystery && playerNickname && (
                    <div className="player-nickname">"{playerNickname}"</div>
                  )}
                  <div className="player-meta">
                    <span
                      className="player-pos"
                      style={{ backgroundColor: isMystery ? '#8b5cf6' : getPositionColor(player.positions[0]) }}
                    >
                      {isMystery ? '???' : player.positions.join('/')}
                    </span>
                    {!isMystery && <span className="player-team">{player.team}</span>}
                  </div>
                  {!isMystery && playerEra && (
                    <div className="era-tag">{playerEra}</div>
                  )}
                  {!isMystery && specialty && (
                    <div className="specialty-badge">{specialty}</div>
                  )}
                </div>
                {!isMystery && (
                  <div className="player-grades desktop-only">
                    <ScoutingBars player={player} compact />
                  </div>
                )}
                {isMystery ? (
                  <MysteryStats player={player} />
                ) : (
                  <CompactStats player={player} />
                )}
                {!isMystery && (
                  <button
                    className="preview-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewPlayer(player);
                    }}
                    title="View Scouting Report"
                  >
                    🔍
                  </button>
                )}
                {isPicked && <div className="picked-overlay">DRAFTED</div>}
                {!canPick && !isPicked && <div className="picked-overlay" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>
                  {waitingForOpponent ? "OPPONENT'S TURN" : 'WAIT...'}
                </div>}
                {!isMystery && player.funFact && (
                  <div className="player-fun-fact">{player.funFact}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Roster sidebar - grouped by position */}
      <div className="online-roster-view">
        <h3>Your Roster ({myRoster.length}/26)</h3>
        <div className="mini-roster">
          {myRoster.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
              No players drafted yet
            </div>
          )}
          {groupedRoster.map(group => (
            <div key={group.label} className="roster-group">
              <div className="roster-group-label">{group.label}</div>
              {group.players.map(p => (
                <div key={p.id} className="mini-roster-player">
                  <span className="mini-pos" style={{ backgroundColor: getPositionColor(p.positions[0]) }}>{p.positions[0]}</span>
                  <span className="mini-name">{getDisplayName(p.name)}</span>
                  <span className="mini-ovr" style={{ color: getOverallRating(p.overall).color }}>{p.overall}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="online-draft-footer">
        <Button variant="secondary" size="sm" onClick={onAbandon}>
          Leave Match
        </Button>
      </div>

      {/* Scouting report modal */}
      {previewPlayer && (
        <PlayerScoutingModal
          player={previewPlayer}
          onDraft={() => {
            handlePickPlayer(previewPlayer.id);
            setPreviewPlayer(null);
          }}
          onClose={() => setPreviewPlayer(null)}
        />
      )}
    </div>
  );
}

export function OnlineDraftScreen({ matchId, onPhaseComplete, onAbandon }: OnlineDraftScreenProps) {
  return (
    <OnlineGameProvider matchId={matchId}>
      <OnlineDraftInner onPhaseComplete={onPhaseComplete} onAbandon={onAbandon} />
    </OnlineGameProvider>
  );
}
