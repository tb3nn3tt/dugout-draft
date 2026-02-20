import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';

type GameAction = {
  type: string;
  payload?: unknown;
};

type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected';

interface UseLocalMultiplayerReturn {
  status: ConnectionStatus;
  roomCode: string | null;
  isHost: boolean;
  error: string | null;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  disconnect: () => void;
  sendAction: (action: GameAction) => void;
  lastReceivedAction: GameAction | null;
}

// Generate a simple 4-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useLocalMultiplayer(): UseLocalMultiplayerReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceivedAction, setLastReceivedAction] = useState<GameAction | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, []);

  const setupConnection = useCallback((conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      setStatus('connected');
      setError(null);
    });

    conn.on('data', (data) => {
      setLastReceivedAction(data as GameAction);
    });

    conn.on('close', () => {
      setStatus('disconnected');
      setError('Connection closed');
    });

    conn.on('error', (err) => {
      setError(err.message);
      setStatus('disconnected');
    });
  }, []);

  const createRoom = useCallback(() => {
    setError(null);
    setStatus('connecting');
    setIsHost(true);

    const code = generateRoomCode();
    const peerId = `dugout-draft-${code}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peerRef.current = peer;

    peer.on('open', () => {
      setRoomCode(code);
      setStatus('waiting');
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // Room code already taken, try another
        peer.destroy();
        createRoom();
      } else {
        setError(`Connection error: ${err.message}`);
        setStatus('disconnected');
      }
    });
  }, [setupConnection]);

  const joinRoom = useCallback((code: string) => {
    setError(null);
    setStatus('connecting');
    setIsHost(false);
    setRoomCode(code.toUpperCase());

    const peerId = `dugout-draft-guest-${Date.now()}`;
    const hostId = `dugout-draft-${code.toUpperCase()}`;

    const peer = new Peer(peerId, {
      debug: 0,
    });

    peerRef.current = peer;

    peer.on('open', () => {
      const conn = peer.connect(hostId, { reliable: true });
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        setError('Room not found. Check the code and try again.');
      } else {
        setError(`Connection error: ${err.message}`);
      }
      setStatus('disconnected');
    });
  }, [setupConnection]);

  const disconnect = useCallback(() => {
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
    setStatus('disconnected');
    setRoomCode(null);
    setIsHost(false);
    setError(null);
  }, []);

  const sendAction = useCallback((action: GameAction) => {
    if (connRef.current?.open) {
      connRef.current.send(action);
    }
  }, []);

  return {
    status,
    roomCode,
    isHost,
    error,
    createRoom,
    joinRoom,
    disconnect,
    sendAction,
    lastReceivedAction,
  };
}
