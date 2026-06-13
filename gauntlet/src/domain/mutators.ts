import { ParkEffect, Player } from './types';

// ============================================================================
// Run mutators — chosen before a run, they reshape the draft pool and/or the
// run-wide environment. They add variety, replayability, and brag-worthy modes
// ("12-0 in Dead Ball"). Each is self-contained so adding new ones is trivial.
// ============================================================================

export interface Mutator {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Global environment multipliers, combined on top of each game's stadium. */
  env?: Partial<ParkEffect>;
  /** Restrict which cards are draftable (athletes only; HC/ST unaffected). */
  poolFilter?: (p: Player) => boolean;
}

const isPitcher = (p: Player) =>
  p.positions.some(x => ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(x));

export const MUTATORS: Mutator[] = [
  {
    id: 'standard',
    name: 'Standard',
    emoji: '⚾',
    description: 'The classic gauntlet. Full player pool, neutral conditions.',
  },
  {
    id: 'dead_ball',
    name: 'Dead Ball',
    emoji: '🪨',
    description: 'Home runs are scarce. Small ball, pitching, and defense win.',
    env: { hrFactor: 0.45, doublesFactor: 1.1, triplesFactor: 1.3, runFactor: 0.9 },
  },
  {
    id: 'juiced',
    name: 'Juiced Balls',
    emoji: '🚀',
    description: 'The ball is flying. Bombs everywhere, slugfests galore.',
    env: { hrFactor: 1.6, doublesFactor: 1.15, runFactor: 1.12 },
  },
  {
    id: 'sluggers',
    name: 'Sluggers Only',
    emoji: '💪',
    description: 'Only big bats and power arms — draft a wrecking crew. A stacked, higher-scoring romp.',
    poolFilter: (p) =>
      isPitcher(p)
        ? (p.grades?.fastball ?? 50) >= 55
        : (p.grades?.power ?? 50) >= 58,
  },
  {
    id: 'legends',
    name: 'Legends Only',
    emoji: '👑',
    description: 'History\'s greatest only — an all-time roster. The power-fantasy victory lap.',
    poolFilter: (p) => p.overall >= 85,
  },
  {
    id: 'coors',
    name: 'Mile High',
    emoji: '🏔️',
    description: 'Thin air everywhere. Every park plays like Coors Field.',
    env: { hrFactor: 1.25, doublesFactor: 1.2, triplesFactor: 1.4, runFactor: 1.18 },
  },
];

export function getMutator(id: string): Mutator {
  return MUTATORS.find(m => m.id === id) ?? MUTATORS[0];
}

/** Combine a base park with a mutator's env multipliers (multiplicative). */
export function combinePark(base: ParkEffect, env?: Partial<ParkEffect>): ParkEffect {
  if (!env) return base;
  return {
    name: base.name,
    hrFactor: base.hrFactor * (env.hrFactor ?? 1),
    doublesFactor: base.doublesFactor * (env.doublesFactor ?? 1),
    triplesFactor: base.triplesFactor * (env.triplesFactor ?? 1),
    runFactor: base.runFactor * (env.runFactor ?? 1),
    errorFactor: base.errorFactor * (env.errorFactor ?? 1),
  };
}
