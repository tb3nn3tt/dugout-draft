import { MUTATORS } from './mutators';

// ============================================================================
// Daily Challenge — everyone gets the SAME draft conditions for a given day
// (seed derived from the date), so scores are directly comparable. Pure skill:
// same offers, same opponents, same sim randomness — who builds + manages best?
// A different run-mode rotates in each day to keep it fresh.
// ============================================================================

/** Local calendar date as YYYY-MM-DD (the challenge key, same for everyone that day). */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Deterministic 32-bit seed from the date key (FNV-1a). */
export function dailySeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}

/** The run-mode for the day (rotates so the daily feels different each time). */
export function dailyMutatorId(key: string): string {
  return MUTATORS[dailySeed(key) % MUTATORS.length].id;
}

/** Friendly label like "Jun 15". */
export function dailyLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${mon} ${d}, ${y}`;
}
