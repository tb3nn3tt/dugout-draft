import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

interface UseOnlineSyncReturn {
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastSyncTime: number;
  reconnect: () => void;
  opponentOnline: boolean;
  opponentLastSeen: number;
}

export function useOnlineSync(matchId: string): UseOnlineSyncReturn {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [opponentOnline, setOpponentOnline] = useState(true);
  const [opponentLastSeen, setOpponentLastSeen] = useState(Date.now());

  const reconnect = useCallback(() => {
    // Firestore onSnapshot handles reconnection automatically
    setConnectionStatus('reconnecting');
  }, []);

  // Firestore onSnapshot provides automatic connection status
  useEffect(() => {
    if (!db || !matchId) return;

    const firestore = db;
    const unsub = onSnapshot(
      doc(firestore, 'matches', matchId),
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache) {
          setConnectionStatus('reconnecting');
        } else {
          setConnectionStatus('connected');
          setLastSyncTime(Date.now());
        }

        // Check opponent heartbeat
        if (snap.exists()) {
          const data = snap.data();
          const myRoleVal = data.player1_id === user?.uid ? 'player1' : 'player2';
          const opponentRole = myRoleVal === 'player1' ? 'player2' : 'player1';
          const opponentHeartbeat = data[`lastSeen_${opponentRole}`];

          if (opponentHeartbeat) {
            const ts = opponentHeartbeat.toDate ? opponentHeartbeat.toDate().getTime() : opponentHeartbeat;
            setOpponentLastSeen(ts);
            setOpponentOnline(Date.now() - ts < 45000);
          }
        }
      },
      () => {
        setConnectionStatus('disconnected');
      }
    );

    return () => unsub();
  }, [matchId, user]);

  // Heartbeat: write lastSeen timestamp every 15 seconds
  useEffect(() => {
    if (!db || !matchId || !user) return;

    const firestore = db;
    const writeHeartbeat = async () => {
      try {
        const matchRef = doc(firestore, 'matches', matchId);
        const snap = await getDoc(matchRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const role = data.player1_id === user.uid ? 'player1' : 'player2';
        await updateDoc(matchRef, {
          [`lastSeen_${role}`]: serverTimestamp(),
        });
      } catch {
        // Ignore heartbeat failures
      }
    };

    writeHeartbeat();
    const interval = setInterval(writeHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [matchId, user]);

  return {
    connectionStatus,
    lastSyncTime,
    reconnect,
    opponentOnline,
    opponentLastSeen,
  };
}
