import { Player, ActiveSynergies } from '../../types';
import { getPositionColor, getOverallRating, formatBattingAvg, formatERA } from '../../utils/helpers';
import { playerHasTeamSynergy } from '../../utils/synergy';
import './MatchupDisplay.css';

interface MatchupDisplayProps {
  batter: Player | null;
  pitcher: Player | null;
  batterSynergies: ActiveSynergies;
  pitcherSynergies: ActiveSynergies;
  batterTeamName: string;
  pitcherTeamName: string;
}

function PlayerCard({
  player,
  type,
  synergies,
  teamName,
}: {
  player: Player;
  type: 'batter' | 'pitcher';
  synergies: ActiveSynergies;
  teamName: string;
}) {
  const rating = getOverallRating(player.overall);
  const hasSynergy = playerHasTeamSynergy(player, synergies.teamSynergies);
  const isBatter = type === 'batter';

  return (
    <div className={`matchup-card ${type} ${hasSynergy ? 'has-synergy' : ''}`}>
      {hasSynergy && <div className="synergy-glow" />}
      <div className="card-header">
        <span className="team-label">{teamName}</span>
        <span className={`role-badge ${type}`}>{isBatter ? 'AT BAT' : 'PITCHING'}</span>
      </div>
      <div className="card-body">
        <div className="player-rating" style={{ backgroundColor: rating.color }}>
          {player.overall}
        </div>
        <div className="player-details">
          <span className="player-name">{player.name}</span>
          <div className="player-info">
            <span
              className="position-tag"
              style={{ backgroundColor: getPositionColor(player.positions[0]) }}
            >
              {player.positions[0]}
            </span>
            <span className="hand-info">
              {isBatter ? `Bats: ${player.bats}` : `Throws: ${player.throws}`}
            </span>
          </div>
        </div>
      </div>
      <div className="card-stats">
        {isBatter ? (
          <>
            <div className="stat">
              <span className="stat-value">{formatBattingAvg(player.stats.avg ?? 0)}</span>
              <span className="stat-label">AVG</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatBattingAvg(player.stats.obp ?? 0)}</span>
              <span className="stat-label">OBP</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatBattingAvg(player.stats.slg ?? 0)}</span>
              <span className="stat-label">SLG</span>
            </div>
          </>
        ) : (
          <>
            <div className="stat">
              <span className="stat-value">{formatERA(player.stats.era ?? 0)}</span>
              <span className="stat-label">ERA</span>
            </div>
            <div className="stat">
              <span className="stat-value">{(player.stats.whip ?? 0).toFixed(2)}</span>
              <span className="stat-label">WHIP</span>
            </div>
            <div className="stat">
              <span className="stat-value">{(player.stats.k9 ?? 0).toFixed(1)}</span>
              <span className="stat-label">K/9</span>
            </div>
          </>
        )}
      </div>
      {hasSynergy && (
        <div className="synergy-badge">
          <span className="synergy-icon">✨</span>
          <span className="synergy-text">+3%</span>
        </div>
      )}
    </div>
  );
}

export function MatchupDisplay({
  batter,
  pitcher,
  batterSynergies,
  pitcherSynergies,
  batterTeamName,
  pitcherTeamName,
}: MatchupDisplayProps) {
  if (!batter || !pitcher) {
    return null;
  }

  // Check for handedness advantage
  const hasHandednessAdvantage =
    (batter.bats === 'L' && pitcher.throws === 'R') ||
    (batter.bats === 'R' && pitcher.throws === 'L') ||
    batter.bats === 'S';

  return (
    <div className="matchup-display">
      <div className="matchup-header">
        <span className="matchup-title">Current At-Bat</span>
        {hasHandednessAdvantage && (
          <span className="advantage-badge batter">Platoon Advantage</span>
        )}
      </div>
      <div className="matchup-cards">
        <PlayerCard
          player={batter}
          type="batter"
          synergies={batterSynergies}
          teamName={batterTeamName}
        />
        <div className="vs-indicator">
          <span className="vs-text">VS</span>
        </div>
        <PlayerCard
          player={pitcher}
          type="pitcher"
          synergies={pitcherSynergies}
          teamName={pitcherTeamName}
        />
      </div>
    </div>
  );
}
