import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export interface LeaderboardEntry {
  id: string;
  username: string;
  elo_rating: number;
  wins: number;
  losses: number;
  games_played: number;
  peak_elo: number;
  rank: number;
  winRate: number;
}

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sortBy: 'elo' | 'wins' | 'winrate';
  setSortBy: (sort: 'elo' | 'wins' | 'winrate') => void;
}

export function useLeaderboard(): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'elo' | 'wins' | 'winrate'>('elo');

  const fetchLeaderboard = useCallback(async () => {
    if (!db) {
      setError('Online features not configured');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const firestore = db;
      // Fetch all profiles and filter/sort client-side to avoid composite index requirement
      const q = query(
        collection(firestore, 'profiles'),
        orderBy('elo_rating', 'desc'),
        limit(200)
      );

      const snap = await getDocs(q);

      let leaderboard: LeaderboardEntry[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            username: data.username,
            elo_rating: data.elo_rating,
            wins: data.wins,
            losses: data.losses,
            games_played: data.games_played,
            peak_elo: data.peak_elo,
            rank: 0,
            winRate: data.games_played > 0 ? (data.wins / data.games_played) * 100 : 0,
          };
        })
        .filter(e => e.games_played > 0)
        .slice(0, 100)
        .map((e, i) => ({ ...e, rank: i + 1 }));

      if (sortBy === 'wins') {
        leaderboard.sort((a, b) => b.wins - a.wins);
        leaderboard = leaderboard.map((e, i) => ({ ...e, rank: i + 1 }));
      } else if (sortBy === 'winrate') {
        leaderboard.sort((a, b) => b.winRate - a.winRate);
        leaderboard = leaderboard.map((e, i) => ({ ...e, rank: i + 1 }));
      }

      setEntries(leaderboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    }

    setLoading(false);
  }, [sortBy]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    entries,
    loading,
    error,
    refresh: fetchLeaderboard,
    sortBy,
    setSortBy,
  };
}
