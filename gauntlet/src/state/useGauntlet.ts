import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { gauntletReducer, initialState } from './gauntletReducer';
import { Player, GhostTeam } from '../domain/types';
import { findOpponent } from '../domain/matchmaking';
import { buildSimTeam } from '../domain/sim/buildTeam';
import { playSeries } from '../domain/sim/series';
import { seedRng } from '../domain/sim/rng';
import { recordRun, HofEntry } from '../domain/hallOfFame';
import { getMutator } from '../domain/mutators';

/**
 * Drives a gauntlet run. Pure domain logic lives in the reducer + sim; this hook
 * owns the side effects: seeding the RNG, finding the next opponent, running the
 * (synchronous) series with a brief "simulating" beat for UX, and banking the
 * run into the hall of fame exactly once when it ends.
 */
export function useGauntlet(ghostPool: GhostTeam[] = []) {
  const [state, dispatch] = useReducer(gauntletReducer, initialState);
  const [simulating, setSimulating] = useState(false);
  const recordedRef = useRef(false);
  const hofResultRef = useRef<{ entry: HofEntry; rank: number } | null>(null);

  const startRun = useCallback((teamName: string, mutatorId = 'standard') => {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    seedRng(seed);
    recordedRef.current = false;
    hofResultRef.current = null;
    dispatch({ type: 'START_RUN', teamName, seed, mutatorId });
  }, []);

  const pick = useCallback((player: Player) => dispatch({ type: 'PICK', player }), []);
  const autofill = useCallback(() => dispatch({ type: 'AUTOFILL_REST' }), []);
  const nextOpponent = useCallback(() => dispatch({ type: 'NEXT_OPPONENT' }), []);
  const backToMenu = useCallback(() => dispatch({ type: 'BACK_TO_MENU' }), []);

  // Matchmaking: as soon as we enter the phase, find the next foe.
  useEffect(() => {
    if (state.phase !== 'matchmaking') return;
    const excluded = new Set(state.facedGhostIds);
    const filter = getMutator(state.mutatorId).poolFilter;
    const opponent = findOpponent(state.streak, ghostPool, excluded, filter);
    const t = setTimeout(() => dispatch({ type: 'SET_OPPONENT', opponent }), 600);
    return () => clearTimeout(t);
  }, [state.phase, state.streak, state.facedGhostIds, state.mutatorId, ghostPool]);

  // Play the current series (called from the matchup screen).
  const playCurrentSeries = useCallback(() => {
    if (!state.team || !state.opponent) return;
    setSimulating(true);
    // Defer so the UI can paint the "simulating" state before the sync sim runs.
    setTimeout(() => {
      const you = buildSimTeam(state.team!, 'player1');
      const opp = buildSimTeam(state.opponent!.team, 'player2');
      const env = getMutator(state.mutatorId).env;
      const result = playSeries(you, opp, env);
      setSimulating(false);
      dispatch({ type: 'RESOLVE_SERIES', result });
    }, 50);
  }, [state.team, state.opponent, state.mutatorId]);

  // Bank the run into the hall of fame once, when it's over.
  useEffect(() => {
    if (state.phase === 'run_over' && state.team && !recordedRef.current) {
      recordedRef.current = true;
      hofResultRef.current = recordRun(
        state.team, state.streak, state.totalRunsFor, state.totalRunsAgainst
      );
    }
  }, [state.phase, state.team, state.streak, state.totalRunsFor, state.totalRunsAgainst]);

  return {
    state,
    simulating,
    hofResult: hofResultRef.current,
    startRun,
    pick,
    autofill,
    playCurrentSeries,
    nextOpponent,
    backToMenu,
  };
}
