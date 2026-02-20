import { useEffect } from 'react';
import { useLocalGame, LocalMultiplayerProvider } from '../../contexts/LocalMultiplayerContext';
import { useGame } from '../../context/GameContext';
import { getShortName } from '../../utils/teamNames';
import { TeamLineup } from '../Draft/TeamLineup';
import { MultiplayerCardPool } from './MultiplayerCardPool';
import { Button } from '../shared/Button';

function MultiplayerDraftContent({ onBack }: { onBack: () => void }) {
  const { state } = useGame();
  const { status, roomCode, myRole, isMyTurn, disconnect, startGame, isHost } = useLocalGame();

  // Host starts the game when both connected
  useEffect(() => {
    if (isHost && status === 'connected' && state.phase === 'start') {
      startGame();
    }
  }, [isHost, status, state.phase, startGame]);

  const handleDisconnect = () => {
    disconnect();
    onBack();
  };

  // Waiting for connection
  if (status !== 'connected') {
    return (
      <div className="multiplayer-waiting">
        <h2>Connecting...</h2>
        <p>Room Code: {roomCode}</p>
        <Button variant="outline" onClick={handleDisconnect}>
          Cancel
        </Button>
      </div>
    );
  }

  // Waiting for host to start game
  if (state.phase === 'start') {
    return (
      <div className="multiplayer-waiting">
        <h2>{isHost ? 'Starting game...' : 'Waiting for host to start...'}</h2>
        <Button variant="outline" onClick={handleDisconnect}>
          Cancel
        </Button>
      </div>
    );
  }

  // Draft phase
  if (state.phase === 'draft') {
    return (
      <div className="draft-screen">
        <div className="multiplayer-status-bar">
          <span className="mp-role">{myRole === 'player1' ? getShortName(state.team1.name) : getShortName(state.team2.name)}</span>
          <span className={`mp-turn ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
            {isMyTurn ? "Your Turn!" : "Opponent's Turn..."}
          </span>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
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

  // Team setup phase - for now just show a message
  if (state.phase === 'team-setup') {
    return (
      <div className="multiplayer-waiting">
        <h2>Draft Complete!</h2>
        <p>Team setup coming soon for multiplayer mode.</p>
        <Button variant="primary" onClick={handleDisconnect}>
          Back to Menu
        </Button>
      </div>
    );
  }

  return null;
}

interface MultiplayerDraftScreenProps {
  onBack: () => void;
}

export function MultiplayerDraftScreen({ onBack }: MultiplayerDraftScreenProps) {
  return (
    <LocalMultiplayerProvider>
      <MultiplayerDraftContent onBack={onBack} />
    </LocalMultiplayerProvider>
  );
}
