import { useState, useEffect } from 'react';
import { Player, Position, ROSTER_REQUIREMENTS, QUICK_ROSTER_REQUIREMENTS, GameMode } from '../../types';
import { getPositionColor } from '../../utils/helpers';
import './RosterTracker.css';

interface RosterTrackerProps {
  roster: Player[];
  gameMode: GameMode;
  teamName: string;
}

const POSITION_GROUPS = [
  { label: 'Lineup', positions: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as Position[] },
  { label: 'Bench', positions: ['BC', 'PH', 'PR', 'IFD', 'OFD'] as Position[] },
  { label: 'Pitching', positions: ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'] as Position[] },
  { label: 'Staff', positions: ['HC', 'ST'] as Position[] },
];

const QUICK_POSITION_GROUPS = [
  { label: 'Lineup', positions: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as Position[] },
  { label: 'Pitching', positions: ['SP', 'CL', 'MRP'] as Position[] },
  { label: 'Staff', positions: ['HC', 'ST'] as Position[] },
];

function getDisplayName(name: string): string {
  const parts = name.split(' ');
  if (parts.length === 1) return name;
  const suffixes = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III'];
  const last = parts[parts.length - 1];
  if (suffixes.includes(last) && parts.length > 2) return `${parts[parts.length - 2]} ${last}`;
  return last;
}

const ROSTER_TIP_KEY = 'dugout-draft-roster-tip-seen';

export function RosterTracker({ roster, gameMode, teamName }: RosterTrackerProps) {
  const [open, setOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(() => !localStorage.getItem(ROSTER_TIP_KEY));
  const reqs = gameMode === 'quick' ? QUICK_ROSTER_REQUIREMENTS : ROSTER_REQUIREMENTS;

  // Auto-dismiss tooltip after 5s
  useEffect(() => {
    if (!showTooltip) return;
    const t = setTimeout(() => {
      setShowTooltip(false);
      localStorage.setItem(ROSTER_TIP_KEY, 'seen');
    }, 5000);
    return () => clearTimeout(t);
  }, [showTooltip]);
  const groups = gameMode === 'quick' ? QUICK_POSITION_GROUPS : POSITION_GROUPS;

  // Count filled positions
  const posCounts: Partial<Record<Position, Player[]>> = {};
  roster.forEach(p => {
    const pos = p.positions[0];
    if (!posCounts[pos]) posCounts[pos] = [];
    posCounts[pos]!.push(p);
  });

  const totalNeeded = Object.entries(reqs).reduce((sum, [, v]) => sum + (v || 0), 0);
  const totalFilled = roster.length;
  const filledPct = totalNeeded > 0 ? Math.round((totalFilled / totalNeeded) * 100) : 0;

  return (
    <>
      <button
        className={`roster-tracker-btn${showTooltip ? ' roster-pulse' : ''}`}
        onClick={() => {
          setOpen(true);
          if (showTooltip) {
            setShowTooltip(false);
            localStorage.setItem(ROSTER_TIP_KEY, 'seen');
          }
        }}
      >
        <span className="roster-tracker-icon">📋</span>
        <span className="roster-tracker-count">{totalFilled}/{totalNeeded}</span>
      </button>
      {showTooltip && (
        <div className="roster-tooltip">Tap to view your roster</div>
      )}

      {open && (
        <div className="roster-tracker-overlay" onClick={() => setOpen(false)}>
          <div className="roster-tracker-panel" onClick={e => e.stopPropagation()}>
            <div className="roster-tracker-header">
              <h3>{teamName}'s Roster</h3>
              <div className="roster-tracker-progress">
                <div className="roster-tracker-bar">
                  <div
                    className="roster-tracker-fill"
                    style={{ width: `${filledPct}%` }}
                  />
                </div>
                <span className="roster-tracker-pct">{totalFilled}/{totalNeeded}</span>
              </div>
              <button className="roster-tracker-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="roster-tracker-groups">
              {groups.map(group => (
                <div key={group.label} className="roster-group">
                  <div className="roster-group-label">{group.label}</div>
                  <div className="roster-group-slots">
                    {group.positions.map(pos => {
                      const needed = reqs[pos] ?? 0;
                      if (needed === 0) return null;
                      const filled = posCounts[pos] || [];
                      return Array.from({ length: needed }, (_, i) => {
                        const player = filled[i];
                        return (
                          <div
                            key={`${pos}-${i}`}
                            className={`roster-slot ${player ? 'filled' : 'empty'}`}
                          >
                            <span
                              className="roster-slot-pos"
                              style={{ backgroundColor: getPositionColor(pos) }}
                            >
                              {pos}
                            </span>
                            {player ? (
                              <span className="roster-slot-name">
                                {getDisplayName(player.name)}
                                <span className="roster-slot-ovr">{player.overall}</span>
                              </span>
                            ) : (
                              <span className="roster-slot-empty">NEED</span>
                            )}
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
