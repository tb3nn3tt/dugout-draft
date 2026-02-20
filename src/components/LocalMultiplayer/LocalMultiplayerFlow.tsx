import { useState } from 'react';
import { LocalMultiplayerProvider, useLocalGame } from '../../contexts/LocalMultiplayerContext';
import { useGame } from '../../context/GameContext';
import { TeamLineup } from '../Draft/TeamLineup';
import { MultiplayerCardPool } from './MultiplayerCardPool';
import { Button } from '../shared/Button';
import './LocalLobby.css';

interface LocalMultiplayerFlowContentProps {
  onBack: () => void;
}

function LocalMultiplayerFlowContent({ onBack }: LocalMultiplayerFlowContentProps) {
  const { state } = useGame();
  const {
    status,
    roomCode,
    isHost,
    isMyTurn,
    error,
    createRoom,
    joinRoom,
    disconnect,
    startGame,
    myName,
    peerName
  } = useLocalGame();

  const [mode, setMode] = useState<'select' | 'host' | 'join'>('select');
  const [joinCode, setJoinCode] = useState('');
  const [readyToPlay, setReadyToPlay] = useState(false);

  // Host starts the game when they click Start Draft
  const handleStartGame = () => {
    if (isHost) {
      startGame();
    }
    setReadyToPlay(true);
  };

  // Auto-transition to draft when game starts (for guest who receives START_GAME)
  const gameStarted = readyToPlay || state.phase === 'draft' || state.phase === 'team-setup';

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
    if (readyToPlay) {
      setReadyToPlay(false);
    } else if (mode !== 'select') {
      setMode('select');
      setJoinCode('');
    } else {
      onBack();
    }
  };

  // Game is started - show draft screen
  if (gameStarted && state.phase === 'draft') {
    return (
      <div className="draft-screen">
        <div className="multiplayer-status-bar">
          <span className="mp-role">{myName}</span>
          <span className={`mp-turn ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
            {isMyTurn ? "Your Turn!" : "Opponent's Turn..."}
          </span>
          <Button variant="outline" size="sm" onClick={handleBack}>
            Leave
          </Button>
        </div>
        <div className="draft-roster">
          <TeamLineup
            team1Roster={state.team1.roster}
            team2Roster={state.team2.roster}
            currentPick={state.currentPick}
            team1Name={state.team1.name}
            team2Name={state.team2.name}
          />
        </div>
        <div className="draft-picks">
          <MultiplayerCardPool />
        </div>
      </div>
    );
  }

  // Team setup phase
  if (gameStarted && state.phase === 'team-setup') {
    return (
      <div className="local-lobby">
        <div className="lobby-connected">
          <div className="connected-icon">🏆</div>
          <h2>Draft Complete!</h2>
          <p>Team setup for multiplayer coming soon.</p>
          <Button variant="primary" size="lg" onClick={onBack}>
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // Waiting for host to start (guest side)
  if (gameStarted && state.phase === 'start') {
    return (
      <div className="local-lobby">
        <div className="lobby-connecting">
          <div className="connecting-spinner"></div>
          <p>Waiting for host to start the draft...</p>
          <Button variant="outline" onClick={handleBack}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Connected - show start button
  if (status === 'connected') {
    return (
      <div className="local-lobby">
        <div className="lobby-connected">
          <div className="connected-icon">🎮</div>
          <h2>Connected!</h2>
          <p className="role-info">
            You are <strong>{myName}</strong> {isHost ? '(Host)' : '(Guest)'}
          </p>
          <p className="role-info" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            vs <strong>{peerName}</strong>
          </p>
          <Button variant="success" size="lg" onClick={handleStartGame}>
            {isHost ? 'Start Draft' : 'Ready!'}
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
          <h2>Waiting for Opponent</h2>
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

interface LocalMultiplayerFlowProps {
  onBack: () => void;
}

export function LocalMultiplayerFlow({ onBack }: LocalMultiplayerFlowProps) {
  return (
    <LocalMultiplayerProvider>
      <LocalMultiplayerFlowContent onBack={onBack} />
    </LocalMultiplayerProvider>
  );
}
