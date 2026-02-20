import { useState, useEffect, useMemo, useCallback } from 'react';
import { Player, DraftedTeam, Position } from '../../types';
import { getPositionColor, isHitter, formatBattingAvg, formatERA, canPlayPosition } from '../../utils/helpers';
import { Button } from '../shared/Button';
import { generateOptimalLineup, generateOptimalRotation, generateOptimalBullpen, LineupEntry, reassignPositions, canBenchReplaceStarter } from '../../utils/lineupBuilder';
import './LineupConfirm.css';

interface LineupConfirmProps {
  team: DraftedTeam;
  teamName: string;
  onConfirm: (battingOrder: Player[], rotation: Player[], closer: Player, bullpen: Player[]) => void;
  isConfirmed: boolean;
  isOnline?: boolean;
  onConfirmOnline?: (lineup: { battingOrder: string[]; rotation: string[]; closer: string | null; bullpen: string[] }) => void;
}

interface SelectedPlayer {
  source: 'lineup' | 'bench';
  index: number;
  player: Player;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function LineupConfirm({ team, teamName, onConfirm, isConfirmed, isOnline: _isOnline, onConfirmOnline: _onConfirmOnline }: LineupConfirmProps) {
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [rotation, setRotation] = useState<Player[]>([]);
  const [closer, setCloser] = useState<Player | null>(null);
  const [setup, setSetup] = useState<Player[]>([]);
  const [middleRelief, setMiddleRelief] = useState<Player[]>([]);
  const [longRelief, setLongRelief] = useState<Player[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>('batting');
  const [swappedIndices, setSwappedIndices] = useState<Set<number>>(new Set());
  const [showToast, setShowToast] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);

  useEffect(() => {
    setLineup(generateOptimalLineup(team.roster));
    setRotation(generateOptimalRotation(team.roster));
    const bp = generateOptimalBullpen(team.roster);
    setCloser(bp.closer);
    setSetup(bp.setup);
    setMiddleRelief(bp.middleRelief);
    setLongRelief(bp.longRelief);
  }, [team.roster]);

  const handleConfirm = useCallback(() => {
    if (closer) {
      setShowToast(true);
      setTimeout(() => {
        const bullpen = [...setup, ...middleRelief, ...longRelief];
        onConfirm(lineup.map(e => e.player), rotation, closer, bullpen);
      }, 1500);
    }
  }, [closer, setup, middleRelief, longRelief, lineup, rotation, onConfirm]);

  const swapRotation = (i: number, j: number) => {
    const newRotation = [...rotation];
    [newRotation[i], newRotation[j]] = [newRotation[j], newRotation[i]];
    setRotation(newRotation);
  };

  const bench = useMemo(() => {
    const inLineup = new Set(lineup.map(e => e.player.id));
    return team.roster.filter(p => isHitter(p) && !inLineup.has(p.id));
  }, [team.roster, lineup]);

  // Swap a starter with a bench player — reassign positions afterwards
  const swapWithBench = useCallback((starterIdx: number, benchPlayer: Player) => {
    const newPlayers = lineup.map((e, i) => i === starterIdx ? benchPlayer : e.player);
    const reassigned = reassignPositions(newPlayers);
    setLineup(reassigned);
  }, [lineup]);

  // Compute valid swap targets when a player is selected
  const validTargets = useMemo(() => {
    if (!selectedPlayer) return { lineup: new Set<number>(), bench: new Set<number>() };

    const validLineup = new Set<number>();
    const validBench = new Set<number>();

    if (selectedPlayer.source === 'lineup') {
      const selectedEntry = lineup[selectedPlayer.index];
      // Check other starters: can they swap positions?
      lineup.forEach((entry, idx) => {
        if (idx === selectedPlayer.index) return;
        if (canPlayPosition(selectedPlayer.player, entry.assignedPosition) &&
            canPlayPosition(entry.player, selectedEntry.assignedPosition)) {
          validLineup.add(idx);
        }
      });
      // Check bench players
      bench.forEach((bp, idx) => {
        if (canBenchReplaceStarter(bp, selectedEntry, lineup)) {
          validBench.add(idx);
        }
      });
    } else {
      // Bench player selected — check which starter slots they could fill
      lineup.forEach((entry, idx) => {
        if (canBenchReplaceStarter(selectedPlayer.player, entry, lineup)) {
          validLineup.add(idx);
        }
      });
    }

    return { lineup: validLineup, bench: validBench };
  }, [selectedPlayer, lineup, bench]);

  const hasSelection = selectedPlayer !== null;

  // Execute a swap between selected player and target
  const executeSwap = useCallback((targetSource: 'lineup' | 'bench', targetIndex: number) => {
    if (!selectedPlayer) return;

    if (selectedPlayer.source === 'lineup' && targetSource === 'lineup') {
      // Starter↔Starter: swap players, keep assigned positions
      const newLineup = [...lineup];
      const a = lineup[selectedPlayer.index];
      const b = lineup[targetIndex];
      newLineup[selectedPlayer.index] = { player: b.player, assignedPosition: a.assignedPosition };
      newLineup[targetIndex] = { player: a.player, assignedPosition: b.assignedPosition };
      setLineup(newLineup);
      setSwappedIndices(new Set([selectedPlayer.index, targetIndex]));
    } else if (selectedPlayer.source === 'lineup' && targetSource === 'bench') {
      swapWithBench(selectedPlayer.index, bench[targetIndex]);
      setSwappedIndices(new Set([selectedPlayer.index]));
    } else if (selectedPlayer.source === 'bench' && targetSource === 'lineup') {
      swapWithBench(targetIndex, selectedPlayer.player);
      setSwappedIndices(new Set([targetIndex]));
    }

    setSelectedPlayer(null);
    setTimeout(() => setSwappedIndices(new Set()), 300);
  }, [selectedPlayer, lineup, bench, swapWithBench]);

  // Handle tapping a lineup row
  const handleLineupTap = (idx: number) => {
    if (isConfirmed) return;

    // If no selection, select this player
    if (!selectedPlayer) {
      setSelectedPlayer({ source: 'lineup', index: idx, player: lineup[idx].player });
      return;
    }

    // If tapping the already-selected player, deselect
    if (selectedPlayer.source === 'lineup' && selectedPlayer.index === idx) {
      setSelectedPlayer(null);
      return;
    }

    // If this is a valid target, execute swap
    if (validTargets.lineup.has(idx)) {
      executeSwap('lineup', idx);
      return;
    }

    // Otherwise select this new player instead
    setSelectedPlayer({ source: 'lineup', index: idx, player: lineup[idx].player });
  };

  // Handle tapping a bench card
  const handleBenchTap = (benchIdx: number) => {
    if (isConfirmed) return;

    // If no selection, select this bench player
    if (!selectedPlayer) {
      setSelectedPlayer({ source: 'bench', index: benchIdx, player: bench[benchIdx] });
      return;
    }

    // If tapping the already-selected bench player, deselect
    if (selectedPlayer.source === 'bench' && selectedPlayer.index === benchIdx) {
      setSelectedPlayer(null);
      return;
    }

    // If this is a valid target (starter selected, bench player valid), execute swap
    if (selectedPlayer.source === 'lineup' && validTargets.bench.has(benchIdx)) {
      executeSwap('bench', benchIdx);
      return;
    }

    // Otherwise select this new bench player
    setSelectedPlayer({ source: 'bench', index: benchIdx, player: bench[benchIdx] });
  };

  // Get CSS class for a lineup row based on selection state
  const getLineupRowClass = (idx: number): string => {
    const classes = ['table-row'];
    if (swappedIndices.has(idx)) classes.push('swap-pulse');
    if (selectedPlayer?.source === 'lineup' && selectedPlayer.index === idx) {
      classes.push('swap-selected');
    } else if (hasSelection) {
      if (validTargets.lineup.has(idx)) {
        classes.push('swap-valid');
      } else {
        classes.push('swap-dimmed');
      }
    }
    return classes.join(' ');
  };

  // Get CSS class for a bench card based on selection state
  const getBenchCardClass = (benchIdx: number): string => {
    const classes = ['bench-card'];
    if (selectedPlayer?.source === 'bench' && selectedPlayer.index === benchIdx) {
      classes.push('swap-selected');
    } else if (hasSelection) {
      if (selectedPlayer?.source === 'lineup' && validTargets.bench.has(benchIdx)) {
        classes.push('swap-valid');
      } else if (selectedPlayer?.source === 'bench') {
        // Another bench player is selected — this bench card is not a target
        classes.push('swap-dimmed');
      } else {
        classes.push('swap-dimmed');
      }
    }
    return classes.join(' ');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
    setSelectedPlayer(null); // Clear selection when toggling sections
  };

  // Position summary bar data
  const positionSlots = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;

  return (
    <div className={`lineup-confirm ${isConfirmed ? 'confirmed' : ''}`}>
      <div className="lineup-header">
        <h3>{teamName}</h3>
        {isConfirmed && <span className="confirmed-badge">Confirmed</span>}
      </div>

      {/* Position Summary Bar */}
      <div className="position-bar">
        {positionSlots.map((pos) => {
          const entry = lineup.find(e => e.assignedPosition === pos);
          return (
            <div key={pos} className="pos-slot">
              <span className="pos-label" style={{ backgroundColor: getPositionColor(pos as Position) }}>{pos}</span>
              <span className="pos-initials">{entry ? getInitials(entry.player.name) : '--'}</span>
            </div>
          );
        })}
      </div>

      {/* Pitching Summary */}
      <div className="position-bar pitching-bar">
        {rotation.map((p, i) => (
          <div key={p.id} className="pos-slot">
            <span className="pos-label sp-label">G{i + 1}</span>
            <span className="pos-initials">{getInitials(p.name)}</span>
          </div>
        ))}
        {closer && (
          <div className="pos-slot">
            <span className="pos-label cl-label">CL</span>
            <span className="pos-initials">{getInitials(closer.name)}</span>
          </div>
        )}
      </div>

      <div className="lineup-sections">
        {/* Batting Order */}
        <div className="lineup-section">
          <button className="section-toggle" onClick={() => toggleSection('batting')}>
            <span>Batting Order</span>
            <span className="toggle-icon">{expandedSection === 'batting' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'batting' && (
            <div className="section-content">
              <div className="lineup-table">
                <div className="table-header">
                  <span className="col-order">#</span>
                  <span className="col-pos">POS</span>
                  <span className="col-name">Player</span>
                  <span className="col-stat">AVG</span>
                  <span className="col-stat">OBP</span>
                  <span className="col-stat hide-mobile">SLG</span>
                </div>
                <p className="auto-lineup-hint">
                  {hasSelection ? 'Tap a highlighted player to swap' : 'Tap a player to swap'}
                </p>
                {lineup.map((entry, idx) => (
                  <div
                    key={entry.player.id}
                    className={getLineupRowClass(idx)}
                    onClick={() => handleLineupTap(idx)}
                  >
                    <span className="col-order">{idx + 1}</span>
                    <span className="col-pos" style={{ backgroundColor: getPositionColor(entry.assignedPosition) }}>{entry.assignedPosition}</span>
                    <span className="col-name">{entry.player.name}</span>
                    <span className="col-stat">{formatBattingAvg(entry.player.stats.avg ?? 0)}</span>
                    <span className="col-stat">{formatBattingAvg(entry.player.stats.obp ?? 0)}</span>
                    <span className="col-stat hide-mobile">{formatBattingAvg(entry.player.stats.slg ?? 0)}</span>
                  </div>
                ))}
              </div>

              {/* Bench section */}
              {bench.length > 0 && (
                <div className="bench-section">
                  <span className="bench-label">
                    Bench {hasSelection ? '(tap to swap)' : '(tap a player above or below)'}
                  </span>
                  <div className="bench-grid">
                    {bench.map((p, benchIdx) => (
                      <button
                        key={p.id}
                        className={getBenchCardClass(benchIdx)}
                        disabled={isConfirmed}
                        onClick={() => handleBenchTap(benchIdx)}
                      >
                        <span className="bench-card-pos" style={{ backgroundColor: getPositionColor(p.positions[0]) }}>{p.positions[0]}</span>
                        <span className="bench-card-name">{p.name}</span>
                        <span className="bench-card-ovr">{p.overall}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rotation */}
        <div className="lineup-section">
          <button className="section-toggle" onClick={() => toggleSection('pitching')}>
            <span>Rotation & Bullpen</span>
            <span className="toggle-icon">{expandedSection === 'pitching' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'pitching' && (
            <div className="section-content">
              <div className="lineup-table">
                <div className="table-header pitcher-header">
                  <span className="col-game">Game</span>
                  <span className="col-name">Pitcher</span>
                  <span className="col-stat">ERA</span>
                  <span className="col-stat">WHIP</span>
                </div>
                {rotation.map((player, idx) => (
                  <div key={player.id} className="table-row pitcher-row">
                    <span className="col-game">
                      <button className="swap-btn" onClick={() => idx > 0 && swapRotation(idx, idx - 1)} disabled={idx === 0 || isConfirmed}>↑</button>
                      G{idx + 1}
                      <button className="swap-btn" onClick={() => idx < 3 && swapRotation(idx, idx + 1)} disabled={idx === 3 || isConfirmed}>↓</button>
                    </span>
                    <span className="col-name">{player.name}</span>
                    <span className="col-stat">{formatERA(player.stats.era ?? 0)}</span>
                    <span className="col-stat">{(player.stats.whip ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="bullpen-compact">
                {closer && (
                  <div className="bp-group">
                    <span className="role-label closer-label">CL</span>
                    <span className="bp-name">{closer.name}</span>
                    <span className="bp-stat">{formatERA(closer.stats.era ?? 0)}</span>
                  </div>
                )}
                {setup.length > 0 && setup.map(p => (
                  <div key={p.id} className="bp-group">
                    <span className="role-label setup-label">SU</span>
                    <span className="bp-name">{p.name}</span>
                    <span className="bp-stat">{formatERA(p.stats.era ?? 0)}</span>
                  </div>
                ))}
                {middleRelief.map(p => {
                  const role = p.positions.includes('LOOGY') ? 'LOO' : 'MR';
                  return (
                    <div key={p.id} className="bp-group">
                      <span className="role-label rp-label">{role}</span>
                      <span className="bp-name">{p.name}</span>
                      <span className="bp-stat">{formatERA(p.stats.era ?? 0)}</span>
                    </div>
                  );
                })}
                {longRelief.map(p => (
                  <div key={p.id} className="bp-group">
                    <span className="role-label lrp-label">LR</span>
                    <span className="bp-name">{p.name}</span>
                    <span className="bp-stat">{formatERA(p.stats.era ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isConfirmed && !showToast && (
        <div className="confirm-footer">
          <Button variant="success" onClick={handleConfirm}>
            Confirm Lineup
          </Button>
        </div>
      )}

      {showToast && (
        <div className="lineup-toast">Lineup Locked!</div>
      )}
    </div>
  );
}
