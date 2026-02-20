import { useState } from 'react';
import { AggregatedBatterStats, AggregatedPitcherStats } from '../../utils/seriesStats';
import { getTeamInitials } from '../../utils/teamNames';
import './SeriesStatsTable.css';

interface SeriesStatsTableProps {
  batters: AggregatedBatterStats[];
  pitchers: AggregatedPitcherStats[];
  team1Name?: string;
  team2Name?: string;
}

type BatterSortKey = 'avg' | 'hr' | 'rbi' | 'ops' | 'h' | 'r' | 'so' | 'bb';
type PitcherSortKey = 'era' | 'so' | 'wins' | 'ip' | 'whip';
type TeamFilter = 'all' | 'player1' | 'player2';

function formatAvg(val: number): string {
  if (val >= 1) return '1.000';
  return '.' + Math.round(val * 1000).toString().padStart(3, '0');
}

function formatIP(ip: number): string {
  const full = Math.floor(ip);
  const frac = ip - full;
  if (frac < 0.1) return `${full}.0`;
  if (frac < 0.4) return `${full}.1`;
  if (frac < 0.7) return `${full}.2`;
  return `${full}.0`;
}

export function SeriesStatsTable({ batters, pitchers, team1Name = 'Team 1', team2Name = 'Team 2' }: SeriesStatsTableProps) {
  const [tab, setTab] = useState<'batting' | 'pitching'>('batting');
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('all');
  const [batterSort, setBatterSort] = useState<BatterSortKey>('ops');
  const [pitcherSort, setPitcherSort] = useState<PitcherSortKey>('era');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredBatters = batters
    .filter(b => teamFilter === 'all' || b.team === teamFilter)
    .filter(b => b.ab > 0)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      return (a[batterSort] - b[batterSort]) * dir;
    });

  const filteredPitchers = pitchers
    .filter(p => teamFilter === 'all' || p.team === teamFilter)
    .filter(p => p.ip > 0)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      return (a[pitcherSort] - b[pitcherSort]) * dir;
    });

  function handleBatterSort(key: BatterSortKey) {
    if (batterSort === key) {
      setSortAsc(!sortAsc);
    } else {
      setBatterSort(key);
      setSortAsc(key === 'so'); // SO sorts ascending by default (fewer is better)
    }
  }

  function handlePitcherSort(key: PitcherSortKey) {
    if (pitcherSort === key) {
      setSortAsc(!sortAsc);
    } else {
      setPitcherSort(key);
      // ERA, WHIP sort ascending (lower is better); SO, wins sort descending
      setSortAsc(key === 'era' || key === 'whip');
    }
  }

  const sortIndicator = (active: boolean) => active ? (sortAsc ? ' ▲' : ' ▼') : '';

  return (
    <div className="stats-table-container">
      <div className="stats-tabs">
        <button
          className={`stats-tab ${tab === 'batting' ? 'active' : ''}`}
          onClick={() => setTab('batting')}
        >
          Batting Leaders
        </button>
        <button
          className={`stats-tab ${tab === 'pitching' ? 'active' : ''}`}
          onClick={() => setTab('pitching')}
        >
          Pitching Leaders
        </button>
      </div>

      <div className="team-filter">
        {(['all', 'player1', 'player2'] as TeamFilter[]).map(f => (
          <button
            key={f}
            className={`filter-btn ${teamFilter === f ? 'active' : ''}`}
            onClick={() => setTeamFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'player1' ? getTeamInitials(team1Name) : getTeamInitials(team2Name)}
          </button>
        ))}
      </div>

      {tab === 'batting' ? (
        <div className="stats-table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="sticky-col">Player</th>
                <th>AB</th>
                <th className="sortable" onClick={() => handleBatterSort('h')}>
                  H{sortIndicator(batterSort === 'h')}
                </th>
                <th className="sortable hide-mobile" onClick={() => handleBatterSort('r')}>
                  R{sortIndicator(batterSort === 'r')}
                </th>
                <th className="sortable" onClick={() => handleBatterSort('hr')}>
                  HR{sortIndicator(batterSort === 'hr')}
                </th>
                <th className="sortable" onClick={() => handleBatterSort('rbi')}>
                  RBI{sortIndicator(batterSort === 'rbi')}
                </th>
                <th className="sortable hide-mobile" onClick={() => handleBatterSort('bb')}>
                  BB{sortIndicator(batterSort === 'bb')}
                </th>
                <th className="sortable hide-mobile" onClick={() => handleBatterSort('so')}>
                  SO{sortIndicator(batterSort === 'so')}
                </th>
                <th className="sortable" onClick={() => handleBatterSort('avg')}>
                  AVG{sortIndicator(batterSort === 'avg')}
                </th>
                <th className="sortable" onClick={() => handleBatterSort('ops')}>
                  OPS{sortIndicator(batterSort === 'ops')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBatters.map(b => (
                <tr key={b.playerId} className={b.team}>
                  <td className="sticky-col player-cell">
                    <span className={`team-dot ${b.team}`} />
                    <span className="stat-player-name">{b.name}</span>
                  </td>
                  <td>{b.ab}</td>
                  <td>{b.h}</td>
                  <td className="hide-mobile">{b.r}</td>
                  <td className={b.hr > 0 ? 'highlight' : ''}>{b.hr}</td>
                  <td className={b.rbi > 0 ? 'highlight' : ''}>{b.rbi}</td>
                  <td className="hide-mobile">{b.bb}</td>
                  <td className="hide-mobile">{b.so}</td>
                  <td className={b.avg >= 0.300 ? 'highlight' : ''}>{formatAvg(b.avg)}</td>
                  <td className={b.ops >= 0.900 ? 'highlight' : ''}>{b.ops.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="stats-table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="sticky-col">Player</th>
                <th className="sortable" onClick={() => handlePitcherSort('ip')}>
                  IP{sortIndicator(pitcherSort === 'ip')}
                </th>
                <th className="hide-mobile">H</th>
                <th className="hide-mobile">R</th>
                <th className="hide-mobile">BB</th>
                <th className="sortable" onClick={() => handlePitcherSort('so')}>
                  K{sortIndicator(pitcherSort === 'so')}
                </th>
                <th className="sortable" onClick={() => handlePitcherSort('wins')}>
                  W-L{sortIndicator(pitcherSort === 'wins')}
                </th>
                <th>SV</th>
                <th className="sortable" onClick={() => handlePitcherSort('era')}>
                  ERA{sortIndicator(pitcherSort === 'era')}
                </th>
                <th className="sortable" onClick={() => handlePitcherSort('whip')}>
                  WHIP{sortIndicator(pitcherSort === 'whip')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPitchers.map(p => (
                <tr key={p.playerId} className={p.team}>
                  <td className="sticky-col player-cell">
                    <span className={`team-dot ${p.team}`} />
                    <span className="stat-player-name">{p.name}</span>
                  </td>
                  <td>{formatIP(p.ip)}</td>
                  <td className="hide-mobile">{p.h}</td>
                  <td className="hide-mobile">{p.r}</td>
                  <td className="hide-mobile">{p.bb}</td>
                  <td>{p.so}</td>
                  <td>{p.wins}-{p.losses}</td>
                  <td>{p.saves}</td>
                  <td className={p.era < 3.0 && p.ip >= 3 ? 'highlight' : ''}>{p.era.toFixed(2)}</td>
                  <td className={p.whip < 1.2 && p.ip >= 3 ? 'highlight' : ''}>{p.whip.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
