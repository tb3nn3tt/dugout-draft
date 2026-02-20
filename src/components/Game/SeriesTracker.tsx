import { SeriesState } from '../../types';
import './SeriesTracker.css';

interface SeriesTrackerProps {
  series: SeriesState;
  team1Name?: string;
  team2Name?: string;
}

export function SeriesTracker({ series, team1Name = 'Team 1', team2Name = 'Team 2' }: SeriesTrackerProps) {
  const player1Wins = series.games.filter(g => g.winner === 'player1').length;
  const player2Wins = series.games.filter(g => g.winner === 'player2').length;

  return (
    <div className="series-tracker">
      <h3 className="series-title">World Series</h3>

      <div className="series-score">
        <div className={`team-wins ${player1Wins > player2Wins ? 'leading' : ''}`}>
          <span className="team-label">{team1Name}</span>
          <span className="wins-count">{player1Wins}</span>
        </div>
        <span className="series-divider">-</span>
        <div className={`team-wins ${player2Wins > player1Wins ? 'leading' : ''}`}>
          <span className="wins-count">{player2Wins}</span>
          <span className="team-label">{team2Name}</span>
        </div>
      </div>

      <div className="games-list">
        {[1, 2, 3, 4, 5, 6, 7].map(gameNum => {
          const game = series.games[gameNum - 1];
          const isPlayed = !!game;
          const isCurrent = !isPlayed && gameNum === series.games.length + 1;

          return (
            <div
              key={gameNum}
              className={`game-box ${isPlayed ? 'played' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <span className="game-number">G{gameNum}</span>
              {isPlayed && (
                <div className="game-result">
                  <span className={game.winner === 'player1' ? 'winner' : ''}>
                    {game.score[0]}
                  </span>
                  <span>-</span>
                  <span className={game.winner === 'player2' ? 'winner' : ''}>
                    {game.score[1]}
                  </span>
                </div>
              )}
              {isCurrent && <span className="current-badge">NEXT</span>}
            </div>
          );
        })}
      </div>

      <div className="series-status">
        {player1Wins === 4 ? (
          <span className="winner-text">{team1Name} Wins the World Series!</span>
        ) : player2Wins === 4 ? (
          <span className="winner-text">{team2Name} Wins the World Series!</span>
        ) : (
          <span>First to 4 wins</span>
        )}
      </div>
    </div>
  );
}
