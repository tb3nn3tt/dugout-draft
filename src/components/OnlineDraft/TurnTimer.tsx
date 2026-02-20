import './TurnTimer.css';

interface TurnTimerProps {
  seconds: number;
  isMyTurn: boolean;
}

export function TurnTimer({ seconds, isMyTurn }: TurnTimerProps) {
  const isLow = seconds <= 10;
  const isCritical = seconds <= 5;

  return (
    <div className={`turn-timer ${isLow ? 'low' : ''} ${isCritical ? 'critical' : ''} ${isMyTurn ? 'my-turn' : ''}`}>
      <div className="timer-bar">
        <div
          className="timer-fill"
          style={{ width: `${(seconds / 45) * 100}%` }}
        />
      </div>
      <span className="timer-text">
        {isMyTurn ? `Your turn: ${seconds}s` : 'Opponent\'s turn'}
      </span>
    </div>
  );
}
