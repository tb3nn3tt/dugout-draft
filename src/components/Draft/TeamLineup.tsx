import { useState } from 'react';
import { Player, Position, ROSTER_REQUIREMENTS } from '../../types';
import { getPositionColor, getDisplayName } from '../../utils/helpers';
import { getShortName } from '../../utils/teamNames';
import './TeamLineup.css';

interface TeamLineupProps {
  team1Roster: Player[];
  team2Roster: Player[];
  currentPick: 'player1' | 'player2';
  team1Name?: string;
  team2Name?: string;
  isOnline?: boolean;
  myRole?: 'player1' | 'player2';
}

const ALL_POSITIONS: Position[] = [
  'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH',
  'BC', 'PH', 'PR', 'IFD', 'OFD',
  'SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY',
];

function getPlayersAtPosition(roster: Player[], position: Position): Player[] {
  return roster.filter(p => p.positions[0] === position);
}

function RosterColumn({ roster, label, isActive }: { roster: Player[]; label: string; isActive: boolean }) {
  return (
    <div className={`roster-column ${isActive ? 'active' : ''}`}>
      <div className="column-header">
        <span className="column-label">{label}</span>
        <span className="column-count">{roster.length}/26</span>
      </div>
      <div className="positions-list">
        {ALL_POSITIONS.map(pos => {
          const players = getPlayersAtPosition(roster, pos);
          const required = ROSTER_REQUIREMENTS[pos];
          const filled = players.length >= required;

          return (
            <div key={pos} className={`position-row ${filled ? 'filled' : 'needed'}`}>
              <div
                className="pos-badge"
                style={{ backgroundColor: getPositionColor(pos) }}
              >
                {pos}
              </div>
              <div className="pos-players">
                {players.length > 0 ? (
                  players.map(p => (
                    <span key={p.id} className="player-chip">
                      {getDisplayName(p.name)} <span className="ovr">{p.overall}</span>
                    </span>
                  ))
                ) : (
                  <span className="empty-slot">-</span>
                )}
              </div>
              <div className="pos-count">{players.length}/{required}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamLineup({ team1Roster, team2Roster, currentPick, team1Name = 'Team 1', team2Name = 'Team 2', isOnline, myRole }: TeamLineupProps) {
  const [viewingTeam, setViewingTeam] = useState<'player1' | 'player2'>(isOnline && myRole ? myRole : currentPick);
  const [isExpanded, setIsExpanded] = useState(false);

  // In online mode, only show your own detailed roster; opponent's is hidden
  const currentRoster = viewingTeam === 'player1' ? team1Roster : team2Roster;
  return (
    <div className={`team-lineup ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div
        className="lineup-header-mobile"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="roster-summary">
          <span className={`team-indicator ${viewingTeam}`}>
            {getShortName(viewingTeam === 'player1' ? team1Name : team2Name)}
          </span>
          <span className="roster-count">{currentRoster.length}/26</span>
        </span>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'} Roster</span>
      </div>

      <div className="lineup-content">
        <div className="lineup-toggle">
          <button
            className={`toggle-side ${viewingTeam === 'player1' ? 'active' : ''}`}
            onClick={() => setViewingTeam('player1')}
          >
            {getShortName(team1Name)} {currentPick === 'player1' && '*'}
          </button>
          <div className="toggle-slider">
            <div
              className={`slider-thumb ${viewingTeam}`}
              onClick={() => setViewingTeam(v => v === 'player1' ? 'player2' : 'player1')}
            />
          </div>
          <button
            className={`toggle-side ${viewingTeam === 'player2' ? 'active' : ''}`}
            onClick={() => setViewingTeam('player2')}
          >
            {getShortName(team2Name)} {currentPick === 'player2' && '*'}
          </button>
        </div>

        <div className="roster-view">
          <RosterColumn
            roster={currentRoster}
            label={viewingTeam === 'player1' ? team1Name : team2Name}
            isActive={viewingTeam === currentPick}
          />
        </div>
      </div>
    </div>
  );
}
