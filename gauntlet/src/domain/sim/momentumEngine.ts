import { AtBatResult, Player, GameState, PressureLevel } from '../types';
import { calculatePressure } from './gameNarrative';

// --- MOMENTUM ---
export interface MomentumState {
  away: number;  // 0-100
  home: number;  // 0-100
}

export interface MomentumUpdate {
  newMomentum: MomentumState;
  event: 'rally_building' | 'momentum_shift' | 'rally_killed' | null;
}

export function createInitialMomentum(): MomentumState {
  return { away: 0, home: 0 };
}

export function updateMomentum(
  current: MomentumState,
  result: AtBatResult,
  isAwayBatting: boolean
): MomentumUpdate {
  const team = isAwayBatting ? 'away' : 'home';
  const opponent = isAwayBatting ? 'home' : 'away';
  const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
  const isWalk = result === 'walk';
  const isOut = !isHit && !isWalk;

  const newMomentum = { ...current };
  let event: MomentumUpdate['event'] = null;

  if (isHit || isWalk) {
    const boost = result === 'homerun' ? 30
      : result === 'triple' ? 20
      : result === 'double' ? 15
      : isWalk ? 8
      : 10;
    newMomentum[team] = Math.min(100, current[team] + boost);
    newMomentum[opponent] = Math.max(0, current[opponent] - 5);

    if (newMomentum[team] >= 50 && current[team] < 50) {
      event = 'rally_building';
    }
    if (current[opponent] >= 50 && newMomentum[opponent] < 50) {
      event = 'momentum_shift';
    }
  } else if (isOut) {
    const decay = result === 'double_play' ? 30
      : result === 'strikeout' ? 20
      : 15;
    newMomentum[team] = Math.max(0, current[team] - decay);

    if (current[team] >= 50 && newMomentum[team] < 30) {
      event = 'rally_killed';
    }
  }

  return { newMomentum, event };
}

export function resetHalfInningMomentum(current: MomentumState): MomentumState {
  return {
    away: Math.max(0, current.away - 20),
    home: Math.max(0, current.home - 20),
  };
}

/** Convert momentum (0-100) to grade point boost (0 to +5) */
export function getMomentumBoost(momentum: number): number {
  return (momentum / 100) * 5;
}

// --- BATTER STREAKS ---
export interface BatterStreakMap {
  [playerId: string]: {
    hits: number;
    atBats: number;
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
  if (streak.hits >= 2) return 3;                          // "hot" batter
  if (streak.atBats >= 4 && streak.hits === 0) return -3;  // "cold" batter
  return 0;
}

// --- CLUTCH ---

/** Get default clutch grade based on player category */
function getDefaultClutchGrade(player: Player): number {
  const category = player.category;
  if (category === 'legend' || category === 'peak' || category === 'playoff') return 70;
  return 50;
}

export function getClutchBoost(
  player: Player,
  gameState: Pick<GameState, 'inning' | 'halfInning' | 'outs' | 'runners' | 'score'>
): number {
  const pressure = calculatePressure(gameState as GameState);
  if (pressure === 'low') return 0;

  const clutchGrade = player.grades?.clutch ?? getDefaultClutchGrade(player);
  // 50 clutch = 0 boost, 80 clutch = +5, 20 clutch = -5
  const baseBoost = (clutchGrade - 50) / 6;

  const pressureMultiplier: Record<PressureLevel, number> = {
    clutch: 1.0,
    high: 0.7,
    medium: 0.3,
    low: 0,
  };

  return baseBoost * pressureMultiplier[pressure];
}

// --- NARRATIVE ---
export function getMomentumDescription(event: 'rally_building' | 'momentum_shift' | 'rally_killed'): string {
  switch (event) {
    case 'rally_building': return 'Rally building! The bats are coming alive!';
    case 'momentum_shift': return 'Momentum shift!';
    case 'rally_killed': return 'Rally killed. The defense shuts it down.';
  }
}

export function getClutchDescription(batterName: string, result: AtBatResult): string {
  const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
  if (result === 'homerun') return `CLUTCH BOMB by ${batterName}!`;
  if (isHit) return `Clutch hit by ${batterName}!`;
  if (result === 'walk') return `${batterName} works a clutch walk!`;
  return '';
}
