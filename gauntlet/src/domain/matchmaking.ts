import { GauntletTeam, GhostTeam, Player } from './types';
import { hydrateIds, getCard } from './players';
import { autoDraftTeam } from './autoDraft';
import { famousForStreak, buildFamousTeam } from './famousTeams';
import { rand } from './sim/rng';

// ============================================================================
// Hybrid matchmaking: face a real player's stored "ghost" team when the pool
// has one near your streak; otherwise face a CPU team scaled to your streak.
// ============================================================================

export type OpponentKind = 'ghost' | 'famous' | 'cpu';

export interface MatchedOpponent {
  team: GauntletTeam;     // hydrated, sim-ready
  displayName: string;    // team name shown to the player
  ownerName: string;      // who drafted it (or "CPU"/"Legendary")
  streak: number;         // the opponent's banked streak
  isGhost: boolean;       // true = real player's team
  kind: OpponentKind;
  id?: string;            // ladder doc id (ghosts) — to avoid rematches
  emoji?: string;         // famous-team identity
  era?: string;
  blurb?: string;
}

const CPU_TEAM_NAMES = [
  'River Rats', 'Steel Hounds', 'Dust Devils', 'Night Owls', 'Iron Pigs',
  'Sea Wolves', 'Thunder Goats', 'Sand Gnats', 'Mud Hens', 'Yard Goats',
  'Rumble Ponies', 'Flying Squirrels', 'Baby Cakes', 'Trash Pandas', 'Jumbo Shrimp',
];

function cpuName(streak: number): string {
  // Vary by streak so consecutive CPU foes feel distinct without RNG-only churn.
  const base = CPU_TEAM_NAMES[(streak * 7 + Math.floor(Math.random() * CPU_TEAM_NAMES.length)) % CPU_TEAM_NAMES.length];
  return base;
}

/** Rehydrate a stored ghost snapshot into a playable team. */
export function hydrateGhost(ghost: GhostTeam): GauntletTeam {
  return {
    name: ghost.teamName,
    roster: hydrateIds(ghost.playerIds),
    manager: ghost.managerId ? getCard(ghost.managerId) ?? null : null,
    stadium: ghost.stadiumId ? getCard(ghost.stadiumId) ?? null : null,
  };
}

// ===========================================================================
// ⬇⬇⬇  THE DIFFICULTY CURVE — this is the single most important knob on how
//        the whole game feels. It maps "how many series you've already won"
//        to "how strong the CPU fallback opponent should be" (a 0-99 rating
//        that autoDraftTeam centers the opponent roster on).
//
//   Baseline below is a gentle linear-ish ramp. Tune it to taste — see the
//   notes in the chat for the tradeoffs (too steep = runs die at streak 2;
//   too flat = strong drafters go 30-0 and get bored).
// ===========================================================================
export function targetOverallForStreak(streak: number): number {
  // streak 0: a beatable warm-up (~80). Each win ratchets the bar up briskly so
  // even a stacked roster starts facing real resistance within a handful of
  // series, with a soft cap so it never demands a literally impossible team.
  // Tuned against a max-greedy auto-drafted team that previously cruised to 11-0;
  // the goal is satisfying runs that typically end in the ~4-12 range.
  const START = 81;   // first opponent's center rating
  const STEP = 2.0;   // how much tougher each win makes the next foe
  const CAP = 97;     // hardest opponents top out here
  return Math.min(CAP, Math.round(START + streak * STEP));
}

/**
 * Pick the next opponent. `ghostPool` is whatever ghosts we've already fetched
 * from the shared pool (may be empty — that's the cold-start case). `excludeIds`
 * lets the run skip ghosts already faced (and your own team).
 */
export function findOpponent(
  streak: number,
  ghostPool: GhostTeam[],
  excludeIds: Set<string> = new Set(),
  poolFilter?: (p: Player) => boolean
): MatchedOpponent {
  // A real submitted team whose own ladder wins are close to the player's streak
  // (comparable accomplishment; both are salary-capped so it's a fair fight).
  const bucket = ghostPool
    .filter(g => !excludeIds.has(g.id) && g.playerIds.length >= 20 && Math.abs(g.streak - streak) <= 1)
    .sort(() => rand() - 0.5);
  const ghost = bucket[0] ?? null;
  const famous = famousForStreak(streak);

  const asGhost = (): MatchedOpponent => ({
    id: ghost!.id,
    team: hydrateGhost(ghost!),
    displayName: ghost!.teamName,
    ownerName: ghost!.ownerName,
    streak: ghost!.streak,
    isGhost: true,
    kind: 'ghost',
  });

  // Mix real teams into the famous-team ladder: from streak 2+, ~50% of the time
  // when a matching real team exists, you face it instead of the famous club.
  if (ghost && streak >= 2 && (!famous || rand() < 0.5)) return asGhost();

  if (famous) {
    return {
      team: buildFamousTeam(famous),
      displayName: famous.name,
      ownerName: 'Legendary',
      streak,
      isGhost: false,
      kind: 'famous',
      emoji: famous.emoji,
      era: famous.era,
      blurb: famous.blurb,
    };
  }

  // Past the famous ladder: real teams first, then a streak-scaled CPU.
  if (ghost) return asGhost();
  const target = targetOverallForStreak(streak);
  const team = autoDraftTeam(target, cpuName(streak), poolFilter);
  return { team, displayName: team.name, ownerName: 'CPU', streak, isGhost: false, kind: 'cpu' };
}
