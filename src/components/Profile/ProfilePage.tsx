import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, MatchHistory } from '../../lib/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { EloChart } from './EloChart';
import { Button } from '../shared/Button';
import './ProfilePage.css';

interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const { profile, user } = useAuth();
  const [matchHistory, setMatchHistory] = useState<(MatchHistory & { opponentUsername: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user) {
      setLoading(false);
      return;
    }

    const firestore = db;

    const fetchHistory = async () => {
      try {
        // Firestore doesn't support OR across fields, so run two queries
        // Skip orderBy to avoid composite index requirement — sort client-side
        const q1 = query(
          collection(firestore, 'match_history'),
          where('player1_id', '==', user.uid),
          limit(20)
        );
        const q2 = query(
          collection(firestore, 'match_history'),
          where('player2_id', '==', user.uid),
          limit(20)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        const allMatches = [
          ...snap1.docs.map(d => ({ id: d.id, ...d.data() } as MatchHistory)),
          ...snap2.docs.map(d => ({ id: d.id, ...d.data() } as MatchHistory)),
        ];

        // Sort by completed_at descending and take top 20
        allMatches.sort((a, b) => {
          const ta = (a as any).completed_at?.toDate?.() || new Date(a.completed_at);
          const tb = (b as any).completed_at?.toDate?.() || new Date(b.completed_at);
          return tb.getTime() - ta.getTime();
        });

        const recent = allMatches.slice(0, 20);

        // Opponent usernames are already stored in match_history docs
        const enriched = recent.map(m => ({
          ...m,
          opponentUsername: m.player1_id === user.uid
            ? m.player2_username
            : m.player1_username,
        }));

        setMatchHistory(enriched);
      } catch (err) {
        console.error('Failed to fetch match history:', err);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  if (!profile) {
    return (
      <div className="profile-page">
        <p>Not signed in</p>
        <Button variant="secondary" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const winRate = profile.games_played > 0
    ? ((profile.wins / profile.games_played) * 100).toFixed(1)
    : '0.0';

  // Build ELO chart data from match history (in chronological order)
  const eloHistory = [...matchHistory].reverse().reduce<{ matchIndex: number; elo: number }[]>((acc, m) => {
    const isPlayer1 = m.player1_id === user?.uid;
    const eloAfter = isPlayer1
      ? m.player1_elo_before + (m.winner_id === user?.uid ? m.elo_change : -m.elo_change)
      : m.player2_elo_before + (m.winner_id === user?.uid ? m.elo_change : -m.elo_change);
    acc.push({ matchIndex: acc.length, elo: eloAfter });
    return acc;
  }, [{ matchIndex: 0, elo: 1200 }]);

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-header">
          <h2>{profile.username}</h2>
          <span className="profile-elo-badge">{profile.elo_rating}</span>
        </div>

        <div className="profile-stats-grid">
          <div className="profile-stat">
            <span className="profile-stat-label">Games</span>
            <span className="profile-stat-value">{profile.games_played}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-label">Wins</span>
            <span className="profile-stat-value">{profile.wins}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-label">Losses</span>
            <span className="profile-stat-value">{profile.losses}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-label">Win Rate</span>
            <span className="profile-stat-value">{winRate}%</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-label">Peak ELO</span>
            <span className="profile-stat-value">{profile.peak_elo}</span>
          </div>
        </div>
      </div>

      {eloHistory.length > 2 && (
        <div className="profile-section">
          <h3>ELO History</h3>
          <div className="elo-chart-container">
            <EloChart data={eloHistory} />
          </div>
        </div>
      )}

      <div className="profile-section">
        <h3>Recent Matches</h3>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : matchHistory.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No matches played yet</p>
        ) : (
          <div className="match-history-list">
            {matchHistory.map(m => {
              const isWinner = m.winner_id === user?.uid;
              const eloDelta = isWinner ? m.elo_change : -m.elo_change;

              return (
                <div key={m.id} className="match-history-row">
                  <span className="match-opponent">vs {m.opponentUsername}</span>
                  <span className={`match-result-tag ${isWinner ? 'win' : 'loss'}`}>
                    {isWinner ? 'W' : 'L'}
                  </span>
                  <span className="match-score">{m.series_score}</span>
                  <span className={`match-elo-delta ${eloDelta > 0 ? 'positive' : 'negative'}`}>
                    {eloDelta > 0 ? '+' : ''}{eloDelta}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Button variant="secondary" size="md" onClick={onBack}>
          Back to Menu
        </Button>
      </div>
    </div>
  );
}
