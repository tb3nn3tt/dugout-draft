import { GauntletTeam, SeriesOutcome } from './types';

// ============================================================================
// Hall of Fame — the "best teams of all time" board. Phase 1 is local
// (localStorage); phase 2 will mirror this to Firebase for a global board.
// Score is streak-first, run-differential as the tiebreaker.
// ============================================================================

const KEY = 'dugout-gauntlet-hof-v2';   // bumped to clear the old local leaderboard
const MAX_ENTRIES = 50;

export interface HofEntry {
  teamName: string;
  streak: number;          // series won this run
  gameWins: number;        // total games won across the run
  gameLosses: number;      // total games lost
  runDiff: number;         // total run differential across the run
  runsFor: number;
  runsAgainst: number;
  managerName: string | null;
  stadiumName: string | null;
  managerId: string | null;
  stadiumId: string | null;
  playerIds: string[];     // to rehydrate the roster for display / re-runs
  series: SeriesOutcome[]; // per-series results from the run (opponent, W-L, runs)
  date: number;            // epoch ms
}

/** Derived per-game rate stats for the leaderboard (RS/G, RA/G, RD). */
export function entryRates(e: HofEntry) {
  const g = Math.max(1, e.gameWins + e.gameLosses);
  return {
    games: e.gameWins + e.gameLosses,
    rsg: e.runsFor / g,
    rag: e.runsAgainst / g,
    rd: e.runsFor - e.runsAgainst,
  };
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
  runsAgainst: number,
  gameWins: number,
  gameLosses: number,
  series: SeriesOutcome[] = []
): { entry: HofEntry; rank: number } {
  const entry: HofEntry = {
    teamName: team.name,
    streak,
    gameWins,
    gameLosses,
    runDiff: runsFor - runsAgainst,
    runsFor,
    runsAgainst,
    managerName: team.manager?.name ?? null,
    stadiumName: team.stadium?.name ?? null,
    managerId: team.manager?.id ?? null,
    stadiumId: team.stadium?.id ?? null,
    playerIds: team.roster.map(p => p.id),
    series,
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
