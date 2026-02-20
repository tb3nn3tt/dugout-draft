import { useState, useRef, useEffect, useMemo } from 'react';
import { useDraft } from '../../hooks/useDraft';
import { useGame } from '../../context/GameContext';
import { Player, DraftRoundType, PowerCard, ROSTER_REQUIREMENTS, QUICK_ROSTER_REQUIREMENTS, Position, TOTAL_ROSTER_SIZE, QUICK_ROSTER_SIZE } from '../../types';
import { getPositionColor, getOverallRating, isPitcher, getSpecialtyBadge, getCategoryBadge, gradeToLetter, getGradeColor } from '../../utils/helpers';
import { SpecialRoundBanner, getRoundType } from './SpecialRoundBanner';
import { PowerCardHand, PowerCardPreview } from './PowerCardHand';
import { StealPlayerModal, TradePickModal } from './StealPlayerModal';
import { ScoutingBars } from './ScoutingBars';
import { PlayerScoutingModal } from './PlayerScoutingModal';
import { AuctionBid } from './AuctionBid';
import { MysteryReveal } from './MysteryReveal';
import { PowerCardAnnouncement } from './PowerCardAnnouncement';
import { inferGradesFromStats } from '../../utils/simulation';
import { SpecialRoundOnboarding, useSpecialRoundOnboarding } from './SpecialRoundOnboarding';
import { RosterTracker } from './RosterTracker';
import { useSound } from '../../contexts/SoundContext';
import { evaluatePool, getAuctionBid, getMysteryPick, shouldUsePowerCard } from '../../hooks/useDraftAI';
import { getCpuSkill } from '../../utils/cpuSkill';
import { getCardSuggestions } from '../../utils/powerCards';
import { getShortName } from '../../utils/teamNames';
import { getRemainingNeedCount, getNeededPositions, playerFillsPosition, getDraftRoundTypeQuick } from '../../utils/draftLogic';
import './CardPool.css';

function StatChip({ label, grade }: { label: string; grade: number }) {
  return (
    <div className="stat-chip">
      <span className="stat-abbr">{label}</span>
      <span className="stat-grade" style={{ color: getGradeColor(grade) }}>{gradeToLetter(grade)}</span>
    </div>
  );
}

// Simple hash to get a consistent "random" index from player ID
function hashPlayerIndex(id: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % count;
}

// Mystery stats: show one real grade, blur the rest
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

// Compact stats display for mobile
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
  // Derive tier from the highest overall in the pool (reflects the intended tier draw)
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
    case 'coach': return 'coach-card';
    case 'stadium': return 'stadium-card';
    default: return '';
  }
}

function getSpecialBadge(roundType: DraftRoundType): string {
  switch (roundType) {
    case 'legends': return '🏆';
    case 'peak': return '⭐';
    case 'fictional': return '🎬';
    case 'niners': return '⚾';
    case 'decade_classic': return '📻';
    case 'decade_modern': return '📼';
    case 'playoff_heroes': return '🏟️';
    case 'one_year_wonders': return '⚡';
    case 'mystery': return '❓';
    case 'coach': return '📋';
    case 'stadium': return '🏟️';
    default: return '';
  }
}

