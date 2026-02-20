import { useState } from 'react';
import { useLocalMultiplayer } from '../../hooks/useLocalMultiplayer';
import { Button } from '../shared/Button';
import './LocalLobby.css';

interface LocalLobbyProps {
  onGameStart: (isHost: boolean) => void;
  onBack: () => void;
}

export function LocalLobby({ onGameStart, onBack }: LocalLobbyProps) {
  const { status, roomCode, isHost, error, createRoom, joinRoom, disconnect } = useLocalMultiplayer();
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'select' | 'host' | 'join'>('select');

  const handleCreate = () => {
    setMode('host');
    createRoom();
  };

  const handleJoin = () => {
    if (joinCode.length === 4) {
      joinRoom(joinCode);
    }
  };

  const handleBack = () => {
    if (status !== 'disconnected') {
      disconnect();
    }
    if (mode !== 'select') {
      setMode('select');
      setJoinCode('');
    } else {
      onBack();
    }
  };

  // Connected - start the game
  if (status === 'connected') {
    return (
      <div className="local-lobby">
        <div className="lobby-connected">
          <div className="connected-icon">🎮</div>
          <h2>Connected!</h2>
          <p className="role-info">
            You are <strong>{isHost ? 'Host' : 'Guest'}</strong>
          </p>
          <Button variant="success" size="lg" onClick={() => onGameStart(isHost)}>
            Start Draft
          </Button>
          <Button variant="outline" onClick={handleBack}>
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  // Waiting for opponent (host only)
  if (status === 'waiting' && roomCode) {
    return (
      <div className="local-lobby">
        <div className="lobby-waiting">
          <h2>Waiting for Player 2</h2>
          <p>Share this code with your opponent:</p>
          <div className="room-code">{roomCode}</div>
          <p className="hint">They should select "Join Room" and enter this code</p>
          <div className="waiting-spinner">
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
          </div>
          <Button variant="outline" onClick={handleBack}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Connecting
  if (status === 'connecting') {
    return (
      <div className="local-lobby">
        <div className="lobby-connecting">
          <div className="connecting-spinner"></div>
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  // Join mode
  if (mode === 'join') {
    return (
      <div className="local-lobby">
        <h2>Join Room</h2>
        <p>Enter the 4-letter code from your opponent:</p>
        <input
          type="text"
          className="code-input"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="CODE"
          maxLength={4}
          autoFocus
        />
        {error && <p className="error-message">{error}</p>}
        <div className="lobby-buttons">
          <Button
            variant="primary"
            size="lg"
            onClick={handleJoin}
            disabled={joinCode.length !== 4}
          >
            Join
          </Button>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Mode selection
  return (
    <div className="local-lobby">
      <h2>Local Multiplayer</h2>
      <p>Play against someone on the same WiFi network</p>

      <div className="lobby-options">
        <button className="lobby-option" onClick={handleCreate}>
          <span className="option-icon">📡</span>
          <span className="option-title">Create Room</span>
          <span className="option-desc">Get a code to share</span>
        </button>

        <button className="lobby-option" onClick={() => setMode('join')}>
          <span className="option-icon">🔗</span>
          <span className="option-title">Join Room</span>
          <span className="option-desc">Enter a code to connect</span>
        </button>
      </div>

      <Button variant="outline" onClick={onBack}>
        Back to Menu
      </Button>
    </div>
  );
}
