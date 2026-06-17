import { SeriesOutcome } from './types';

// ============================================================================
// Achievements — persistent badges unlocked at the end of a run. Pure retention
// + share fuel. Each is a predicate over a run summary; adding new ones is one
// line. Unlock state lives in localStorage.
// ============================================================================

export interface RunSummary {
  streak: number;
  runDiff: number;
  totalRunsFor: number;
  totalRunsAgainst: number;
  history: SeriesOutcome[];
  mutatorId: string;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  test: (s: RunSummary) => boolean;
}

const sweptASeries = (s: RunSummary) => s.history.some(h => h.won && h.wins === 4 && h.losses === 0);
const shutoutSeries = (s: RunSummary) => s.history.some(h => h.won && h.runsAgainst === 0);
const sevenGamer = (s: RunSummary) => s.history.some(h => h.won && h.wins === 4 && h.losses === 3);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'On the Board', emoji: '✅', description: 'Win your first series.', test: s => s.streak >= 1 },
  { id: 'streak_5', name: 'Hot Streak', emoji: '🔥', description: 'Reach a 5-series streak.', test: s => s.streak >= 5 },
  { id: 'streak_10', name: 'Juggernaut', emoji: '💪', description: 'Reach an 8-series streak.', test: s => s.streak >= 8 },
  { id: 'streak_15', name: 'Immortal', emoji: '👑', description: 'Reach a 12-series streak.', test: s => s.streak >= 12 },
  { id: 'sweep', name: 'Broom Closet', emoji: '🧹', description: 'Sweep a series 4-0.', test: sweptASeries },
  { id: 'seven', name: 'Survivor', emoji: '🎢', description: 'Win a series in all 7 games.', test: sevenGamer },
  { id: 'shutout', name: 'Lights Out', emoji: '🚫', description: 'Win a series allowing zero runs.', test: shutoutSeries },
  { id: 'dominant', name: 'Run Machine', emoji: '🚂', description: 'Finish a run at +50 run differential.', test: s => s.runDiff >= 50 },
  { id: 'deadball_5', name: 'Small Ball Savant', emoji: '🪨', description: 'Reach a 5-streak in Dead Ball mode.', test: s => s.mutatorId === 'dead_ball' && s.streak >= 5 },
  { id: 'legends_5', name: 'Time Lord', emoji: '⏳', description: 'Reach a 5-streak in Legends Only mode.', test: s => s.mutatorId === 'legends' && s.streak >= 5 },
  { id: 'juiced_diff', name: 'Bombs Away', emoji: '🚀', description: 'Finish +80 in Juiced Balls mode.', test: s => s.mutatorId === 'juiced' && s.runDiff >= 80 },
  { id: 'streak_3', name: 'Getting Hot', emoji: '♨️', description: 'Reach a 3-series streak.', test: s => s.streak >= 3 },
  { id: 'slugfest', name: 'Slugfest', emoji: '💥', description: 'Score 15+ runs in a single series.', test: s => s.history.some(h => h.runsFor >= 15) },
  { id: 'statement', name: 'Statement Win', emoji: '📣', description: 'Win a series by 20+ runs.', test: s => s.history.some(h => h.won && h.runsFor - h.runsAgainst >= 20) },
  { id: 'perfect_run', name: 'Untouchable', emoji: '🌟', description: 'Finish a run at +100 run differential.', test: s => s.runDiff >= 100 },
  { id: 'giant_killer', name: 'Giant Killer', emoji: '🗡️', description: 'Beat a deep-gauntlet powerhouse (a 9+ rung).', test: s => s.history.some(h => h.won && h.opponentStreak >= 9) },
];

const KEY = 'dugout-gauntlet-achievements';

export function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Evaluate a finished run; persist + return the NEWLY unlocked achievements. */
export function checkAchievements(summary: RunSummary): Achievement[] {
  const unlocked = loadUnlocked();
  const fresh: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.test(summary)) {
      unlocked.add(a.id);
      fresh.push(a);
    }
  }
  if (fresh.length > 0) {
    try { localStorage.setItem(KEY, JSON.stringify([...unlocked])); } catch { /* ignore */ }
  }
  return fresh;
}
