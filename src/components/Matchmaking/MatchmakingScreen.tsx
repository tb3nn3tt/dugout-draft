import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import {
  doc, setDoc, deleteDoc, collection, query, where, limit,
  getDocs, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import './MatchmakingScreen.css';

interface MatchmakingScreenProps {
  onMatchFound: (matchId: string) => void;
  onCancel: () => void;
}

export function MatchmakingScreen({ onMatchFound, onCancel }: MatchmakingScreenProps) {
  const { profile, user } = useAuth();
  const [status, setStatus] = useState<'joining' | 'waiting' | 'found'>('joining');
  const [elapsed, setElapsed] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const elapsedRef = useRef(0);

  // Keep ref in sync so polling callbacks always see current value
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const joinQueue = useCallback(async () => {
    if (!db || !profile || !user) return;

    await setDoc(doc(db, 'matchmaking_queue', user.uid), {
      elo_rating: profile.elo_rating,
      username: profile.username,
      joined_at: serverTimestamp(),
    });

    setStatus('waiting');
  }, [profile, user]);

  const leaveQueue = useCallback(async () => {
    if (!db || !user) return;

    try {
      await deleteDoc(doc(db, 'matchmaking_queue', user.uid));
    } catch {
      // Ignore if already deleted
    }
  }, [user]);

  const checkForMatch = useCallback(async () => {
    if (!db || !user) return;

    // Check if we've been matched — query by player ID only (no composite index needed)
    // then filter status client-side
    const q1 = query(
      collection(db, 'matches'),
      where('player1_id', '==', user.uid),
      limit(5)
    );
    const q2 = query(
      collection(db, 'matches'),
      where('player2_id', '==', user.uid),
      limit(5)
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const results = [
      ...snap1.docs.filter(d => d.data().status === 'draft').map(d => ({ id: d.id, created_at: d.data().created_at })),
      ...snap2.docs.filter(d => d.data().status === 'draft').map(d => ({ id: d.id, created_at: d.data().created_at })),
    ];

    if (results.length > 0) {
      results.sort((a, b) => {
        const ta = a.created_at?.toDate?.() || new Date(0);
        const tb = b.created_at?.toDate?.() || new Date(0);
        return tb.getTime() - ta.getTime();
      });
      setMatchId(results[0].id);
      setStatus('found');
    }
  }, [user]);

  const attemptMatch = useCallback(async () => {
    if (!db || !profile || !user) return;
    const firestore = db;

    // Use ref so this callback stays stable (not recreated every second)
    let eloRange = 100;
    if (elapsedRef.current > 30) eloRange = 200;
    if (elapsedRef.current > 60) eloRange = 300;

    // Find candidates within ELO range
    const q = query(
      collection(firestore, 'matchmaking_queue'),
      where('elo_rating', '>=', profile.elo_rating - eloRange),
      where('elo_rating', '<=', profile.elo_rating + eloRange),
      limit(10)
    );

    const snap = await getDocs(q);
    const candidates = snap.docs.filter(d => d.id !== user.uid);

    if (candidates.length === 0) return;

    const opponent = candidates[0];
    const opponentData = opponent.data();

    try {
      let createdMatchId: string | null = null;

      await runTransaction(firestore, async (transaction) => {
        const oppRef = doc(firestore, 'matchmaking_queue', opponent.id);
        const oppSnap = await transaction.get(oppRef);
        if (!oppSnap.exists()) return;

        const matchRef = doc(collection(firestore, 'matches'));
        transaction.set(matchRef, {
          player1_id: user.uid,
          player2_id: opponent.id,
          player1_username: profile.username,
          player2_username: opponentData.username,
          status: 'draft',
          phase_data: {},
          winner_id: null,
          created_at: serverTimestamp(),
          completed_at: null,
          player1_elo_at_start: profile.elo_rating,
          player2_elo_at_start: opponentData.elo_rating,
        });

        transaction.delete(doc(firestore, 'matchmaking_queue', user.uid));
        transaction.delete(oppRef);

        createdMatchId = matchRef.id;
      });

      // Set state AFTER transaction commits successfully
      if (createdMatchId) {
        setMatchId(createdMatchId);
        setStatus('found');
      }
    } catch (err) {
      console.log('Match attempt failed, retrying...', err);
    }
  }, [profile, user]); // No more `elapsed` — uses ref instead

  // Join queue on mount
  useEffect(() => {
    joinQueue();
    return () => { leaveQueue(); };
  }, [joinQueue, leaveQueue]);

  // Elapsed timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Poll for matches — stable deps so interval isn't recreated every second
  useEffect(() => {
    if (status !== 'waiting') return;

    // Fire immediately on first poll, then every 3s
    checkForMatch();
    attemptMatch();

    pollingRef.current = setInterval(() => {
      checkForMatch();
      attemptMatch();
    }, 3000);

    return () => clearInterval(pollingRef.current);
  }, [status, checkForMatch, attemptMatch]);

  // Navigate to match when found
  useEffect(() => {
    if (status === 'found' && matchId) {
      const timeout = setTimeout(() => {
        onMatchFound(matchId);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [status, matchId, onMatchFound]);

  const handleCancel = async () => {
    clearInterval(timerRef.current);
    clearInterval(pollingRef.current);
    await leaveQueue();
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`matchmaking-screen ${status === 'found' ? 'match-found' : ''}`}>
      <div className="matchmaking-content">
        {status !== 'found' && <div className="matchmaking-spinner" />}

        <div className="matchmaking-status">
          {status === 'joining' && 'Joining Queue...'}
          {status === 'waiting' && 'Finding Opponent...'}
          {status === 'found' && 'Match Found!'}
        </div>

        {profile && status === 'waiting' && (
          <>
            <div className="matchmaking-elo">
              Your ELO: {profile.elo_rating}
            </div>
            <div className="matchmaking-detail">
              Searching within {elapsed < 30 ? '100' : elapsed < 60 ? '200' : '300'} ELO range
            </div>
            <div className="matchmaking-timer">
              {formatTime(elapsed)}
            </div>
          </>
        )}

        {status !== 'found' && (
          <button className="matchmaking-cancel" onClick={handleCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
