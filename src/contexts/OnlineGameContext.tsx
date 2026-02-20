import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { db, Match } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { doc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';

interface OnlineGameState {
  match: Match | null;
  phaseData: Record<string, unknown>;
  isMyTurn: boolean;
  myRole: 'player1' | 'player2' | null;
  opponentUsername: string;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  turnTimer: number;
}

interface OnlineGameContextType extends OnlineGameState {
  loadMatch: (matchId: string) => Promise<void>;
  sendAction: (action: Record<string, unknown>) => Promise<{ error: string | null }>;
  refreshMatch: () => Promise<void>;
  updatePhaseData: (updates: Record<string, unknown>) => Promise<void>;
}

const OnlineGameContext = createContext<OnlineGameContextType | null>(null);

export function OnlineGameProvider({ children, matchId }: { children: ReactNode; matchId: string }) {
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [phaseData, setPhaseData] = useState<Record<string, unknown>>({});
  const [opponentUsername, setOpponentUsername] = useState('Opponent');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [turnTimer, setTurnTimer] = useState(45);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const myRole = match
    ? match.player1_id === user?.uid ? 'player1' : 'player2'
    : null;

  const isMyTurn = phaseData.currentPick === myRole;

  const loadMatch = useCallback(async (id: string) => {
    if (!db) return;

    const snap = await getDoc(doc(db, 'matches', id));
    if (!snap.exists()) {
      console.error('Match not found:', id);
      return;
    }

    const data = { id: snap.id, ...snap.data() } as Match;
    setMatch(data);
    if (data.phase_data) {
      setPhaseData(data.phase_data as Record<string, unknown>);
    }

    // Fetch opponent username
    const opponentId = data.player1_id === user?.uid ? data.player2_id : data.player1_id;
    const oppSnap = await getDoc(doc(db, 'profiles', opponentId));
    if (oppSnap.exists()) {
      setOpponentUsername((oppSnap.data() as { username: string }).username);
    }
  }, [user]);

  const refreshMatch = useCallback(async () => {
    if (matchId) await loadMatch(matchId);
  }, [matchId, loadMatch]);

  // Send a game action via Firestore transaction
  const sendAction = useCallback(async (action: Record<string, unknown>) => {
    if (!db || !match || !user) return { error: 'Not connected' };

    try {
      const matchRef = doc(db, 'matches', match.id);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(matchRef);
        if (!snap.exists()) throw new Error('Match not found');

        const currentData = snap.data();
        const currentPhaseData = (currentData.phase_data || {}) as Record<string, unknown>;

        // Merge the action updates into phase_data
        const updatedPhaseData = { ...currentPhaseData, ...action };

        transaction.update(matchRef, {
          phase_data: updatedPhaseData,
        });
      });

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      return { error: message };
    }
  }, [match, user]);

  // Direct phase_data update (for host writing card pools, simulation results, etc.)
  const updatePhaseData = useCallback(async (updates: Record<string, unknown>) => {
    if (!db || !match) return;

    const matchRef = doc(db, 'matches', match.id);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const currentData = snap.data();
      const currentPhaseData = (currentData.phase_data || {}) as Record<string, unknown>;

      transaction.update(matchRef, {
        phase_data: { ...currentPhaseData, ...updates },
        ...(updates.status !== undefined ? { status: updates.status } : {}),
      });
    });
  }, [match]);

  // Load match on mount
  useEffect(() => {
    loadMatch(matchId);
  }, [matchId, loadMatch]);

  // Subscribe to match updates via Firestore onSnapshot
  useEffect(() => {
    if (!db || !matchId) return;

    const unsub = onSnapshot(
      doc(db, 'matches', matchId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.exists()) return;

        if (snap.metadata.fromCache) {
          setConnectionStatus('reconnecting');
        } else {
          setConnectionStatus('connected');
        }

        const data = { id: snap.id, ...snap.data() } as Match;
        setMatch(data);
        if (data.phase_data) {
          setPhaseData(data.phase_data as Record<string, unknown>);
        }
        // Reset turn timer on each update
        setTurnTimer(45);
      },
      () => {
        setConnectionStatus('disconnected');
      }
    );

    return () => unsub();
  }, [matchId]);

  // Turn timer countdown
  useEffect(() => {
    if (!isMyTurn) return;

    timerRef.current = setInterval(() => {
      setTurnTimer(t => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isMyTurn, phaseData]);

  return (
    <OnlineGameContext.Provider value={{
      match,
      phaseData,
      isMyTurn,
      myRole,
      opponentUsername,
      connectionStatus,
      turnTimer,
      loadMatch,
      sendAction,
      refreshMatch,
      updatePhaseData,
    }}>
      {children}
    </OnlineGameContext.Provider>
  );
}

export function useOnlineGame() {
  const context = useContext(OnlineGameContext);
  if (!context) {
    throw new Error('useOnlineGame must be used within an OnlineGameProvider');
  }
  return context;
}
