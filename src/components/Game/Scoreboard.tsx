import { GameState } from '../../types';
import './Scoreboard.css';

interface ScoreboardProps {
  gameState: GameState;
  awayTeamName: string;
  homeTeamName: string;
}

export function Scoreboard({ gameState, awayTeamName, homeTeamName }: ScoreboardProps) {
  const { inning, halfInning, outs, runners, score } = gameState;

  return (
    <div className="scoreboard">
      <div className="scoreboard-main">
        <div className="team-row away">
          <span className="team-name">{awayTeamName}</span>
          <span className="team-score">{score[0]}</span>
        </div>
        <div className="team-row home">
          <span className="team-name">{homeTeamName}</span>
          <span className="team-score">{score[1]}</span>
        </div>
      </div>

      <div className="scoreboard-info">
        <div className="inning-display">
          <span className="half-indicator">{halfInning === 'top' ? '▲' : '▼'}</span>
          <span className="inning-number">{inning}</span>
        </div>

        <div className="diamond">
          <div className={`base second ${runners[1] ? 'occupied' : ''}`}></div>
          <div className={`base third ${runners[2] ? 'occupied' : ''}`}></div>
          <div className={`base first ${runners[0] ? 'occupied' : ''}`}></div>
          <div className="home-plate"></div>
        </div>

        <div className="outs-display">
          <span className="outs-label">OUT</span>
          <div className="outs-dots">
            <span className={`out-dot ${outs >= 1 ? 'active' : ''}`}></span>
            <span className={`out-dot ${outs >= 2 ? 'active' : ''}`}></span>
          </div>
        </div>
      </div>
    </div>
  );
}
