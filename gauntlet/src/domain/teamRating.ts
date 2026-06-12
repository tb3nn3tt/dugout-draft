import { Player } from './types';
import { isPitcher } from './sim/helpers';

// ============================================================================
// Live team projection shown during the draft, so each pick visibly moves the
// needle. Offense = avg overall of hitters, pitching = avg overall of arms.
// ============================================================================

export interface TeamProjection {
  offense: number;   // 0-99
  pitching: number;  // 0-99
  overall: number;   // 0-99
  hitters: number;
  pitchers: number;
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

export function projectTeam(picks: Player[]): TeamProjection {
  const athletes = picks.filter(p => !p.positions.includes('HC') && !p.positions.includes('ST'));
  const hitters = athletes.filter(p => !isPitcher(p));
  const pitchers = athletes.filter(isPitcher);
  const offense = avg(hitters.map(p => p.overall));
  const pitching = avg(pitchers.map(p => p.overall));
  // Weight offense + pitching by their roster share for a sensible overall.
  const all = athletes.map(p => p.overall);
  return {
    offense,
    pitching,
    overall: avg(all),
    hitters: hitters.length,
    pitchers: pitchers.length,
  };
}

/** Color for a 0-99 rating bar. */
export function ratingColor(v: number): string {
  if (v >= 90) return 'var(--diamond)';
  if (v >= 84) return 'var(--gold)';
  if (v >= 75) return 'var(--win)';
  if (v >= 65) return 'var(--accent)';
  return 'var(--text-dim)';
}
