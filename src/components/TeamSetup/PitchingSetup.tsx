import { useState, useEffect } from 'react';
import { Player } from '../../types';
import { Button } from '../shared/Button';
import './PitchingSetup.css';

interface PitchingSetupProps {
  roster: Player[];
  rotation: Player[];
  closer: Player | null;
  bullpen: Player[];
  onRotationChange: (rotation: Player[]) => void;
  onCloserChange: (closer: Player) => void;
  onBullpenChange: (bullpen: Player[]) => void;
  teamName: string;
}

export function PitchingSetup({
  roster,
  rotation,
  closer,
  bullpen,
  onRotationChange,
  onCloserChange,
  onBullpenChange,
  teamName,
}: PitchingSetupProps) {
  const [localRotation, setLocalRotation] = useState<Player[]>(rotation);
  const [localCloser, setLocalCloser] = useState<Player | null>(closer);
  const [localBullpen, setLocalBullpen] = useState<Player[]>(bullpen);

  const starters = roster.filter(p => p.positions.includes('SP'));
  const relievers = roster.filter(p =>
    p.positions.some(pos => ['CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(pos))
  );

  useEffect(() => {
    // Auto-populate if empty
    if (localRotation.length === 0 && starters.length >= 4) {
      const sorted = [...starters].sort((a, b) => b.overall - a.overall);
      setLocalRotation(sorted.slice(0, 4));
    }
    if (!localCloser && relievers.length > 0) {
      const sorted = [...relievers].sort((a, b) => b.overall - a.overall);
      setLocalCloser(sorted[0]);
    }
    if (localBullpen.length === 0 && relievers.length > 1 && localCloser) {
      setLocalBullpen(relievers.filter(r => r.id !== localCloser.id));
    }
  }, [starters, relievers]);

  useEffect(() => {
    onRotationChange(localRotation);
  }, [localRotation, onRotationChange]);

  useEffect(() => {
    if (localCloser) onCloserChange(localCloser);
  }, [localCloser, onCloserChange]);

  useEffect(() => {
    onBullpenChange(localBullpen);
  }, [localBullpen, onBullpenChange]);

  const availableStarters = starters.filter(s => !localRotation.some(r => r.id === s.id));
  const availableRelievers = relievers.filter(
    r => r.id !== localCloser?.id && !localBullpen.some(b => b.id === r.id)
  );

  const addToRotation = (player: Player) => {
    if (localRotation.length < 4) {
      setLocalRotation([...localRotation, player]);
    }
  };

  const removeFromRotation = (index: number) => {
    const newRotation = [...localRotation];
    newRotation.splice(index, 1);
    setLocalRotation(newRotation);
  };

  const setAsCloser = (player: Player) => {
    if (localCloser) {
      setLocalBullpen([...localBullpen, localCloser]);
    }
    setLocalCloser(player);
    setLocalBullpen(localBullpen.filter(b => b.id !== player.id));
  };

  const addToBullpen = (player: Player) => {
    setLocalBullpen([...localBullpen, player]);
  };

  const removeFromBullpen = (player: Player) => {
    setLocalBullpen(localBullpen.filter(b => b.id !== player.id));
  };

  const autoFill = () => {
    const sortedStarters = [...starters].sort((a, b) => b.overall - a.overall);
    setLocalRotation(sortedStarters.slice(0, 4));

    const sortedRelievers = [...relievers].sort((a, b) => b.overall - a.overall);
    if (sortedRelievers.length > 0) {
      setLocalCloser(sortedRelievers[0]);
      setLocalBullpen(sortedRelievers.slice(1));
    }
  };

  const moveRotationUp = (index: number) => {
    if (index === 0) return;
    const newRotation = [...localRotation];
    [newRotation[index - 1], newRotation[index]] = [newRotation[index], newRotation[index - 1]];
    setLocalRotation(newRotation);
  };

  const moveRotationDown = (index: number) => {
    if (index === localRotation.length - 1) return;
    const newRotation = [...localRotation];
    [newRotation[index], newRotation[index + 1]] = [newRotation[index + 1], newRotation[index]];
    setLocalRotation(newRotation);
  };

  return (
    <div className="pitching-setup">
      <div className="pitching-header">
        <h3>{teamName} Pitching Staff</h3>
        <Button variant="outline" size="sm" onClick={autoFill}>
          Auto-Fill
        </Button>
      </div>

      <div className="pitching-container">
        <div className="pitching-section">
          <h4>Starting Rotation (4)</h4>
          <div className="rotation-list">
            {[1, 2, 3, 4].map((game, index) => (
              <div key={game} className={`rotation-slot ${localRotation[index] ? 'filled' : ''}`}>
                <span className="game-number">G{game}</span>
                {localRotation[index] ? (
                  <div className="pitcher-info">
                    <span className="pitcher-name">{localRotation[index].name}</span>
                    <span className="pitcher-era">{(localRotation[index].stats.era ?? 0).toFixed(2)}</span>
                    <div className="pitcher-actions">
                      <button className="action-btn" onClick={() => moveRotationUp(index)} disabled={index === 0}>↑</button>
                      <button className="action-btn" onClick={() => moveRotationDown(index)} disabled={index === localRotation.length - 1}>↓</button>
                      <button className="action-btn remove" onClick={() => removeFromRotation(index)}>×</button>
                    </div>
                  </div>
                ) : (
                  <span className="empty-slot">Select starter</span>
                )}
              </div>
            ))}
          </div>
          {availableStarters.length > 0 && (
            <div className="available-pitchers">
              <span className="label">Available:</span>
              {availableStarters.map(pitcher => (
                <button
                  key={pitcher.id}
                  className="add-pitcher-btn"
                  onClick={() => addToRotation(pitcher)}
                  disabled={localRotation.length >= 4}
                >
                  {pitcher.name} ({pitcher.overall})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pitching-section">
          <h4>Closer</h4>
          <div className={`closer-slot ${localCloser ? 'filled' : ''}`}>
            {localCloser ? (
              <div className="pitcher-info">
                <span className="pitcher-name">{localCloser.name}</span>
                <span className="pitcher-era">{(localCloser.stats.era ?? 0).toFixed(2)} ERA</span>
                <span className="pitcher-overall">{localCloser.overall} OVR</span>
              </div>
            ) : (
              <span className="empty-slot">Select closer</span>
            )}
          </div>

          <h4 className="mt-2">Bullpen</h4>
          <div className="bullpen-list">
            {localBullpen.map(pitcher => (
              <div key={pitcher.id} className="bullpen-pitcher">
                <span className="pitcher-name">{pitcher.name}</span>
                <span className="pitcher-era">{(pitcher.stats.era ?? 0).toFixed(2)}</span>
                <button className="action-btn remove" onClick={() => removeFromBullpen(pitcher)}>×</button>
              </div>
            ))}
          </div>

          {availableRelievers.length > 0 && (
            <div className="available-pitchers">
              <span className="label">Available:</span>
              {availableRelievers.map(pitcher => (
                <div key={pitcher.id} className="reliever-option">
                  <button
                    className="add-pitcher-btn closer-btn"
                    onClick={() => setAsCloser(pitcher)}
                  >
                    Set Closer
                  </button>
                  <button
                    className="add-pitcher-btn"
                    onClick={() => addToBullpen(pitcher)}
                  >
                    {pitcher.name} ({pitcher.overall})
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(localRotation.length < 4 || !localCloser) && (
        <div className="pitching-warning">
          {localRotation.length < 4 && `Need ${4 - localRotation.length} more starter(s). `}
          {!localCloser && 'Need to select a closer.'}
        </div>
      )}
    </div>
  );
}
