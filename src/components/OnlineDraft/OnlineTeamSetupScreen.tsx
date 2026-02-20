import { useState, useEffect, useCallback } from 'react';
import { OnlineGameProvider, useOnlineGame } from '../../contexts/OnlineGameContext';
import { db } from '../../lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Player } from '../../types';
import { Button } from '../shared/Button';
import { buildAllPlayersMap } from '../../utils/draftLogic';
import { formatBattingAvg, formatERA, getPositionColor } from '../../utils/helpers';
import { generateOptimalLineup, generateOptimalRotation } from '../../utils/lineupBuilder';

const allPlayersMap = buildAllPlayersMap();

function hydratePlayerIds(ids: string[]): Player[] {
  return ids.map(id => allPlayersMap.get(id)).filter(Boolean) as Player[];
}

interface OnlineTeamSetupScreenProps {
  matchId: string;
  onPhaseComplete: () => void;
  onAbandon: () => void;
}

function OnlineTeamSetupInner({ onPhaseComplete, onAbandon }: Omit<OnlineTeamSetupScreenProps, 'matchId'>) {
  const { match, phaseData, myRole } = useOnlineGame();
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  const rosterIds = myRole === 'player1'
    ? (phaseData.player1Roster as string[]) || []
    : (phaseData.player2Roster as string[]) || [];

  const roster = hydratePlayerIds(rosterIds);
  const lineupEntries = generateOptimalLineup(roster);
  const battingOrder = lineupEntries.map(e => e.player);
  const rotation = generateOptimalRotation(roster);
  const relievers = roster.filter(p =>
    p.positions.some(pos => ['CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(pos))
  );
  const closer = relievers.find(p => p.positions.includes('CL')) || relievers[0] || null;
  const bullpen = relievers.filter(p => p.id !== closer?.id);

  const handleConfirm = useCallback(async () => {
    if (!db || !match || !user || !myRole) return;

    const setupKey = myRole === 'player1' ? 'player1Setup' : 'player2Setup';
    const matchRef = doc(db, 'matches', match.id);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pd = (data.phase_data || {}) as Record<string, unknown>;

      const updatedPhaseData = {
        ...pd,
        [setupKey]: {
          battingOrder: battingOrder.map(p => p.id),
          rotation: rotation.map(p => p.id),
          closer: closer?.id || null,
          bullpen: bullpen.map(p => p.id),
        },
      };

      // Check if both ready
      const otherKey = myRole === 'player1' ? 'player2Setup' : 'player1Setup';
      const bothReady = !!updatedPhaseData[otherKey];

      transaction.update(matchRef, {
        phase_data: updatedPhaseData,
        status: bothReady ? 'simulating' : 'team_setup',
      });
    });

    setIsReady(true);
  }, [match, user, myRole, battingOrder, rotation, closer, bullpen]);

  // Check opponent ready state
  useEffect(() => {
    const mySetupKey = myRole === 'player1' ? 'player1Setup' : 'player2Setup';
    const oppSetupKey = myRole === 'player1' ? 'player2Setup' : 'player1Setup';

    if (phaseData[mySetupKey]) setIsReady(true);
    if (phaseData[oppSetupKey]) setOpponentReady(true);
  }, [phaseData, myRole]);

  // Check for phase transition
  useEffect(() => {
    if (match?.status === 'simulating') {
      onPhaseComplete();
    }
  }, [match?.status, onPhaseComplete]);

  return (
    <div className="online-team-setup">
      <h2>Set Your Lineup</h2>
      {isReady ? (
        <div className="waiting-opponent">
          <div className="matchmaking-spinner" />
          <p>{opponentReady ? 'Both ready! Starting...' : 'Waiting for opponent...'}</p>
        </div>
      ) : (
        <>
          <div className="setup-section">
            <h3>Batting Order</h3>
            <div className="setup-lineup">
              {lineupEntries.map((entry, i) => (
                <div key={entry.player.id} className="setup-player-row">
                  <span className="lineup-slot">{i + 1}</span>
                  <span className="setup-pos" style={{ backgroundColor: getPositionColor(entry.assignedPosition) }}>{entry.assignedPosition}</span>
                  <span className="setup-name">{entry.player.name}</span>
                  <span className="setup-stat">{formatBattingAvg(entry.player.stats.avg ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="setup-section">
            <h3>Rotation</h3>
            <div className="setup-lineup">
              {rotation.map((p, i) => (
                <div key={p.id} className="setup-player-row">
                  <span className="lineup-slot">G{i + 1}</span>
                  <span className="setup-pos" style={{ backgroundColor: getPositionColor('SP') }}>SP</span>
                  <span className="setup-name">{p.name}</span>
                  <span className="setup-stat">{formatERA(p.stats.era ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {closer && (
            <div className="setup-section">
              <h3>Closer</h3>
              <div className="setup-player-row">
                <span className="lineup-slot">CL</span>
                <span className="setup-pos" style={{ backgroundColor: getPositionColor('CL') }}>CL</span>
                <span className="setup-name">{closer.name}</span>
                <span className="setup-stat">{formatERA(closer.stats.era ?? 0)}</span>
              </div>
            </div>
          )}

          <div className="setup-actions">
            <Button variant="success" size="lg" onClick={handleConfirm}>
              Confirm Lineup
            </Button>
            <Button variant="secondary" size="sm" onClick={onAbandon}>
              Leave Match
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function OnlineTeamSetupScreen({ matchId, onPhaseComplete, onAbandon }: OnlineTeamSetupScreenProps) {
  return (
    <OnlineGameProvider matchId={matchId}>
      <OnlineTeamSetupInner onPhaseComplete={onPhaseComplete} onAbandon={onAbandon} />
    </OnlineGameProvider>
  );
}
