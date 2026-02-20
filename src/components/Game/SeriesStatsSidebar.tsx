import { useState, useMemo } from 'react';
import { SeriesState, Player } from '../../types';
import { aggregateSeriesStats } from '../../utils/seriesStats';
import './SeriesStatsSidebar.css';

interface SeriesStatsSidebarProps {
  series: SeriesState;
  team1Roster: Player[];
  team2Roster: Player[];
}

export function SeriesStatsSidebar({ series, team1Roster, team2Roster }: SeriesStatsSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { batters, pitchers } = useMemo(
    () => aggregateSeriesStats(series, team1Roster, team2Roster),
    [series, team1Roster, team2Roster, series.games.length]
  );

  // Filter: min 3 AB for batting, min 1 IP for pitching
  const qualifiedBatters = batters.filter(b => b.ab >= 3);
  const qualifiedPitchers = pitchers.filter(p => p.ip >= 1);

  const avgLeaders = [...qualifiedBatters].sort((a, b) => b.avg - a.avg).slice(0, 3);
  const hrLeaders = [...qualifiedBatters].sort((a, b) => b.hr - a.hr).filter(b => b.hr > 0).slice(0, 3);
  const eraLeaders = [...qualifiedPitchers].sort((a, b) => a.era - b.era).slice(0, 3);

  if (series.games.length === 0) return null;

  return (
    <>
      <button
        className={`stats-sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? 'Close' : 'Stats'}
      </button>

      {isOpen && (
        <div className="stats-sidebar">
          <div className="stats-sidebar-header">
            <h3>Series Stats</h3>
            <span className="games-played">{series.games.length} game{series.games.length !== 1 ? 's' : ''}</span>
          </div>

          {avgLeaders.length > 0 && (
            <div className="stat-section">
              <h4>Batting Avg</h4>
              {avgLeaders.map(b => (
                <div key={b.playerId} className={`stat-row ${b.team}`}>
                  <span className="stat-name">{b.name}</span>
                  <span className="stat-value">{b.avg.toFixed(3)}</span>
                </div>
              ))}
            </div>
          )}

          {hrLeaders.length > 0 && (
            <div className="stat-section">
              <h4>Home Runs</h4>
              {hrLeaders.map(b => (
                <div key={b.playerId} className={`stat-row ${b.team}`}>
                  <span className="stat-name">{b.name}</span>
                  <span className="stat-value">{b.hr}</span>
                </div>
              ))}
            </div>
          )}

          {eraLeaders.length > 0 && (
            <div className="stat-section">
              <h4>ERA Leaders</h4>
              {eraLeaders.map(p => (
                <div key={p.playerId} className={`stat-row ${p.team}`}>
                  <span className="stat-name">{p.name}</span>
                  <span className="stat-value">{p.era.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
