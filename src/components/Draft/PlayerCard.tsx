import React from 'react';
import { Player } from '../../types';
import { formatBattingAvg, formatERA, getOverallRating, isPitcher } from '../../utils/helpers';
import './PlayerCard.css';

interface PlayerCardProps {
  player: Player;
  onSelect?: () => void;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  fillsNeed?: boolean;
}

export function PlayerCard({ player, onSelect, selected, disabled, compact, fillsNeed }: PlayerCardProps) {
  const rating = getOverallRating(player.overall);
  const pitcher = isPitcher(player);

  return (
    <div
      className={`player-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''} ${fillsNeed ? 'fills-need' : ''}`}
      onClick={!disabled && onSelect ? onSelect : undefined}
      style={{ '--rating-color': rating.color } as React.CSSProperties}
    >
      {fillsNeed && <div className="need-indicator">NEED</div>}
      <div className="player-card-header">
        <span className="player-overall">{player.overall}</span>
        <span className="player-positions">
          {player.positions.join('/')}
        </span>
      </div>

      <div className="player-card-body">
        <h3 className="player-name">{player.name}</h3>
        <span className="player-team">{player.team}</span>

        {!compact && (
          <div className="player-stats">
            {pitcher ? (
              <>
                <div className="stat">
                  <span className="stat-label">ERA</span>
                  <span className="stat-value">{formatERA(player.stats.era ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">WHIP</span>
                  <span className="stat-value">{(player.stats.whip ?? 0).toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">K/9</span>
                  <span className="stat-value">{(player.stats.k9 ?? 0).toFixed(1)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="stat">
                  <span className="stat-label">AVG</span>
                  <span className="stat-value">{formatBattingAvg(player.stats.avg ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">OBP</span>
                  <span className="stat-value">{formatBattingAvg(player.stats.obp ?? 0)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">SLG</span>
                  <span className="stat-value">{formatBattingAvg(player.stats.slg ?? 0)}</span>
                </div>
                {player.stats.hr !== undefined && (
                  <div className="stat">
                    <span className="stat-label">HR</span>
                    <span className="stat-value">{player.stats.hr}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="player-card-footer">
        <span className="player-hand">
          {pitcher ? `Throws: ${player.throws}` : `Bats: ${player.bats}`}
        </span>
      </div>
    </div>
  );
}
