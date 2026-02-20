import { GameResult } from '../../types';
import { getDisplayName } from '../../utils/helpers';
import './GameResultCard.css';

interface GameResultCardProps {
  game: GameResult;
  gameNumber: number;
  visible: boolean;
  homeTeam: 'player1' | 'player2';
  team1Name?: string;
  team2Name?: string;
}

export function GameResultCard({ game, gameNumber, visible, homeTeam, team1Name = 'Team 1', team2Name = 'Team 2' }: GameResultCardProps) {
  // Determine if this game had home field for player1 or player2
  const isHomeGame = [1, 2, 6, 7].includes(gameNumber);
  const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');

  const awayTeam = actualHome === 'player1' ? team2Name : team1Name;
  const homeTeamName = actualHome === 'player1' ? team1Name : team2Name;

  const awayScore = game.score[0];
  const homeScore = game.score[1];

  // Get winning pitcher, HR hitters from boxscore
  const boxScore = game.boxScore;
  let winningPitcher: string | null = null;
  let savePitcher: string | null = null;
  let hrHitters: string[] = [];

  if (boxScore) {
    // Find winning pitcher
    [boxScore.away, boxScore.home].forEach(teamBox => {
      teamBox.pitchers.forEach(p => {
        if (p.decision === 'W') winningPitcher = p.name;
        if (p.decision === 'S') savePitcher = p.name;
      });
    });

    // Find HR hitters
    [boxScore.away, boxScore.home].forEach(teamBox => {
      teamBox.batters.forEach(b => {
        if (b.hr > 0) {
          hrHitters.push(`${getDisplayName(b.name)} (${b.hr})`);
        }
      });
    });
  }

  // Check for special game types
  const isWalkoff = homeScore > awayScore && game.innings?.length &&
    game.innings[game.innings.length - 1].home > 0;
  const isShutout = awayScore === 0 || homeScore === 0;
  const isBlowout = Math.abs(awayScore - homeScore) >= 5;

  const winner = game.winner === 'player1' ? team1Name : team2Name;

  return (
    <div className={`game-result-card ${visible ? 'visible' : ''} ${isWalkoff ? 'walkoff' : ''}`}>
      <div className="game-number">Game {gameNumber}</div>

      <div className="game-score-line">
        <div className={`team-result ${awayScore > homeScore ? 'winner' : ''}`}>
          <span className="team-name">{awayTeam}</span>
          <span className="score">{awayScore}</span>
        </div>
        <div className={`team-result ${homeScore > awayScore ? 'winner' : ''}`}>
          <span className="team-name">{homeTeamName}</span>
          <span className="score">{homeScore}</span>
        </div>
      </div>

      <div className="game-details">
        {winningPitcher && (
          <span className="detail-item">
            <span className="detail-icon">🏆</span>
            W: {winningPitcher}
          </span>
        )}
        {savePitcher && (
          <span className="detail-item">
            <span className="detail-icon">💾</span>
            S: {savePitcher}
          </span>
        )}
        {hrHitters.length > 0 && (
          <span className="detail-item">
            <span className="detail-icon">💪</span>
            HR: {hrHitters.slice(0, 2).join(', ')}
          </span>
        )}
      </div>

      {(isWalkoff || isShutout || isBlowout) && (
        <div className="game-badges">
          {isWalkoff && <span className="badge walkoff-badge">WALK-OFF!</span>}
          {isShutout && <span className="badge shutout-badge">SHUTOUT</span>}
          {isBlowout && <span className="badge blowout-badge">BLOWOUT</span>}
        </div>
      )}

      <div className="winner-indicator">{winner} wins</div>
    </div>
  );
}
