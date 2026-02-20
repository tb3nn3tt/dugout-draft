// Server-side momentum engine (Deno-compatible port)
// Mirrors the logic from src/utils/momentumEngine.ts

import { AtBatResult } from './simulation.ts';

export interface MomentumState {
  away: number;
  home: number;
}

export interface BatterStreakMap {
  [playerId: string]: {
    hits: number;
    atBats: number;
  };
}

export function createInitialMomentum(): MomentumState {
  return { away: 0, home: 0 };
}

export function updateMomentum(
  current: MomentumState,
  result: AtBatResult,
  isAwayBatting: boolean
): { newMomentum: MomentumState; event: string | null } {
  const team = isAwayBatting ? 'away' : 'home';
  const opponent = isAwayBatting ? 'home' : 'away';
  const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
  const isWalk = result === 'walk';
  const isOut = !isHit && !isWalk;

  const newMomentum = { ...current };
  let event: string | null = null;

  if (isHit || isWalk) {
    const boost = result === 'homerun' ? 30
      : result === 'triple' ? 20
      : result === 'double' ? 15
      : isWalk ? 8
      : 10;
    newMomentum[team] = Math.min(100, current[team] + boost);
    newMomentum[opponent] = Math.max(0, current[opponent] - 5);

    if (newMomentum[team] >= 50 && current[team] < 50) event = 'rally_building';
    if (current[opponent] >= 50 && newMomentum[opponent] < 50) event = 'momentum_shift';
  } else if (isOut) {
    const decay = result === 'double_play' ? 30 : result === 'strikeout' ? 20 : 15;
    newMomentum[team] = Math.max(0, current[team] - decay);
    if (current[team] >= 50 && newMomentum[team] < 30) event = 'rally_killed';
  }

  return { newMomentum, event };
}

export function resetHalfInningMomentum(current: MomentumState): MomentumState {
  return {
    away: Math.max(0, current.away - 20),
    home: Math.max(0, current.home - 20),
  };
}

export function updateBatterStreak(
  streaks: BatterStreakMap,
  batterId: string,
  result: AtBatResult
): BatterStreakMap {
  const current = streaks[batterId] || { hits: 0, atBats: 0 };
  const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
  const isAB = result !== 'walk';

  return {
    ...streaks,
    [batterId]: {
      hits: isHit ? current.hits + 1 : current.hits,
      atBats: isAB ? current.atBats + 1 : current.atBats,
    },
  };
}

export function getStreakModifier(streaks: BatterStreakMap, batterId: string): number {
  const streak = streaks[batterId];
  if (!streak) return 0;
  if (streak.hits >= 2) return 3;
  if (streak.atBats >= 4 && streak.hits === 0) return -3;
  return 0;
}
