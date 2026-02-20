import { GameState, PressureLevel } from '../../types';
import { getGameSituation, getPressureColor } from '../../utils/gameNarrative';
import './GameSituationBanner.css';

interface GameSituationBannerProps {
  gameState: GameState;
}

function PressureIndicator({ pressure }: { pressure: PressureLevel }) {
  const labels: Record<PressureLevel, string> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    clutch: 'CLUTCH',
  };

  return (
    <div className={`pressure-indicator ${pressure}`}>
      <span className="pressure-label">PRESSURE</span>
      <span className="pressure-level" style={{ color: getPressureColor(pressure) }}>
        {labels[pressure]}
      </span>
      <div className="pressure-bars">
        <div className={`bar ${pressure !== 'low' ? 'filled' : ''}`} />
        <div className={`bar ${pressure === 'high' || pressure === 'clutch' ? 'filled' : ''}`} />
        <div className={`bar ${pressure === 'clutch' ? 'filled' : ''}`} />
      </div>
    </div>
  );
}

export function GameSituationBanner({ gameState }: GameSituationBannerProps) {
  const situation = getGameSituation(gameState);
  const { score, runners, outs } = gameState;

  return (
    <div className={`game-situation-banner ${situation.pressure}`}>
      {situation.isClutch && <div className="clutch-glow" />}

      <div className="situation-content">
        <div className="situation-main">
          <span className="situation-description">{situation.description}</span>
          <span className="runner-situation">{situation.runnerSituation}</span>
        </div>

        <div className="situation-details">
          <div className="score-display">
            <span className="score">{score[0]} - {score[1]}</span>
          </div>

          <div className="diamond-mini">
            <div className={`base second ${runners[1] ? 'occupied' : ''}`} />
            <div className="diamond-row">
              <div className={`base third ${runners[2] ? 'occupied' : ''}`} />
              <div className="home-plate" />
              <div className={`base first ${runners[0] ? 'occupied' : ''}`} />
            </div>
          </div>

          <div className="outs-display">
            <span className="outs-label">OUTS</span>
            <div className="outs-dots">
              <div className={`out-dot ${outs >= 1 ? 'active' : ''}`} />
              <div className={`out-dot ${outs >= 2 ? 'active' : ''}`} />
            </div>
          </div>

          <PressureIndicator pressure={situation.pressure} />
        </div>
      </div>
    </div>
  );
}