function StadiumEffectBars({ player }: { player: Player }) {
  const effect = player.parkEffect;
  if (!effect) return null;

  const items = [
    { label: 'HR', value: effect.hrFactor, max: 1.25 },
    { label: '2B', value: effect.doublesFactor, max: 1.20 },
    { label: '3B', value: effect.triplesFactor, max: 1.30 },
    { label: 'RUN', value: effect.runFactor, max: 1.15 },
    { label: 'ERR', value: effect.errorFactor, max: 1.15 },
  ].filter(b => b.value !== 1.0); // Only show non-neutral factors

  if (items.length === 0) {
    return <div className="coach-effect-style">Neutral Park</div>;
  }

  return (
    <div className="coach-effect-bars">
      {items.map(bar => {
        const pct = Math.max(0, Math.min(100, ((bar.value - 0.80) / (bar.max - 0.80)) * 100));
        const color = bar.value > 1.0 ? '#e74c3c' : '#3498db';
        return (
          <div key={bar.label} className="coach-bar">
            <span className="coach-bar-label">{bar.label}</span>
            <div className="coach-bar-track">
              <div className="coach-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CardPool({ playerNames }: { playerNames?: { player1: string; player2: string } }) {
  const { cardPool, currentPick, pickNumber, pickPlayer, progress, neededPositions, currentTeam, mustFillNeed } = useDraft();
  const { state, dispatch } = useGame();
  const { playSound } = useSound();
  const isQuick = state.gameMode === 'quick';
  const rosterSize = isQuick ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;
  const rosterReqs = isQuick ? QUICK_ROSTER_REQUIREMENTS : ROSTER_REQUIREMENTS;
  const totalPicks = rosterSize * 2;
  const timerDuration = isQuick ? 20 : 30;
  const [previewCard, setPreviewCard] = useState<PowerCard | null>(null);
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null);
  const [showStealModal, setShowStealModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [powerCardAnnouncement, setPowerCardAnnouncement] = useState<{ card: PowerCard; player: 'player1' | 'player2' } | null>(null);
  const pendingCpuCardRef = useRef<PowerCard | null>(null);

  // Pass & Play hand-off state
  const is2Player = !state.isCPU;
  const [showHandoff, setShowHandoff] = useState(false);
  const prevPickRef = useRef(pickNumber);
  const lastPickedPlayerRef = useRef<Player | null>(null);

  // First-pick tooltip
  const FIRST_PICK_KEY = 'dugout-draft-firstpick-tip';
  const [showFirstPickTip, setShowFirstPickTip] = useState(() => {
    return !localStorage.getItem(FIRST_PICK_KEY) && pickNumber === 1;
  });

  // Auto-dismiss first-pick tip after 8s or on first pick
  useEffect(() => {
    if (!showFirstPickTip) return;
    const t = setTimeout(() => setShowFirstPickTip(false), 8000);
    return () => clearTimeout(t);
  }, [showFirstPickTip]);

  // Dismiss on first pick
  useEffect(() => {
    if (pickNumber > 1 && showFirstPickTip) {
      setShowFirstPickTip(false);
      localStorage.setItem(FIRST_PICK_KEY, 'seen');
    }
  }, [pickNumber, showFirstPickTip]);

  // Track last picked player for hand-off display
  useEffect(() => {
    if (pickNumber > prevPickRef.current) {
      // Find which player was just picked by checking pickedFromPool
      const lastPickedId = state.pickedFromPool[state.pickedFromPool.length - 1];
      if (lastPickedId) {
        // Search in both rosters for the player
        const found = [...state.team1.roster, ...state.team2.roster].find(p => p.id === lastPickedId);
        if (found) lastPickedPlayerRef.current = found;
      }
    }
  }, [pickNumber, state.pickedFromPool, state.team1.roster, state.team2.roster]);

  // Hand-off trigger: show overlay when turn changes in 2P mode
  useEffect(() => {
    if (!is2Player || !playerNames) return;
    if (pickNumber > prevPickRef.current && pickNumber > 1) {
      // Check if the picker actually changed (skip for double pick where same player goes again)
      const prevPicker = prevPickRef.current % 2 === 1 ? 'player1' : 'player2';
      if (currentPick !== prevPicker) {
        setShowHandoff(true);
      }
    }
    prevPickRef.current = pickNumber;
  }, [pickNumber, currentPick, is2Player, playerNames]);

  const roundType = isQuick ? getDraftRoundTypeQuick(pickNumber) : getRoundType(pickNumber);

  // Draft timer
  const [timer, setTimer] = useState(timerDuration);
  const draftTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Reset timer when pick number changes (new turn)
  // In 2P mode with playerNames, timer resets via handleHandoffDismiss instead
  // Skip reset while mystery reveal overlay is showing
  useEffect(() => {
    if (is2Player && playerNames) return;
    if (state.mysteryRevealPlayer) return;
    if (powerCardAnnouncement) return;
    setTimer(timerDuration);
  }, [pickNumber, timerDuration, is2Player, playerNames, state.mysteryRevealPlayer, powerCardAnnouncement]);

  // Countdown
  useEffect(() => {
    if ((state.isCPU && currentPick === 'player2') || roundType === 'auction' || showHandoff || state.mysteryRevealPlayer || powerCardAnnouncement) {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
      return;
    }
    draftTimerRef.current = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    return () => { if (draftTimerRef.current) clearInterval(draftTimerRef.current); };
  }, [pickNumber, state.isCPU, currentPick, roundType, showHandoff, state.mysteryRevealPlayer, powerCardAnnouncement]);

  // Auto-pick when timer expires
  useEffect(() => {
    if (timer > 0) return;
    if ((state.isCPU && currentPick === 'player2') || roundType === 'auction') return;
    if (state.mysteryRevealPlayer || powerCardAnnouncement) return;
    const available = cardPool.filter(p => !state.pickedFromPool.includes(p.id));
    if (available.length > 0) {
      // Prefer need-filling cards, especially when must-fill is active
      const needFilling = available.filter(p => playerFillsNeed(p));
      const candidates = needFilling.length > 0 ? needFilling : available;
      const best = [...candidates].sort((a, b) => b.overall - a.overall)[0];
      pickPlayer(best.id);
    }
  }, [timer, state.isCPU, currentPick, roundType, cardPool, state.pickedFromPool, pickPlayer]);

  // Special round onboarding
  const { showOnboarding, dismissOnboarding } = useSpecialRoundOnboarding(roundType);

  // Auto-start auction when entering auction round
  useEffect(() => {
    if (roundType === 'auction' && !state.auctionState) {
      dispatch({ type: 'START_AUCTION' });
    }
  }, [roundType, state.auctionState, dispatch]);


  // Load CPU skill level once for the draft session
  const cpuSkill = useMemo(() => state.isCPU ? getCpuSkill() : 0, [state.isCPU]);

  const isCPUTurn = state.isCPU && currentPick === 'player2';
  const [cpuThinking, setCpuThinking] = useState(false);
  const [cpuRevealing, setCpuRevealing] = useState(false);
  const [cpuLastPick, setCpuLastPick] = useState<Player | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpuRevealRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared helper: dispatch the effect for a power card
  const dispatchCardEffect = (card: PowerCard, player: 'player1' | 'player2') => {
    dispatch({ type: 'USE_POWER_CARD', cardId: card.id, player });
    switch (card.type) {
      case 'shuffle_deck':
        dispatch({ type: 'SHUFFLE_DECK' });
        break;
      case 'return_player':
        dispatch({ type: 'RETURN_PLAYER', player });
        break;
      case 'steal_player':
        setShowStealModal(true);
        break;
      case 'skip_turn':
        dispatch({ type: 'SKIP_TURN', targetPlayer: player === 'player1' ? 'player2' : 'player1' });
        break;
      case 'double_pick':
        dispatch({ type: 'DOUBLE_PICK', player });
        break;
      case 'upgrade_tier':
        dispatch({ type: 'UPGRADE_TIER' });
        break;
      case 'trade_pick':
        setShowTradeModal(true);
        break;
      case 'reverse_order':
        dispatch({ type: 'REVERSE_ORDER' });
        break;
      case 'time_extension':
        setTimer(t => t + 15);
        break;
      case 'peek_ahead':
        dispatch({ type: 'GENERATE_PEEK_POOL' });
        break;
      case 'sabotage':
        dispatch({ type: 'SABOTAGE' });
        break;
      case 'immunity':
        dispatch({ type: 'IMMUNITY', player });
        break;
    }
  };

  // Resume CPU pick after power card announcement dismisses
  const handleAnnouncementDismiss = () => {
    const pendingCard = pendingCpuCardRef.current;
    setPowerCardAnnouncement(null);

    // If there was a pending CPU card, dispatch its effect now and resume CPU pick
    if (pendingCard && state.isCPU) {
      pendingCpuCardRef.current = null;
      dispatchCardEffect(pendingCard, 'player2');

      // Now do the CPU pick (thinking -> reveal -> pick)
      setCpuThinking(true);
      const delay = 1000 + Math.random() * 800;
      cpuTimerRef.current = setTimeout(() => {
        cpuTimerRef.current = null;
        let pick: Player | null = null;
        if (roundType === 'mystery') {
          pick = getMysteryPick(cardPool, state.team2.roster, state.pickedFromPool, cpuSkill);
        } else {
          pick = evaluatePool(cardPool, state.team2.roster, state.pickedFromPool, cpuSkill, state.team1.roster);
        }
        if (!pick) {
          const fallback = cardPool.filter(p => !state.pickedFromPool.includes(p.id));
          if (fallback.length > 0) {
            pick = fallback[Math.floor(Math.random() * fallback.length)];
          }
        }
        if (pick) {
          setCpuThinking(false);
          setCpuLastPick(pick);
          setCpuRevealing(true);
          cpuRevealRef.current = setTimeout(() => {
            cpuRevealRef.current = null;
            pickPlayer(pick!.id);
            setCpuRevealing(false);
          }, 2500);
        } else {
          setCpuThinking(false);
        }
      }, delay);
    }
  };

  // CPU auto-pick logic
  useEffect(() => {
    if (cpuTimerRef.current || cpuRevealing) return;
    if (state.mysteryRevealPlayer || powerCardAnnouncement) return;

    // Handle auction round — CPU places a bid and auto-advances phases
    // Auction doesn't depend on currentPick, uses its own phase system
    if (state.isCPU && roundType === 'auction' && state.auctionState) {
      if (state.auctionState.phase === 'offer_p2') {
        setCpuThinking(true);
        const delay = 1500 + Math.random() * 1000;
        cpuTimerRef.current = setTimeout(() => {
          cpuTimerRef.current = null;
          const bid = getAuctionBid(state.team2.roster, cpuSkill);
          if (bid) {
            dispatch({ type: 'PLACE_BID', player: 'player2', bid });
          }
          setCpuThinking(false);
        }, delay);
        return;
      }
      if (state.auctionState.phase === 'reveal') {
        cpuTimerRef.current = setTimeout(() => {
          cpuTimerRef.current = null;
          dispatch({ type: 'RESOLVE_AUCTION' });
        }, 2000);
        return;
      }
      if (state.auctionState.phase === 'done') {
        cpuTimerRef.current = setTimeout(() => {
          cpuTimerRef.current = null;
          dispatch({ type: 'DISMISS_AUCTION' });
        }, 3000);
        return;
      }
      return;
    }

    // Standard pick — requires it to be CPU's turn
    if (!isCPUTurn) return;
    let available = cardPool.filter(p => !state.pickedFromPool.includes(p.id));
    if (available.length === 0) return;

    // When CPU must fill needs, filter to only need-filling cards
    const cpuRemaining = rosterSize - state.team2.roster.length;
    const cpuNeedCount = getRemainingNeedCount(state.team2.roster, state.gameMode);
    if (cpuRemaining <= cpuNeedCount) {
      const cpuNeeds = getNeededPositions(state.team2.roster, state.gameMode);
      const needFillers = available.filter(p => playerFillsPosition(p, cpuNeeds));
      if (needFillers.length > 0) available = needFillers;
    }

    setCpuThinking(true);
    const delay = 1500 + Math.random() * 1000;
    cpuTimerRef.current = setTimeout(() => {
      cpuTimerRef.current = null;

      // Check if CPU should use a power card before picking
      const cpuHand = state.powerCards.player2Hand;
      const powerCardToUse = shouldUsePowerCard(
        cpuHand, state.powerCards, pickNumber, 'player2',
        cardPool, state.team2.roster, state.pickedFromPool, cpuSkill, roundType
      );
      if (powerCardToUse) {
        // Show announcement overlay — card effect dispatched on dismiss
        pendingCpuCardRef.current = powerCardToUse;
        setCpuThinking(false);
        setPowerCardAnnouncement({ card: powerCardToUse, player: 'player2' });
        return;
      }

      let pick: Player | null = null;
      if (roundType === 'mystery') {
        pick = getMysteryPick(cardPool, state.team2.roster, state.pickedFromPool, cpuSkill);
      } else {
        pick = evaluatePool(cardPool, state.team2.roster, state.pickedFromPool, cpuSkill, state.team1.roster);
      }
      // Fallback: pick any available card
      if (!pick) {
        const fallback = cardPool.filter(p => !state.pickedFromPool.includes(p.id));
        if (fallback.length > 0) {
          pick = fallback[Math.floor(Math.random() * fallback.length)];
        }
      }
      if (pick) {
        // Show reveal overlay instead of immediately picking
        setCpuThinking(false);
        setCpuLastPick(pick);
        setCpuRevealing(true);
        cpuRevealRef.current = setTimeout(() => {
          cpuRevealRef.current = null;
          pickPlayer(pick!.id);
          setCpuRevealing(false);
        }, 2500);
      } else {
        setCpuThinking(false);
      }
    }, delay);
  }, [isCPUTurn, cpuRevealing, cardPool, roundType, state.isCPU, state.auctionState, state.team2.roster, state.team1.roster, state.pickedFromPool, state.powerCards, pickNumber, cpuSkill, pickPlayer, dispatch, powerCardAnnouncement]);

  // Cleanup CPU timers on unmount only
  useEffect(() => {
    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
      if (cpuRevealRef.current) clearTimeout(cpuRevealRef.current);
    };
  }, []);

  const handleHandoffDismiss = () => {
    setShowHandoff(false);
    setTimer(timerDuration);
  };

  const hand = currentPick === 'player1' ? state.powerCards.player1Hand : state.powerCards.player2Hand;
  const opponentRoster = currentPick === 'player1' ? state.team2.roster : state.team1.roster;

  // Compute contextual suggestions for power cards
  const cardSuggestions = getCardSuggestions(
    hand,
    state.powerCards,
    pickNumber,
    currentPick,
    currentTeam.roster,
    opponentRoster,
    cardPool,
    state.pickedFromPool,
    neededPositions,
    timer,
  );

  // Cards blocked during coach/stadium round (would break 1-per-team rule)
  const SPECIAL_BLOCKED_CARDS: string[] = ['double_pick', 'skip_turn', 'upgrade_tier', 'sabotage'];
  const isCoachRound = roundType === 'coach';
  const isStadiumRound = roundType === 'stadium';
  const isSpecialOnePerTeamRound = isCoachRound || isStadiumRound;

  const handleUseCard = (card: PowerCard) => {
    if (isSpecialOnePerTeamRound && SPECIAL_BLOCKED_CARDS.includes(card.type)) return;
    setPreviewCard(card);
  };

  const confirmUseCard = () => {
    if (!previewCard) return;
    if (isSpecialOnePerTeamRound && SPECIAL_BLOCKED_CARDS.includes(previewCard.type)) return;
    // Show announcement briefly, then dispatch the card effect
    setPowerCardAnnouncement({ card: previewCard, player: currentPick });
    dispatchCardEffect(previewCard, currentPick);
    setPreviewCard(null);
  };

  const playerFillsNeed = (player: Player): boolean => {
    return player.positions.some(pos => neededPositions.includes(pos));
  };

  // Check if all of a player's positions are already at max for the current team
  const isPositionFull = (player: Player): boolean => {
    const roster = currentPick === 'player1' ? state.team1.roster : state.team2.roster;
    const counts: Partial<Record<Position, number>> = {};
    roster.forEach(p => {
      const pos = p.positions[0];
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return player.positions.every(pos => {
      const max = rosterReqs[pos] ?? 0;
      return max > 0 && (counts[pos] || 0) >= max;
    });
  };

  const round = getPoolTier(cardPool);
  const roundNumber = Math.ceil(pickNumber / 2);
  const isSpecialRound = roundType !== 'normal';
  const specialCardClass = getSpecialCardClass(roundType);
  const specialBadge = getSpecialBadge(roundType);

  return (
    <div className="card-pool">
      {cpuThinking && (
        <div className="cpu-thinking-overlay">
          <div className="cpu-thinking-content">
            <span className="cpu-icon">🤖</span>
            <span className="cpu-text">CPU is thinking...</span>
          </div>
        </div>
      )}

      {cpuRevealing && cpuLastPick && (
        <div className="cpu-reveal-overlay">
          <div className="cpu-reveal-content">
            <span className="cpu-reveal-label">CPU Drafted</span>
            <div className="cpu-reveal-card">
              <div className="cpu-reveal-overall" style={{ backgroundColor: roundType === 'mystery' ? '#8b5cf6' : getOverallRating(cpuLastPick.overall).color }}>
                {roundType === 'mystery' ? '??' : cpuLastPick.overall}
              </div>
              <div className="cpu-reveal-info">
                <span className="cpu-reveal-name">{roundType === 'mystery' ? '???' : cpuLastPick.name}</span>
                {roundType !== 'mystery' && (
                  <span className="cpu-reveal-meta">
                    <span className="cpu-reveal-pos" style={{ backgroundColor: getPositionColor(cpuLastPick.positions[0]) }}>
                      {cpuLastPick.positions.join('/')}
                    </span>
                    {cpuLastPick.team && <span className="cpu-reveal-team">{cpuLastPick.team}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHandoff && playerNames && (
        <div className="handoff-overlay">
          <div className="handoff-content">
            {lastPickedPlayerRef.current && (
              <div className="handoff-last-pick">
                <div className="handoff-last-pick-overall" style={{ backgroundColor: getOverallRating(lastPickedPlayerRef.current.overall).color }}>
                  {lastPickedPlayerRef.current.overall}
                </div>
                <div className="handoff-last-pick-info">
                  <span className="handoff-last-pick-name">{lastPickedPlayerRef.current.name}</span>
                  <span className="handoff-last-pick-pos" style={{ backgroundColor: getPositionColor(lastPickedPlayerRef.current.positions[0]) }}>
                    {lastPickedPlayerRef.current.positions.join('/')}
                  </span>
                </div>
              </div>
            )}
            <div className="handoff-phone-icon">📱</div>
            <h2 className="handoff-title">
              {currentPick === 'player1' ? playerNames.player1 : playerNames.player2}'s Turn
            </h2>
            <p className="handoff-subtitle">Pass the phone!</p>
            <button className="handoff-ready-btn" onClick={handleHandoffDismiss}>
              I'm Ready
            </button>
          </div>
        </div>
      )}

      {isSpecialRound && (
        <SpecialRoundBanner roundType={roundType} roundNumber={roundNumber} />
      )}

      <div className={`card-pool-header ${currentPick}-turn`}>
        <div className="turn-indicator">
          <span className={`turn-badge ${currentPick}`}>
            {playerNames
              ? (currentPick === 'player1' ? `${playerNames.player1}'s Turn` : `${playerNames.player2}'s Turn`)
              : (currentPick === 'player1' ? `${state.team1.name}'s Turn` : `${state.team2.name}'s Turn`)}
          </span>
          {state.powerCards.pickForTeam && (
            <span className="pick-for-tag">
              Picking for {state.powerCards.pickForTeam === 'player1' ? getShortName(state.team1.name) : getShortName(state.team2.name)}
            </span>
          )}
          <div className="round-info">
            {!isSpecialRound && (
              <span className="round-tier" style={{ backgroundColor: round.color }}>
                {round.label}
              </span>
            )}
            <span className="pick-number">Pick {pickNumber}/{totalPicks}</span>
          </div>
        </div>
        {roundType !== 'auction' && !(state.isCPU && currentPick === 'player2') && (
          <div className={`draft-timer ${timer <= 5 ? 'timer-critical' : timer <= 10 ? 'timer-warning' : ''}`}>
            {timer}s
          </div>
        )}
        <div className="draft-progress">
          <div className="progress-bars">
            <div className="progress-item">
              <span>{getShortName(state.team1.name)}</span>
              <div className="mini-bar">
                <div className="mini-fill" style={{ width: `${(progress.team1 / progress.total) * 100}%` }} />
              </div>
              <span>{progress.team1}</span>
            </div>
            <div className="progress-item">
              <span>{getShortName(state.team2.name)}</span>
              <div className="mini-bar">
                <div className="mini-fill" style={{ width: `${(progress.team2 / progress.total) * 100}%` }} />
              </div>
              <span>{progress.team2}</span>
            </div>
          </div>
        </div>
      </div>

      {cpuLastPick && !isCPUTurn && state.isCPU && (
        <div className="cpu-last-pick">
          <span className="cpu-last-pick-label">🤖 CPU picked:</span>
          <span className="cpu-last-pick-overall" style={{ backgroundColor: getOverallRating(cpuLastPick.overall).color }}>
            {cpuLastPick.overall}
          </span>
          <span className="cpu-last-pick-name">{cpuLastPick.name}</span>
          <span className="cpu-last-pick-pos" style={{ backgroundColor: getPositionColor(cpuLastPick.positions[0]) }}>
            {cpuLastPick.positions.join('/')}
          </span>
        </div>
      )}

      {!isQuick && (
        <PowerCardHand
          hand={hand}
          state={state.powerCards}
          currentTurn={pickNumber}
          currentPlayer={currentPick}
          playerRoster={currentTeam.roster}
          onUseCard={handleUseCard}
          isMyTurn={true}
          suggestions={cardSuggestions}
        />
      )}

      {/* Auction Round: Show bidding UI instead of card pool */}
      {roundType === 'auction' && state.auctionState ? (
        <AuctionBid
          auctionState={state.auctionState}
          currentPick={currentPick}
          onBid={(player, bid) => dispatch({ type: 'PLACE_BID', player, bid })}
          onResolve={() => dispatch({ type: 'RESOLVE_AUCTION' })}
          onConsolationPick={() => {}}
          player1Roster={state.team1.roster}
          player2Roster={state.team2.roster}
          onDismiss={() => dispatch({ type: 'DISMISS_AUCTION' })}
          isCPU={state.isCPU}
          team1Name={state.team1.name}
          team2Name={state.team2.name}
        />
      ) : (
        <div className="player-list">
          {cardPool.map((player) => {
            const isMystery = roundType === 'mystery';
            const isPicked = state.pickedFromPool.includes(player.id);
            const fillsNeed = !isPicked && playerFillsNeed(player);
            const posFull = !isPicked && !isMystery && isPositionFull(player);
            // When must-fill is active, non-need cards are locked out
            const needLocked = !isPicked && mustFillNeed && !isMystery && !fillsNeed;
            const rating = getOverallRating(player.overall);
            const playerEra = player.era;
            const playerNickname = player.nickname;
            const specialty = getSpecialtyBadge(player);
            const categoryBadge = getCategoryBadge(player.category);

            return (
              <div
                key={player.id}
                className={`player-row ${isPicked ? 'picked' : ''} ${fillsNeed && !isMystery ? 'fills-need' : ''} ${posFull || needLocked ? 'pos-full' : ''} ${isSpecialRound ? specialCardClass : ''} ${player.category ? `category-${player.category}` : ''}`}
                onClick={() => {
                  if (isPicked || isCPUTurn || needLocked) return;
                  if (isMystery) {
                    pickPlayer(player.id);
                    playSound('draft_pick');
                  } else {
                    setPreviewPlayer(player);
                  }
                }}
              >
                {isMystery ? (
                  <span className="special-badge">❓</span>
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
                      style={{ backgroundColor: getPositionColor(player.positions[0]) }}
                    >
                      {player.positions.join('/')}
                    </span>
                    <span className="player-team">{player.team}</span>
                  </div>
                  {!isMystery && !isCoachRound && playerEra && (
                    <div className="era-tag">{playerEra}</div>
                  )}
                  {!isMystery && !isCoachRound && specialty && (
                    <div className="specialty-badge">{specialty}</div>
                  )}
                  {isCoachRound && player.coachEffect && (
                    <div className="coach-effect-style">{player.coachEffect.style}</div>
                  )}
                  {isStadiumRound && player.parkEffect && (
                    <div className="coach-effect-style">{player.parkEffect.name}</div>
                  )}
                </div>
                {isStadiumRound && player.parkEffect ? (
                  <StadiumEffectBars player={player} />
                ) : isCoachRound && player.coachEffect ? (
                  <div className="coach-effect-bars">
                    {player.coachEffect.offensiveBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">OFF</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.offensiveBonus / 8 * 100}%`, background: '#e74c3c' }} />
                        </div>
                      </div>
                    )}
                    {player.coachEffect.pitchingBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">PIT</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.pitchingBonus / 8 * 100}%`, background: '#3498db' }} />
                        </div>
                      </div>
                    )}
                    {player.coachEffect.clutchBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">CLT</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.clutchBonus / 6 * 100}%`, background: '#f39c12' }} />
                        </div>
                      </div>
                    )}
                    {player.coachEffect.staminaBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">STM</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.staminaBonus / 10 * 100}%`, background: '#2ecc71' }} />
                        </div>
                      </div>
                    )}
                    {player.coachEffect.speedBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">SPD</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.speedBonus / 5 * 100}%`, background: '#1abc9c' }} />
                        </div>
                      </div>
                    )}
                    {player.coachEffect.fieldingBonus > 0 && (
                      <div className="coach-bar">
                        <span className="coach-bar-label">FLD</span>
                        <div className="coach-bar-track">
                          <div className="coach-bar-fill" style={{ width: `${player.coachEffect.fieldingBonus / 5 * 100}%`, background: '#9b59b6' }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : !isMystery ? (
                  <div className="player-grades desktop-only">
                    <ScoutingBars player={player} compact />
                  </div>
                ) : null}
                {!isCoachRound && !isStadiumRound && (isMystery ? (
                  <MysteryStats player={player} />
                ) : (
                  <CompactStats player={player} />
                ))}
                {isPicked && (
                  <div className="picked-overlay">DRAFTED</div>
                )}
                {!isMystery && player.funFact && (
                  <div className="player-fun-fact">{player.funFact}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showFirstPickTip && (
        <div className="first-pick-tip">
          Tap a player card to scout them, then draft!
        </div>
      )}

      <div className="card-pool-footer">
        Tap a player to view &amp; draft
      </div>

      {previewCard && (
        <PowerCardPreview
          card={previewCard}
          onConfirm={confirmUseCard}
          onCancel={() => setPreviewCard(null)}
          suggestion={cardSuggestions.get(previewCard.type)}
        />
      )}

      {showStealModal && (
        <StealPlayerModal
          title="Steal a Player"
          description="Choose a player to steal from your opponent"
          opponentRoster={opponentRoster.filter(p => !p.positions.includes('HC') && !p.positions.includes('ST'))}
          onSelect={(player) => {
            dispatch({ type: 'STEAL_PLAYER', fromPlayer: currentPick === 'player1' ? 'player2' : 'player1', playerId: player.id });
            setShowStealModal(false);
          }}
          onCancel={() => setShowStealModal(false)}
        />
      )}

      {showTradeModal && (
        <TradePickModal
          title="Trade Deadline"
          description="Swap one of your players with one from your opponent"
          yourRoster={currentTeam.roster.filter(p => !p.positions.includes('HC') && !p.positions.includes('ST'))}
          opponentRoster={opponentRoster.filter(p => !p.positions.includes('HC') && !p.positions.includes('ST'))}
          onTrade={(myPlayer, theirPlayer) => {
            dispatch({
              type: 'TRADE_PLAYERS',
              player1PlayerId: currentPick === 'player1' ? myPlayer.id : theirPlayer.id,
              player2PlayerId: currentPick === 'player1' ? theirPlayer.id : myPlayer.id,
            });
            setShowTradeModal(false);
          }}
          onCancel={() => setShowTradeModal(false)}
        />
      )}

      {previewPlayer && (
        <PlayerScoutingModal
          player={previewPlayer}
          onDraft={() => {
            pickPlayer(previewPlayer.id);
            playSound('draft_pick');
            setPreviewPlayer(null);
          }}
          onClose={() => setPreviewPlayer(null)}
        />
      )}

      {state.mysteryRevealPlayer && (
        <MysteryReveal
          player={state.mysteryRevealPlayer}
          onDismiss={() => dispatch({ type: 'DISMISS_MYSTERY_REVEAL' })}
        />
      )}

      {powerCardAnnouncement && (
        <PowerCardAnnouncement
          card={powerCardAnnouncement.card}
          player={powerCardAnnouncement.player}
          teamName={powerCardAnnouncement.player === 'player1' ? getShortName(state.team1.name) : getShortName(state.team2.name)}
          onDismiss={handleAnnouncementDismiss}
        />
      )}

      {showOnboarding && (
        <SpecialRoundOnboarding roundType={roundType} onDismiss={dismissOnboarding} />
      )}

      <RosterTracker
        roster={currentTeam.roster}
        gameMode={state.gameMode}
        teamName={currentTeam.name}
      />

      {state.powerCards.peekPool && (
        <div className="peek-modal-overlay" onClick={() => dispatch({ type: 'SET_PEEK_POOL', pool: null })}>
          <div className="peek-modal" onClick={(e) => e.stopPropagation()}>
            <div className="peek-header">
              <span className="peek-icon">🔮</span>
              <h3>Scout Report</h3>
              <p>Next round's available players:</p>
            </div>
            <div className="peek-players">
              {state.powerCards.peekPool.map((player) => {
                const rating = getOverallRating(player.overall);
                return (
                  <div key={player.id} className="peek-player-row">
                    <div className="player-overall" style={{ backgroundColor: rating.color }}>
                      {player.overall}
                    </div>
                    <div className="peek-player-info">
                      <span className="peek-player-name">{player.name}</span>
                      <div className="peek-player-meta">
                        <span className="player-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
                          {player.positions.join('/')}
                        </span>
                        <span className="player-team">{player.team}</span>
                      </div>
                    </div>
                    <CompactStats player={player} />
                  </div>
                );
              })}
            </div>
            <button className="peek-close-btn" onClick={() => dispatch({ type: 'SET_PEEK_POOL', pool: null })}>
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
