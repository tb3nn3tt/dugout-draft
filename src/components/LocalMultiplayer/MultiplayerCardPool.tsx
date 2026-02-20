import { useState, useRef, useEffect } from 'react';
import { useLocalGame } from '../../contexts/LocalMultiplayerContext';
import { useGame } from '../../context/GameContext';
import { useDraft } from '../../hooks/useDraft';
import { Player, DraftRoundType } from '../../types';
import { getPositionColor, getOverallRating, isPitcher, getSpecialtyBadge, getCategoryBadge, gradeToLetter, getGradeColor } from '../../utils/helpers';
import { getShortName } from '../../utils/teamNames';
import { SpecialRoundBanner, getRoundType } from '../Draft/SpecialRoundBanner';
import { ScoutingBars } from '../Draft/ScoutingBars';
import { PlayerScoutingModal } from '../Draft/PlayerScoutingModal';
import { inferGradesFromStats } from '../../utils/simulation';
import { useSound } from '../../contexts/SoundContext';
import '../Draft/CardPool.css';

function StatChip({ label, grade }: { label: string; grade: number }) {
  return (
    <div className="stat-chip">
      <span className="stat-abbr">{label}</span>
      <span className="stat-grade" style={{ color: getGradeColor(grade) }}>{gradeToLetter(grade)}</span>
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
    case 'mystery': return 'mystery-card';
    default: return '';
  }
}

function getSpecialBadge(roundType: DraftRoundType): string {
  switch (roundType) {
    case 'legends': return '';
    case 'peak': return '';
    case 'fictional': return '';
    case 'niners': return '';
    case 'decade_classic': return '';
    case 'decade_modern': return '';
    case 'playoff_heroes': return '';
    case 'one_year_wonders': return '';
    case 'mystery': return '';
    default: return '';
  }
}

export function MultiplayerCardPool() {
  const { state } = useGame();
  const { isMyTurn, pickPlayer: mpPickPlayer, myRole } = useLocalGame();
  const { cardPool, pickNumber, progress, neededPositions, mustFillNeed } = useDraft();
  const { playSound } = useSound();
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null);

  const roundType = getRoundType(pickNumber);

  // 30-second draft timer
  const [timer, setTimer] = useState(30);
  const draftTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Reset timer when pick number changes
  useEffect(() => {
    setTimer(30);
  }, [pickNumber]);

  // Countdown - only when it's my turn
  useEffect(() => {
    if (!isMyTurn) {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
      return;
    }
    draftTimerRef.current = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    return () => { if (draftTimerRef.current) clearInterval(draftTimerRef.current); };
  }, [pickNumber, isMyTurn]);

  // Auto-pick when timer expires
  useEffect(() => {
    if (timer > 0 || !isMyTurn) return;
    const available = cardPool.filter(p => !state.pickedFromPool.includes(p.id));
    if (available.length > 0) {
      // Prefer need-filling cards, especially when must-fill is active
      const needFilling = available.filter(p => playerFillsNeed(p));
      const pool = needFilling.length > 0 ? needFilling : available;
      const best = [...pool].sort((a, b) => b.overall - a.overall)[0];
      mpPickPlayer(best.id);
    }
  }, [timer, isMyTurn, cardPool, state.pickedFromPool, mpPickPlayer]);


  const playerFillsNeed = (player: Player): boolean => {
    return player.positions.some(pos => neededPositions.includes(pos));
  };

  const isMystery = getRoundType(pickNumber) === 'mystery';

  const handlePick = (playerId: string) => {
    if (!isMyTurn) return;
    if (state.pickedFromPool.includes(playerId)) return;
    // Block non-need picks when must-fill (except mystery rounds where identity is hidden)
    if (mustFillNeed && !isMystery) {
      const player = cardPool.find(p => p.id === playerId);
      if (player && !playerFillsNeed(player)) return;
    }
    mpPickPlayer(playerId);
    playSound('draft_pick');
  };

  const round = getPoolTier(cardPool);
  const roundNumber = Math.ceil(pickNumber / 2);
  const isSpecialRound = roundType !== 'normal';
  const specialCardClass = getSpecialCardClass(roundType);
  const specialBadge = getSpecialBadge(roundType);

  return (
    <div className="card-pool">
      {!isMyTurn && (
        <div className="cpu-thinking-overlay">
          <div className="cpu-thinking-content">
            <span className="cpu-icon">⏳</span>
            <span className="cpu-text">Waiting for opponent...</span>
          </div>
        </div>
      )}

      {isSpecialRound && (
        <SpecialRoundBanner roundType={roundType} roundNumber={roundNumber} />
      )}

      <div className={`card-pool-header ${state.currentPick}-turn`}>
        <div className="turn-indicator">
          <span className={`turn-badge ${state.currentPick}`}>
            {state.currentPick === myRole ? "Your Turn" : "Opponent's Turn"}
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
        {isMyTurn && (
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

      <div className="player-list">
        {cardPool.map((player) => {
          const isPicked = state.pickedFromPool.includes(player.id);
          const fillsNeed = !isPicked && playerFillsNeed(player);
          const needLocked = !isPicked && mustFillNeed && !isMystery && !fillsNeed;
          const rating = getOverallRating(player.overall);
          const playerEra = player.era;
          const playerNickname = player.nickname;
          const specialty = getSpecialtyBadge(player);
          const categoryBadge = getCategoryBadge(player.category);

          return (
            <div
              key={player.id}
              className={`player-row ${isPicked ? 'picked' : ''} ${fillsNeed && !isMystery ? 'fills-need' : ''} ${needLocked ? 'pos-full' : ''} ${isSpecialRound ? specialCardClass : ''} ${player.category ? `category-${player.category}` : ''} ${!isMyTurn ? 'disabled' : ''}`}
              onClick={() => {
                if (isPicked || !isMyTurn || needLocked) return;
                setPreviewPlayer(player);
              }}
            >
              {(isSpecialRound && specialBadge) || categoryBadge ? (
                <span className="special-badge">{categoryBadge || specialBadge}</span>
              ) : null}
              <div className="player-overall" style={{ backgroundColor: rating.color }}>
                {player.overall}
              </div>
              <div className="player-main">
                <div className="player-name-row">
                  <span className="player-name">{player.name}</span>
                  {fillsNeed && <span className="need-tag">NEED</span>}
                </div>
                {playerNickname && (
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
                {playerEra && (
                  <div className="era-tag">{playerEra}</div>
                )}
                {specialty && (
                  <div className="specialty-badge">{specialty}</div>
                )}
              </div>
              <div className="player-grades desktop-only">
                <ScoutingBars player={player} compact />
              </div>
              <CompactStats player={player} />
              {isPicked && (
                <div className="picked-overlay">DRAFTED</div>
              )}
              {player.funFact && (
                <div className="player-fun-fact">{player.funFact}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card-pool-footer">
        {isMyTurn ? 'Tap a player to view & draft' : 'Waiting for opponent...'}
      </div>

      {previewPlayer && (
        <PlayerScoutingModal
          player={previewPlayer}
          onDraft={() => {
            if (isMyTurn) {
              handlePick(previewPlayer.id);
            }
            setPreviewPlayer(null);
          }}
          onClose={() => setPreviewPlayer(null)}
        />
      )}
    </div>
  );
}
