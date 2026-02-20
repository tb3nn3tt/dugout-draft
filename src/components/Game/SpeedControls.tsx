import { SimulationSpeed } from '../../types';
import './SpeedControls.css';

interface SpeedControlsProps {
  speed: SimulationSpeed;
  onSpeedChange: (speed: SimulationSpeed) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onSkipInning: () => void;
}

const SPEED_OPTIONS: { value: SimulationSpeed; label: string; icon: string }[] = [
  { value: 'slow', label: 'Slow', icon: '🐢' },
  { value: 'normal', label: 'Normal', icon: '▶️' },
  { value: 'fast', label: 'Fast', icon: '⏩' },
  { value: 'instant', label: 'Instant', icon: '⚡' },
];

export function SpeedControls({
  speed,
  onSpeedChange,
  isPaused,
  onTogglePause,
  onSkipInning,
}: SpeedControlsProps) {
  return (
    <div className="speed-controls">
      <div className="speed-controls-header">
        <span className="controls-label">Simulation Speed</span>
      </div>

      <div className="controls-row">
        <button
          className={`control-btn pause-btn ${isPaused ? 'paused' : ''}`}
          onClick={onTogglePause}
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>

        <div className="speed-buttons">
          {SPEED_OPTIONS.map(option => (
            <button
              key={option.value}
              className={`speed-btn ${speed === option.value ? 'active' : ''}`}
              onClick={() => onSpeedChange(option.value)}
              title={option.label}
            >
              <span className="speed-icon">{option.icon}</span>
              <span className="speed-label">{option.label}</span>
            </button>
          ))}
        </div>

        <button
          className="control-btn skip-btn"
          onClick={onSkipInning}
          title="Skip to end of inning"
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
