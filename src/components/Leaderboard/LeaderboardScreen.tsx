import { useLeaderboard } from '../../hooks/useLeaderboard';
import { Button } from '../shared/Button';
import './LeaderboardScreen.css';

interface LeaderboardScreenProps {
  onBack: () => void;
}

export function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const { entries, loading, error, sortBy, setSortBy } = useLeaderboard();

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-header">
        <h2>Leaderboard</h2>
        <div className="leaderboard-sort">
          <button
            className={`sort-btn ${sortBy === 'elo' ? 'active' : ''}`}
            onClick={() => setSortBy('elo')}
          >
            ELO
          </button>
          <button
            className={`sort-btn ${sortBy === 'wins' ? 'active' : ''}`}
            onClick={() => setSortBy('wins')}
          >
            Wins
          </button>
          <button
            className={`sort-btn ${sortBy === 'winrate' ? 'active' : ''}`}
            onClick={() => setSortBy('winrate')}
          >
            Win Rate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="leaderboard-loading">Loading leaderboard...</div>
      ) : error ? (
        <div className="leaderboard-empty">{error}</div>
      ) : entries.length === 0 ? (
        <div className="leaderboard-empty">
          No ranked players yet. Be the first!
        </div>
      ) : (
        <div className="leaderboard-table-wrapper">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>ELO</th>
              <th>Record</th>
              <th className="hide-mobile">Win%</th>
              <th className="hide-mobile">Peak</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className={`lb-rank ${entry.rank <= 3 ? `lb-rank-${entry.rank}` : ''}`}>
                  {entry.rank}
                </td>
                <td className="lb-username">{entry.username}</td>
                <td className="lb-elo">{entry.elo_rating}</td>
                <td className="lb-record">{entry.wins}W - {entry.losses}L</td>
                <td className="lb-winrate hide-mobile">{entry.winRate.toFixed(1)}%</td>
                <td className="lb-peak hide-mobile">{entry.peak_elo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Button variant="secondary" size="md" onClick={onBack}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
}
