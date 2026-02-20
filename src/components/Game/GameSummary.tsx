import { GameResult, GameBoxScore } from '../../types';
import { getDisplayName } from '../../utils/helpers';
import './GameSummary.css';

interface GameSummaryProps {
  game: GameResult;
  gameNumber: number;
  awayName: string;
  homeName: string;
  onContinue: () => void;
}

function findDecisions(boxScore: GameBoxScore) {
  let wp: string | null = null;
  let lp: string | null = null;
  let sv: string | null = null;

  [boxScore.away, boxScore.home].forEach(teamBox => {
    teamBox.pitchers.forEach(p => {
      if (p.decision === 'W') wp = p.name;
      if (p.decision === 'L') lp = p.name;
      if (p.decision === 'S') sv = p.name;
    });
  });

  return { wp, lp, sv };
}

function findHRs(boxScore: GameBoxScore): string[] {
  const hrs: string[] = [];
  [boxScore.away, boxScore.home].forEach(teamBox => {
    teamBox.batters.forEach(b => {
      if (b.hr > 0) {
        const displayName = getDisplayName(b.name);
        hrs.push(b.hr > 1 ? `${displayName} (${b.hr})` : `${displayName}`);
      }
    });
  });
  return hrs;
}

export function GameSummary({ game, gameNumber, awayName, homeName, onContinue }: GameSummaryProps) {
  const boxScore = game.boxScore;
  const decisions = boxScore ? findDecisions(boxScore) : { wp: null, lp: null, sv: null };
  const hrs = boxScore ? findHRs(boxScore) : [];

  const awayWon = game.score[0] > game.score[1];
  const isWalkoff = !awayWon && game.innings && game.innings.length > 0 &&
    game.innings[game.innings.length - 1].home > 0;

  return (
    <div className="game-summary-overlay" onClick={onContinue}>
      <div className="game-summary-card">
        <div className="summary-header">
          {isWalkoff && <div className="walkoff-tag">WALK-OFF!</div>}
          <div className="summary-game-num">Game {gameNumber} Final</div>
        </div>

        <div className="summary-score">
          <div className={`summary-team ${awayWon ? 'winner' : ''}`}>
            <span className="summary-team-name">{awayName}</span>
            <span className="summary-team-score">{game.score[0]}</span>
          </div>
          <div className={`summary-team ${!awayWon ? 'winner' : ''}`}>
            <span className="summary-team-name">{homeName}</span>
            <span className="summary-team-score">{game.score[1]}</span>
          </div>
        </div>

        <div className="summary-details">
          {decisions.wp && (
            <div className="summary-line">
              <span className="summary-label">W</span>
              <span className="summary-value">{decisions.wp}</span>
            </div>
          )}
          {decisions.lp && (
            <div className="summary-line">
              <span className="summary-label loss">L</span>
              <span className="summary-value">{decisions.lp}</span>
            </div>
          )}
          {decisions.sv && (
            <div className="summary-line">
              <span className="summary-label save">S</span>
              <span className="summary-value">{decisions.sv}</span>
            </div>
          )}
          {hrs.length > 0 && (
            <div className="summary-line">
              <span className="summary-label hr">HR</span>
              <span className="summary-value">{hrs.join(', ')}</span>
            </div>
          )}
        </div>

        <div className="summary-tap">Tap to continue</div>
      </div>
    </div>
  );
}
