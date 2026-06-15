import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { gauntletReducer, initialState } from './gauntletReducer';
import { Player, GhostTeam } from '../domain/types';
import { findOpponent, MatchedOpponent } from '../domain/matchmaking';
import { buildSimTeam } from '../domain/sim/buildTeam';
import { playSeries } from '../domain/sim/series';
import { seedRng } from '../domain/sim/rng';
import { recordRun, HofEntry } from '../domain/hallOfFame';
import { getMutator } from '../domain/mutators';
import { getMyTeamIds } from '../firebase/ladder';
import { checkAchievements, Achievement } from '../domain/achievements';
import { sfxWin, sfxLoss } from '../domain/sound';

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Drives a gauntlet run. The draft is interactive; once it's done the run
 * AUTO-PLAYS — this hook simulates each best-of-7 in sequence, dispatching the
 * result so the screen's "This Run" list fills in, until a loss ends it.
 */
export function useGauntlet(ghostPool: GhostTeam[] = []) {
  const [state, dispatch] = useReducer(gauntletReducer, initialState);
  const [currentFoe, setCurrentFoe] = useState<MatchedOpponent | null>(null);
  const recordedRef = useRef(false);
  const runningRef = useRef(false);
  const hofResultRef = useRef<{ entry: HofEntry; rank: number } | null>(null);
  const freshAchievementsRef = useRef<Achievement[]>([]);

  const startRun = useCallback((teamName: string, mutatorId = 'standard') => {
    const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    seedRng(seed);
    recordedRef.current = false;
    runningRef.current = false;
    hofResultRef.current = null;
    setCurrentFoe(null);
    dispatch({ type: 'START_RUN', teamName, seed, mutatorId });
  }, []);

  const pick = useCallback((player: Player) => dispatch({ type: 'PICK', player }), []);
  const rerollRole = useCallback(() => dispatch({ type: 'REROLL_ROLE' }), []);
  const rerollPlayers = useCallback(() => dispatch({ type: 'REROLL_PLAYERS' }), []);
  const autofill = useCallback(() => dispatch({ type: 'AUTOFILL_REST' }), []);
  const swapSlots = useCallback((a: number, b: number) => dispatch({ type: 'SWAP_SLOTS', a, b }), []);
  const submitRoster = useCallback(() => dispatch({ type: 'SUBMIT_ROSTER' }), []);
  const backToMenu = useCallback(() => dispatch({ type: 'BACK_TO_MENU' }), []);

  // Auto-run the gauntlet: face opponent after opponent until a loss.
  useEffect(() => {
    if (state.phase !== 'gauntlet' || runningRef.current || !state.team) return;
    runningRef.current = true;
    const you = buildSimTeam(state.team, 'player1');
    const env = getMutator(state.mutatorId).env;
    const filter = getMutator(state.mutatorId).poolFilter;
    const excluded = new Set<string>([...state.facedGhostIds, ...getMyTeamIds()]);
    let streak = 0;
    let cancelled = false;

    (async () => {
      while (!cancelled) {
        const opp = findOpponent(streak, ghostPool, excluded, filter);
        if (opp.id) excluded.add(opp.id);
        setCurrentFoe(opp);
        await delay(700);                 // "now facing X"
        if (cancelled) return;
        const result = playSeries(you, buildSimTeam(opp.team, 'player2'), env);
        if (cancelled) return;
        dispatch({ type: 'APPEND_SERIES', opponent: opp, result });
        if (result.winner === 'you') { sfxWin(); streak++; await delay(600); }
        else { sfxLoss(); await delay(550); if (!cancelled) { setCurrentFoe(null); dispatch({ type: 'END_RUN' }); } break; }
      }
      runningRef.current = false;
    })();

    return () => { cancelled = true; runningRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Bank the run into the hall of fame once, when it's over; unlock achievements.
  useEffect(() => {
    if (state.phase === 'run_over' && state.team && !recordedRef.current) {
      recordedRef.current = true;
      const gameWins = state.history.reduce((a, h) => a + h.wins, 0);
      const gameLosses = state.history.reduce((a, h) => a + h.losses, 0);
      hofResultRef.current = recordRun(
        state.team, state.streak, state.totalRunsFor, state.totalRunsAgainst, gameWins, gameLosses, state.history
      );
      freshAchievementsRef.current = checkAchievements({
        streak: state.streak,
        runDiff: state.totalRunsFor - state.totalRunsAgainst,
        totalRunsFor: state.totalRunsFor,
        totalRunsAgainst: state.totalRunsAgainst,
        history: state.history,
        mutatorId: state.mutatorId,
      });
    }
  }, [state.phase, state.team, state.streak, state.totalRunsFor, state.totalRunsAgainst, state.history, state.mutatorId]);

  return {
    state,
    currentFoe,
    hofResult: hofResultRef.current,
    newAchievements: freshAchievementsRef.current,
    startRun,
    pick,
    rerollRole,
    rerollPlayers,
    autofill,
    swapSlots,
    submitRoster,
    backToMenu,
  };
}
