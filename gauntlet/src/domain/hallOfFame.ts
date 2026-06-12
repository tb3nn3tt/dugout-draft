import { GauntletTeam } from './types';

// ============================================================================
// Hall of Fame — the "best teams of all time" board. Phase 1 is local
// (localStorage); phase 2 will mirror this to Firebase for a global board.
// Score is streak-first, run-differential as the tiebreaker.
// ============================================================================

const KEY = 'dugout-gauntlet-hof';
const MAX_ENTRIES = 50;

export interface HofEntry {
  teamName: string;
  streak: number;          // series won this run
  runDiff: number;         // total run differential across the run
  runsFor: number;
  runsAgainst: number;
  managerName: string | null;
  stadiumName: string | null;
  playerIds: string[];     // to rehydrate the roster for display / re-runs
  date: number;            // epoch ms
}

export function loadHof(): HofEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HofEntry[]) : [];
  } catch {
    return [];
  }
}

/** Higher streak wins; ties broken by run differential. */
export function rankHof(entries: HofEntry[]): HofEntry[] {
  return [...entries].sort((a, b) => b.streak - a.streak || b.runDiff - a.runDiff);
}

/**
 * Record a finished run. Returns the saved entry and its rank (1-based) on the
 * board — handy for the share card ("#3 of all time!").
 */
export function recordRun(
  team: GauntletTeam,
  streak: number,
  runsFor: number,
  runsAgainst: number
): { entry: HofEntry; rank: number } {
  const entry: HofEntry = {
    teamName: team.name,
    streak,
    runDiff: runsFor - runsAgainst,
    runsFor,
    runsAgainst,
    managerName: team.manager?.name ?? null,
    stadiumName: team.stadium?.name ?? null,
    playerIds: team.roster.map(p => p.id),
    date: Date.now(),
  };

  const ranked = rankHof([...loadHof(), entry]).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(ranked));
  } catch {
    // storage full / unavailable — non-fatal
  }
  const rank = ranked.findIndex(e => e.date === entry.date && e.teamName === entry.teamName) + 1;
  return { entry, rank: rank || ranked.length };
}
