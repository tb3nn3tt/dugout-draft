import { Player } from '../../types';
import { formatBattingAvg, formatERA } from '../../utils/helpers';
import './AtBat.css';

interface AtBatProps {
  batter: Player | null;
  pitcher: Player | null;
}

export function AtBat({ batter, pitcher }: AtBatProps) {
  if (!batter || !pitcher) {
    return (
      <div className="at-bat">
        <div className="at-bat-waiting">Waiting for game to start...</div>
      </div>
    );
  }

  return (
    <div className="at-bat">
      <div className="matchup">
        <div className="matchup-player batter">
          <div className="player-label">AT BAT</div>
          <div className="player-card-mini">
            <div className="player-overall">{batter.overall}</div>
            <div className="player-details">
              <span className="player-name">{batter.name}</span>
              <span className="player-pos">{batter.positions[0]}</span>
            </div>
            <div className="player-stats-mini">
              <span>{formatBattingAvg(batter.stats.avg ?? 0)} AVG</span>
              <span>{batter.stats.hr ?? 0} HR</span>
            </div>
          </div>
        </div>

        <div className="vs-badge">VS</div>

        <div className="matchup-player pitcher">
          <div className="player-label">PITCHING</div>
          <div className="player-card-mini">
            <div className="player-overall">{pitcher.overall}</div>
            <div className="player-details">
              <span className="player-name">{pitcher.name}</span>
              <span className="player-pos">{pitcher.positions[0]}</span>
            </div>
            <div className="player-stats-mini">
              <span>{formatERA(pitcher.stats.era ?? 0)} ERA</span>
              <span>{(pitcher.stats.k9 ?? 0).toFixed(1)} K/9</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
