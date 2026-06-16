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

const STREAK_KEY = 'dugout-gauntlet-daily-streak';
const yesterdayKey = (key: string) => { const [y, m, d] = key.split('-').map(Number); const dt = new Date(y, m - 1, d - 1); return todayKey(dt); };

/** Record that today's daily was played; returns the new consecutive-day streak. */
export function recordDailyPlayed(key: string): number {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    if (raw.lastDate === key) return raw.count || 1;          // already counted today
    const count = raw.lastDate === yesterdayKey(key) ? (raw.count || 0) + 1 : 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: key, count }));
    return count;
  } catch { return 0; }
}

/** Current consecutive-day streak (0 if the chain is broken). */
export function getDailyStreak(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    const t = todayKey();
    if (raw.lastDate === t || raw.lastDate === yesterdayKey(t)) return raw.count || 0;
    return 0;
  } catch { return 0; }
}

/** True once today's challenge has been played (to nudge / mark done on the menu). */
export function playedToday(): boolean {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY) || '{}').lastDate === todayKey(); } catch { return false; }
}
