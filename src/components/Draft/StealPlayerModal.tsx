import { useState } from 'react';
import { Player } from '../../types';
import { getPositionColor, getOverallRating, isPitcher, formatBattingAvg, formatERA } from '../../utils/helpers';
import './StealPlayerModal.css';

interface StealPlayerModalProps {
  title: string;
  description: string;
  opponentRoster: Player[];
  onSelect: (player: Player) => void;
  onCancel: () => void;
}

export function StealPlayerModal({
  title,
  description,
  opponentRoster,
  onSelect,
  onCancel,
}: StealPlayerModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  return (
    <div className="steal-modal-overlay" onClick={onCancel}>
      <div className="steal-modal" onClick={e => e.stopPropagation()}>
        <div className="steal-modal-header">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="steal-player-list">
          {opponentRoster.map(player => {
            const rating = getOverallRating(player.overall);
            const pitcher = isPitcher(player);
            const isSelected = selectedPlayer?.id === player.id;

            return (
              <div
                key={player.id}
                className={`steal-player-row ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedPlayer(player)}
              >
                <div className="steal-player-overall" style={{ backgroundColor: rating.color }}>
                  {player.overall}
                </div>
                <div className="steal-player-info">
                  <span className="steal-player-name">{player.name}</span>
                  <div className="steal-player-meta">
                    <span
                      className="steal-player-pos"
                      style={{ backgroundColor: getPositionColor(player.positions[0]) }}
                    >
                      {player.positions.join('/')}
                    </span>
                    <span className="steal-player-team">{player.team}</span>
                  </div>
                </div>
                <div className="steal-player-stats">
                  {pitcher ? (
                    <span className="steal-stat">{formatERA(player.stats.era ?? 0)} ERA</span>
                  ) : (
                    <span className="steal-stat">{formatBattingAvg(player.stats.avg ?? 0)} AVG</span>
                  )}
                </div>
                {isSelected && <span className="selected-check">✓</span>}
              </div>
            );
          })}
        </div>

        <div className="steal-modal-actions">
          <button className="steal-btn cancel" onClick={onCancel}>Cancel</button>
          <button
            className="steal-btn confirm"
            onClick={() => selectedPlayer && onSelect(selectedPlayer)}
            disabled={!selectedPlayer}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}

interface TradePickModalProps {
  title: string;
  description: string;
  yourRoster: Player[];
  opponentRoster: Player[];
  onTrade: (yourPlayer: Player, theirPlayer: Player) => void;
  onCancel: () => void;
}

export function TradePickModal({
  title,
  description,
  yourRoster,
  opponentRoster,
  onTrade,
  onCancel,
}: TradePickModalProps) {
  const [yourPlayer, setYourPlayer] = useState<Player | null>(null);
  const [theirPlayer, setTheirPlayer] = useState<Player | null>(null);

  const renderPlayerList = (
    roster: Player[],
    selected: Player | null,
    onSelect: (p: Player) => void,
    label: string
  ) => (
    <div className="trade-column">
      <h3 className="trade-column-title">{label}</h3>
      <div className="trade-player-list">
        {roster.map(player => {
          const rating = getOverallRating(player.overall);
          const isSelected = selected?.id === player.id;

          return (
            <div
              key={player.id}
              className={`trade-player-row ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(player)}
            >
              <div className="trade-player-overall" style={{ backgroundColor: rating.color }}>
                {player.overall}
              </div>
              <div className="trade-player-info">
                <span className="trade-player-name">{player.name}</span>
                <span
                  className="trade-player-pos"
                  style={{ backgroundColor: getPositionColor(player.positions[0]) }}
                >
                  {player.positions[0]}
                </span>
              </div>
              {isSelected && <span className="selected-check">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="steal-modal-overlay" onClick={onCancel}>
      <div className="steal-modal trade-modal" onClick={e => e.stopPropagation()}>
        <div className="steal-modal-header">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="trade-columns">
          {renderPlayerList(yourRoster, yourPlayer, setYourPlayer, 'Your Player')}
          <div className="trade-arrow">⇄</div>
          {renderPlayerList(opponentRoster, theirPlayer, setTheirPlayer, 'Their Player')}
        </div>

        <div className="steal-modal-actions">
          <button className="steal-btn cancel" onClick={onCancel}>Cancel</button>
          <button
            className="steal-btn confirm"
            onClick={() => yourPlayer && theirPlayer && onTrade(yourPlayer, theirPlayer)}
            disabled={!yourPlayer || !theirPlayer}
          >
            Complete Trade
          </button>
        </div>
      </div>
    </div>
  );
}
