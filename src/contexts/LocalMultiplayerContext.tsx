import { createContext, useContext, useEffect, useCallback, ReactNode, useRef, useState } from 'react';
import { useLocalMultiplayer } from '../hooks/useLocalMultiplayer';
import { useGame } from '../context/GameContext';
import { useAuth } from './AuthContext';
import { Player } from '../types';

interface LocalMultiplayerContextType {
  // Connection
  status: 'disconnected' | 'connecting' | 'waiting' | 'connected';
  roomCode: string | null;
  isHost: boolean;
  myRole: 'player1' | 'player2' | null;
  error: string | null;

  // Actions
  createRoom: () => void;
  joinRoom: (code: string) => void;
  disconnect: () => void;
  startGame: () => void;

  // Game
  isMyTurn: boolean;
  pickPlayer: (playerId: string) => void;

  // Names
  myName: string;
  peerName: string;
}

const LocalMultiplayerContext = createContext<LocalMultiplayerContextType | null>(null);

export function LocalMultiplayerProvider({ children }: { children: ReactNode }) {
  const mp = useLocalMultiplayer();
  const { state, dispatch } = useGame();
  const { profile } = useAuth();
const lastSyncedPickNumber = useRef<number>(0);
  const [peerName, setPeerName] = useState('Opponent');
  const handshakeSent = useRef(false);

  const myName = profile?.username || (mp.isHost ? 'Host' : 'Guest');

  // Host = player1, Guest = player2
  const myRole = mp.status === 'connected' ? (mp.isHost ? 'player1' : 'player2') : null;
  const isMyTurn = state.phase === 'draft' && state.currentPick === myRole;

  // Exchange usernames on connection
  useEffect(() => {
    if (mp.status === 'connected' && !handshakeSent.current) {
      handshakeSent.current = true;
      mp.sendAction({ type: 'HANDSHAKE', payload: { username: myName } });
    }
    if (mp.status !== 'connected') {
      handshakeSent.current = false;
    }
  }, [mp.status, myName, mp.sendAction]);

  // Handle received actions from peer
  useEffect(() => {
    if (!mp.lastReceivedAction) return;

    const action = mp.lastReceivedAction;
    console.log('[P2P] Received:', action.type);

    switch (action.type) {
      case 'HANDSHAKE': {
        const { username } = action.payload as { username: string };
        setPeerName(username || 'Opponent');
        break;
      }

      case 'START_GAME': {
        // Guest receives game start with initial state
        const payload = action.payload as {
          availablePlayers: Player[];
          cardPool: Player[];
          pickNumber: number;
          currentPick: 'player1' | 'player2';
        };
        dispatch({ type: 'START_DRAFT' });
        dispatch({
          type: 'SYNC_MULTIPLAYER_STATE',
          availablePlayers: payload.availablePlayers,
          cardPool: payload.cardPool,
          pickNumber: payload.pickNumber,
          currentPick: payload.currentPick,
        });
        lastSyncedPickNumber.current = payload.pickNumber;
        break;
      }

      case 'PICK_PLAYER': {
        // Received a pick from the other player
        const { playerId } = action.payload as { playerId: string };
        dispatch({ type: 'PICK_PLAYER', playerId });
        break;
      }

      case 'SYNC_STATE': {
        // Full state sync from host
        const payload = action.payload as {
          cardPool: Player[];
          pickNumber: number;
          currentPick: 'player1' | 'player2';
          pickedFromPool: string[];
          team1Roster: Player[];
          team2Roster: Player[];
        };
        dispatch({
          type: 'SYNC_MULTIPLAYER_STATE',
          cardPool: payload.cardPool,
          pickNumber: payload.pickNumber,
          currentPick: payload.currentPick,
          pickedFromPool: payload.pickedFromPool,
          team1Roster: payload.team1Roster,
          team2Roster: payload.team2Roster,
        });
        lastSyncedPickNumber.current = payload.pickNumber;
        break;
      }

      case 'PHASE_CHANGE': {
        const { phase } = action.payload as { phase: string };
        if (phase === 'team-setup') {
          dispatch({ type: 'FORCE_PHASE', phase: 'team-setup' });
        }
        break;
      }
    }
  }, [mp.lastReceivedAction, dispatch]);

  // Host syncs state to guest after each pick
  useEffect(() => {
    if (!mp.isHost || mp.status !== 'connected') return;
    if (state.phase !== 'draft') return;
    if (state.pickNumber === lastSyncedPickNumber.current) return;

    // Sync after pick number changes
    lastSyncedPickNumber.current = state.pickNumber;
    mp.sendAction({
      type: 'SYNC_STATE',
      payload: {
        cardPool: state.cardPool,
        pickNumber: state.pickNumber,
        currentPick: state.currentPick,
        pickedFromPool: state.pickedFromPool,
        team1Roster: state.team1.roster,
        team2Roster: state.team2.roster,
      },
    });
  }, [mp.isHost, mp.status, state.pickNumber, state.cardPool, state.currentPick, state.pickedFromPool, state.team1.roster, state.team2.roster, state.phase, mp.sendAction]);

  // Notify guest when draft ends
  useEffect(() => {
    if (!mp.isHost || mp.status !== 'connected') return;
    if (state.phase === 'team-setup') {
      mp.sendAction({ type: 'PHASE_CHANGE', payload: { phase: 'team-setup' } });
    }
  }, [mp.isHost, mp.status, state.phase, mp.sendAction]);

  const startGame = useCallback(() => {
    if (!mp.isHost) return;

    // Start the draft locally
    dispatch({ type: 'START_DRAFT' });
  }, [mp.isHost, dispatch]);

  // After host starts draft, sync initial state to guest
  useEffect(() => {
    if (!mp.isHost || mp.status !== 'connected') return;
    if (state.phase !== 'draft') return;
    if (lastSyncedPickNumber.current > 0) return; // Already synced

    // Send initial game state to guest
    lastSyncedPickNumber.current = state.pickNumber;
    mp.sendAction({
      type: 'START_GAME',
      payload: {
        availablePlayers: state.availablePlayers,
        cardPool: state.cardPool,
        pickNumber: state.pickNumber,
        currentPick: state.currentPick,
      },
    });
  }, [mp.isHost, mp.status, state.phase, state.availablePlayers, state.cardPool, state.pickNumber, state.currentPick, mp.sendAction]);

  const pickPlayer = useCallback((playerId: string) => {
    if (!isMyTurn) return;

    // Make the pick locally
    dispatch({ type: 'PICK_PLAYER', playerId });

    // Send to peer
    mp.sendAction({ type: 'PICK_PLAYER', payload: { playerId } });
  }, [isMyTurn, dispatch, mp.sendAction]);

  return (
    <LocalMultiplayerContext.Provider value={{
      status: mp.status,
      roomCode: mp.roomCode,
      isHost: mp.isHost,
      myRole,
      error: mp.error,
      createRoom: mp.createRoom,
      joinRoom: mp.joinRoom,
      disconnect: mp.disconnect,
      startGame,
      isMyTurn,
      pickPlayer,
      myName,
      peerName,
    }}>
      {children}
    </LocalMultiplayerContext.Provider>
  );
}

export function useLocalGame() {
  const context = useContext(LocalMultiplayerContext);
  if (!context) {
    throw new Error('useLocalGame must be used within LocalMultiplayerProvider');
  }
  return context;
}
