import { useState, useEffect, useMemo } from 'react';
import { SeriesState, Player } from '../../types';
import { GameResultCard } from './GameResultCard';
import { SeriesAwards } from './SeriesAwards';
import { SeriesStatsTable } from './SeriesStatsTable';
import { AllTimeRecords } from './AllTimeRecords';
import { aggregateSeriesStats, calculateAwards } from '../../utils/seriesStats';
import { checkAndUpdateRecords } from '../../utils/allTimeRecords';
import './SeriesRecap.css';

interface SeriesRecapProps {
  series: SeriesState;
  team1: { roster: Player[] };
  team2: { roster: Player[] };
  onViewFullStats: () => void;
  onPlayAgain: () => void;
  onGoHome?: () => void;
  team1Name?: string;
  team2Name?: string;
  isQuickGame?: boolean;
}

function getSeriesLabel(games: number): string {
  if (games === 4) return 'a dominant sweep';
  if (games === 5) return 'a convincing 5-game series';
  if (games === 6) return 'a hard-fought 6-game series';
  return 'an epic 7-game battle';
}

export function SeriesRecap({ series, team1, team2, onViewFullStats, onPlayAgain, onGoHome, team1Name = 'Team 1', team2Name = 'Team 2', isQuickGame = false }: SeriesRecapProps) {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [visibleGames, setVisibleGames] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  const player1Wins = series.games.filter(g => g.winner === 'player1').length;
  const player2Wins = series.games.filter(g => g.winner === 'player2').length;
  const winnerKey = player1Wins === 4 ? 'player1' : 'player2';
  const seriesWinner = winnerKey === 'player1' ? team1Name : team2Name;
  const seriesLoser = winnerKey === 'player1' ? team2Name : team1Name;

  // Aggregate stats and calculate awards
  const { batters, pitchers } = useMemo(
    () => aggregateSeriesStats(series, team1.roster, team2.roster),
    [series, team1.roster, team2.roster]
  );

  const awards = useMemo(
    () => calculateAwards(batters, pitchers, team1.roster, team2.roster),
    [batters, pitchers, team1.roster, team2.roster]
  );

  // Check and update all-time records
  const brokenRecords = useMemo(
    () => checkAndUpdateRecords(batters, pitchers),
    [batters, pitchers]
  );

  // Series highlights
  const highlights = useMemo(() => {
    const totalRuns = series.games.reduce((sum, g) => sum + g.score[0] + g.score[1], 0);
    const totalHRs = batters.reduce((sum, b) => sum + b.hr, 0);
    const walkoffs = series.games.filter(g => {
      const homeScore = g.score[1];
      const awayScore = g.score[0];
      return homeScore > awayScore && g.innings?.length && g.innings[g.innings.length - 1].home > 0;
    }).length;
    const shutouts = series.games.filter(g => g.score[0] === 0 || g.score[1] === 0).length;
    const closeGames = series.games.filter(g => Math.abs(g.score[0] - g.score[1]) <= 2).length;
    const extraInnings = series.games.filter(g => g.innings && g.innings.length > 9).length;
    const biggestWin = Math.max(...series.games.map(g => Math.abs(g.score[0] - g.score[1])));

    return { totalRuns, totalHRs, walkoffs, shutouts, closeGames, extraInnings, biggestWin };
  }, [series, batters]);

  // MVP (first award is always MVP)
  const mvp = awards.find(a => a.title === 'Series MVP') || awards[0];
  const otherAwards = awards.filter(a => a !== mvp);

  // Variable card reveal speed based on series length
  const gameCount = series.games.length;
  const cardRevealSpeed = gameCount <= 4 ? 250 : gameCount <= 6 ? 400 : 600;
  const winMargin = Math.abs(player1Wins - player2Wins);
  const isCloseFinish = winMargin <= 1;

  // Animation sequence
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Series score bars + summary (500ms)
    timers.push(setTimeout(() => setAnimationPhase(1), 500));

    // Phase 2+: Game cards at variable speed
    series.games.forEach((_, index) => {
      const isFinalCard = index === series.games.length - 1;
      const extraPause = isFinalCard && isCloseFinish ? 800 : 0;
      timers.push(setTimeout(() => setVisibleGames(index + 1), 1000 + index * cardRevealSpeed + (isFinalCard ? extraPause : 0)));
    });

    // Final phase: Awards reveal
    const totalCardTime = series.games.length * cardRevealSpeed + (isCloseFinish ? 800 : 0);
    timers.push(setTimeout(() => setAnimationPhase(2), 1000 + totalCardTime + 500));

    return () => timers.forEach(clearTimeout);
  }, [series.games.length, cardRevealSpeed, isCloseFinish]);

  return (
    <div className="series-recap">
      <div className={`recap-header ${animationPhase >= 0 ? 'visible' : ''}`}>
        <div className="trophy-animation">{isQuickGame ? '⚾' : '🏆'}</div>
        <h1>{isQuickGame ? 'GAME RECAP' : 'WORLD SERIES'}</h1>
        <h2>{seriesWinner} Wins!</h2>
        {!isQuickGame && (
          <p className="series-subtitle">
            {seriesWinner} defeated {seriesLoser} in {getSeriesLabel(gameCount)}
          </p>
        )}
      </div>

      {!isQuickGame && <div className={`series-score-display ${animationPhase >= 1 ? 'visible' : ''}`}>
        <div className="score-bar-container">
          <div className="team-score">
            <span className={`team-label ${winnerKey === 'player1' ? 'winner-label' : ''}`}>{team1Name}</span>
            <div className="score-bar">
              <div
                className="score-fill p1"
                style={{ width: animationPhase >= 1 ? `${(player1Wins / 4) * 100}%` : '0%' }}
              />
            </div>
            <span className={`wins-count ${winnerKey === 'player1' ? 'winner-count' : ''}`}>{player1Wins}</span>
          </div>
          <div className="team-score">
            <span className={`team-label ${winnerKey === 'player2' ? 'winner-label' : ''}`}>{team2Name}</span>
            <div className="score-bar">
              <div
                className="score-fill p2"
                style={{ width: animationPhase >= 1 ? `${(player2Wins / 4) * 100}%` : '0%' }}
              />
            </div>
            <span className={`wins-count ${winnerKey === 'player2' ? 'winner-count' : ''}`}>{player2Wins}</span>
          </div>
        </div>
      </div>}

      {/* Series Highlights */}
      <div className={`series-highlights ${animationPhase >= 1 ? 'visible' : ''}`}>
        <div className="highlight-chips">
          <div className="highlight-chip">
            <span className="chip-value">{highlights.totalRuns}</span>
            <span className="chip-label">Runs</span>
          </div>
          <div className="highlight-chip">
            <span className="chip-value">{highlights.totalHRs}</span>
            <span className="chip-label">Home Runs</span>
          </div>
          <div className="highlight-chip">
            <span className="chip-value">{gameCount}</span>
            <span className="chip-label">Games</span>
          </div>
          {highlights.walkoffs > 0 && (
            <div className="highlight-chip accent">
              <span className="chip-value">{highlights.walkoffs}</span>
              <span className="chip-label">Walk-offs</span>
            </div>
          )}
          {highlights.shutouts > 0 && (
            <div className="highlight-chip accent">
              <span className="chip-value">{highlights.shutouts}</span>
              <span className="chip-label">Shutouts</span>
            </div>
          )}
          {highlights.extraInnings > 0 && (
            <div className="highlight-chip accent">
              <span className="chip-value">{highlights.extraInnings}</span>
              <span className="chip-label">Extra Innings</span>
            </div>
          )}
        </div>
      </div>

      {/* MVP Spotlight */}
      {animationPhase >= 2 && mvp && (
        <div className={`mvp-spotlight ${mvp.team}`}>
          <div className="mvp-header">
            <span className="mvp-trophy">🏆</span>
            <span className="mvp-label">SERIES MVP</span>
          </div>
          <div className="mvp-name">{mvp.playerName}</div>
          <div className="mvp-stat-line">{mvp.statLine}</div>
        </div>
      )}

      {/* Top Hitters Leaderboard */}
      {animationPhase >= 2 && (
        <div className="leaders-section">
          <h3 className="leaders-title">Top Hitters</h3>
          <div className="leaders-table">
            <div className="leaders-header">
              <span className="ldr-rank">#</span>
              <span className="ldr-name">Player</span>
              <span className="ldr-stat">AVG</span>
              <span className="ldr-stat">HR</span>
              <span className="ldr-stat">RBI</span>
              <span className="ldr-stat">OPS</span>
            </div>
            {batters.filter(b => b.ab >= 3).slice(0, 5).map((b, i) => (
              <div key={b.playerId} className={`leaders-row ${b.team}`}>
                <span className="ldr-rank">{i + 1}</span>
                <span className="ldr-name">{b.name}</span>
                <span className="ldr-stat">{b.avg.toFixed(3)}</span>
                <span className="ldr-stat ldr-highlight">{b.hr}</span>
                <span className="ldr-stat">{b.rbi}</span>
                <span className="ldr-stat ldr-bold">{b.ops.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Pitchers Leaderboard */}
      {animationPhase >= 2 && (
        <div className="leaders-section">
          <h3 className="leaders-title">Top Pitchers</h3>
          <div className="leaders-table">
            <div className="leaders-header">
              <span className="ldr-rank">#</span>
              <span className="ldr-name">Player</span>
              <span className="ldr-stat">ERA</span>
              <span className="ldr-stat">W-L</span>
              <span className="ldr-stat">K</span>
              <span className="ldr-stat">IP</span>
            </div>
            {pitchers.filter(p => p.ip >= 1).slice(0, 5).map((p, i) => (
              <div key={p.playerId} className={`leaders-row ${p.team}`}>
                <span className="ldr-rank">{i + 1}</span>
                <span className="ldr-name">{p.name}</span>
                <span className="ldr-stat ldr-bold">{p.era.toFixed(2)}</span>
                <span className="ldr-stat">{p.wins}-{p.losses}</span>
                <span className="ldr-stat ldr-highlight">{p.so}</span>
                <span className="ldr-stat">{p.ip.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Awards Section */}
      {animationPhase >= 2 && otherAwards.length > 0 && (
        <SeriesAwards awards={otherAwards} />
      )}

      <div className="game-cards-container">
        <h3 className={`section-title ${animationPhase >= 1 ? 'visible' : ''}`}>Game-by-Game</h3>
        {series.games.map((game, index) => (
          <GameResultCard
            key={index}
            game={game}
            gameNumber={index + 1}
            visible={index < visibleGames}
            homeTeam={series.homeTeam}
            team1Name={team1Name}
            team2Name={team2Name}
          />
        ))}
      </div>

      {/* Broken Records */}
      {animationPhase >= 2 && brokenRecords.length > 0 && (
        <div className="broken-records">
          <h3 className="broken-records-title">Records Broken!</h3>
          <div className="broken-records-list">
            {brokenRecords.map((record) => (
              <div key={record.category} className="broken-record-card">
                <span className="new-record-badge">NEW RECORD!</span>
                <div className="broken-record-info">
                  <div className="broken-record-label">{record.label}</div>
                  <div className="broken-record-player">{record.playerName}</div>
                  <div className="broken-record-value">{record.value}</div>
                  {record.previousRecord && (
                    <div className="broken-record-prev">
                      Previous: {record.previousRecord.playerName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`recap-actions ${animationPhase >= 2 ? 'visible' : ''}`}>
        <div className="recap-actions-row">
          <button className="recap-btn secondary" onClick={() => setShowStats(!showStats)}>
            {showStats ? 'Hide Full Stats' : 'Full Stats'}
          </button>
          <button className="recap-btn secondary" onClick={onViewFullStats}>
            Box Scores
          </button>
          <button className="recap-btn secondary" onClick={() => setShowRecords(true)}>
            Records
          </button>
        </div>
        <div className="recap-actions-row">
          <button className="recap-btn primary" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="recap-btn home" onClick={onGoHome || onPlayAgain}>
            Main Menu
          </button>
        </div>
      </div>

      {/* Stats Table (toggled) */}
      {showStats && (
        <SeriesStatsTable batters={batters} pitchers={pitchers} team1Name={team1Name} team2Name={team2Name} />
      )}

      {/* All-Time Records Modal */}
      {showRecords && (
        <AllTimeRecords onClose={() => setShowRecords(false)} />
      )}
    </div>
  );
}
