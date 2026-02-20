import { useState, useCallback, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  doc, setDoc, deleteDoc, collection, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

interface UseMatchmakingReturn {
  isQueued: boolean;
  matchId: string | null;
  elapsed: number;
  joinQueue: () => Promise<void>;
  leaveQueue: () => Promise<void>;
}

export function useMatchmaking(): UseMatchmakingReturn {
  const { profile, user } = useAuth();
  const [isQueued, setIsQueued] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);

  const joinQueue = useCallback(async () => {
    if (!db || !profile || !user) return;

    await setDoc(doc(db, 'matchmaking_queue', user.uid), {
      elo_rating: profile.elo_rating,
      username: profile.username,
      joined_at: serverTimestamp(),
    });

    setIsQueued(true);
  }, [profile, user]);

  const leaveQueue = useCallback(async () => {
    if (!db || !user) return;

    try {
      await deleteDoc(doc(db, 'matchmaking_queue', user.uid));
    } catch {
      // Ignore if already deleted
    }
    setIsQueued(false);
  }, [user]);

  // Listen for our queue entry being deleted (means we were matched)
  useEffect(() => {
    if (!db || !user || !isQueued) return;

    const unsub = onSnapshot(doc(db, 'matchmaking_queue', user.uid), (snap) => {
      if (!snap.exists() && isQueued) {
        // Our entry was deleted — we may have been matched
        // Check for a match
        checkForMatch();
      }
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [user, isQueued]);

  const checkForMatch = useCallback(async () => {
    if (!db || !user) return;

    // Check player1_id matches
    const q1 = query(
      collection(db, 'matches'),
      where('player1_id', '==', user.uid),
      where('status', '==', 'draft'),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      setMatchId(snap1.docs[0].id);
      setIsQueued(false);
      return;
    }

    // Check player2_id matches
    const q2 = query(
      collection(db, 'matches'),
      where('player2_id', '==', user.uid),
      where('status', '==', 'draft'),
      orderBy('created_at', 'desc'),
      limit(1)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      setMatchId(snap2.docs[0].id);
      setIsQueued(false);
    }
  }, [user]);

  // Timer
  useEffect(() => {
    if (!isQueued) {
      setElapsed(0);
      return;
    }

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isQueued]);

  return { isQueued, matchId, elapsed, joinQueue, leaveQueue };
}
