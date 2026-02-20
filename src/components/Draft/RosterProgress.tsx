import { useDraft } from '../../hooks/useDraft';
import { useGame } from '../../context/GameContext';
import { Position } from '../../types';
import { getPositionLabel, getPositionColor } from '../../utils/helpers';
import { getShortName } from '../../utils/teamNames';
import './RosterProgress.css';

export function RosterProgress() {
  const { currentTeam, currentPick, positionCounts, requirements } = useDraft();
  const { state } = useGame();
  const teamName = currentPick === 'player1' ? getShortName(state.team1.name) : getShortName(state.team2.name);

  const positions = Object.keys(requirements) as Position[];
  const pitcherPositionSet = new Set(['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY']);
  const hitterPositions = positions.filter(p => !pitcherPositionSet.has(p));
  const pitcherPositions = positions.filter(p => pitcherPositionSet.has(p));

  const renderPositionRow = (pos: Position) => {
    const required = requirements[pos];
    const current = positionCounts[pos];
    const filled = current >= required;

    return (
      <div key={pos} className={`roster-position ${filled ? 'filled' : ''}`}>
        <div
          className="position-badge"
          style={{ backgroundColor: getPositionColor(pos) }}
        >
          {pos}
        </div>
        <div className="position-info">
          <span className="position-name">{getPositionLabel(pos)}</span>
          <span className="position-count">{current}/{required}</span>
        </div>
        <div className="position-progress">
          <div
            className="position-progress-bar"
            style={{
              width: `${Math.min(100, (current / required) * 100)}%`,
              backgroundColor: filled ? 'var(--color-accent)' : getPositionColor(pos),
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="roster-progress">
      <div className={`roster-header ${currentPick}`}>
        <h3>{teamName} Roster</h3>
        <span className="roster-count">{currentTeam.roster.length}/26 players</span>
      </div>

      <div className="roster-sections">
        <div className="roster-section">
          <h4 className="section-title">Hitters</h4>
          {hitterPositions.map(renderPositionRow)}
        </div>

        <div className="roster-section">
          <h4 className="section-title">Pitchers</h4>
          {pitcherPositions.map(renderPositionRow)}
        </div>
      </div>

      <div className="recent-picks">
        <h4 className="section-title">Recent Picks</h4>
        <div className="recent-picks-list">
          {currentTeam.roster.slice(-5).reverse().map((player) => (
            <div key={player.id} className="recent-pick">
              <span className="recent-pick-pos">{player.positions[0]}</span>
              <span className="recent-pick-name">{player.name}</span>
              <span className="recent-pick-overall">{player.overall}</span>
            </div>
          ))}
          {currentTeam.roster.length === 0 && (
            <div className="no-picks">No picks yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
