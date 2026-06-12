// ============================================================================
// Seeded RNG. A run carries a seed; seeding makes a whole gauntlet (draft order,
// every series, every at-bat) reproducible — so "share this run" and "replay
// this game" are possible, and the hall of fame can be re-verified.
//
// We use a module-level current generator (the game is single-threaded in the
// browser). Call seedRng(seed) at the start of a deterministic stretch and
// resetRng() to return to non-deterministic Math.random.
// ============================================================================

export type RandFn = () => number;

/** mulberry32 — tiny, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): RandFn {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let current: RandFn = Math.random;

export function seedRng(seed: number): void {
  current = mulberry32(seed);
}

export function resetRng(): void {
  current = Math.random;
}

/** Draw a float in [0, 1). Use this everywhere instead of Math.random. */
export function rand(): number {
  return current();
}

/** Integer in [0, maxExclusive). */
export function randInt(maxExclusive: number): number {
  return Math.floor(rand() * maxExclusive);
}

/** Derive a stable child seed (e.g. per-series) from a base seed + index. */
export function deriveSeed(base: number, index: number): number {
  // Mix with a large odd constant so adjacent indices diverge quickly.
  return (Math.imul(base ^ (index + 1), 0x9e3779b1) >>> 0);
}
