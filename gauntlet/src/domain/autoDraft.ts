import { GauntletTeam, Player, Position } from './types';
import { playersPool, managersPool, stadiumsPool } from './players';
import { canPlayPosition } from './sim/helpers';
import { cardCost } from './salary';

// Draft order for the position-player + pitching slots. Scarce defensive spots
// (C, SS) come first, but lineup and pitching are INTERLEAVED so that in budget
// mode the cap is spread across both — otherwise the 9 hitters drain the budget
// up front and the team fields punching-bag pitching (a real bug that made the
// famous-team ladder far too easy). Bench filler stays last (cheap). Manager and
// stadium are handled separately at the end.
const SLOT_ORDER: Position[] = [
  'C', 'SP', 'SS', 'SP', '2B', 'CL', '3B', 'SP', 'CF', 'SU',
  'RF', 'SP', '1B', 'SU', 'LF', 'MRP', 'DH', 'MRP', 'LRP', 'LOOGY',
  'BC', 'PH', 'PH', 'PR', 'IFD', 'OFD',
];

function pickNear(
  candidates: Player[],
  targetOverall: number,
  used: Set<string>
): Player | null {
  const available = candidates.filter(p => !used.has(p.id));
  if (available.length === 0) return null;
  // Rank by closeness to the target rating, then pick randomly from the closest
  // handful so two CPU teams at the same difficulty aren't identical.
  const ranked = available.sort(
    (a, b) => Math.abs(a.overall - targetOverall) - Math.abs(b.overall - targetOverall)
  );
  const windowSize = Math.min(6, ranked.length);
  return ranked[Math.floor(Math.random() * windowSize)];
}

/**
 * Build a complete CPU team whose overall strength centers on `targetOverall`
 * (roughly a 0-99 rating). Higher target -> tougher opponent. Used for the
 * gauntlet's CPU-fallback opponents and for seeding the ghost pool.
 */
export function autoDraftTeam(
  targetOverall: number,
  name: string,
  poolFilter?: (p: Player) => boolean,
  budget = Infinity
): GauntletTeam {
  const used = new Set<string>();
  const roster: Player[] = [];
  let remaining = budget;
  const MIN_RESERVE = 2;

  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const pos = SLOT_ORDER[i];
    const slotsLeft = SLOT_ORDER.length - i;
    const eligibleAll = playersPool.filter(p => canPlayPosition(p, pos) && !used.has(p.id));
    const themed = poolFilter ? eligibleAll.filter(poolFilter) : eligibleAll;
    const pool = themed.length >= 1 ? themed : eligibleAll;

    let pick: Player | null;
    if (budget === Infinity) {
      // Strength mode: pick near the target overall.
      pick = pickNear(pool, targetOverall, used);
      if (!pick) pick = pickNear(eligibleAll, targetOverall, used);
    } else {
      // Budget mode: best card affordable while reserving cheap fill for the rest.
      const reserve = (slotsLeft - 1) * MIN_RESERVE;
      const affordable = pool.filter(p => cardCost(p) <= remaining - reserve);
      if (affordable.length) {
        pick = affordable.sort((a, b) => b.overall - a.overall)[0];
      } else {
        // Over budget → cheapest from the FULL pool (themes can be uniformly
        // expensive, e.g. the high-rated Niners), so the roster stays under cap.
        pick = [...eligibleAll].sort((a, b) => cardCost(a) - cardCost(b))[0] ?? null;
      }
    }
    if (pick) {
      used.add(pick.id);
      roster.push(pick);
      remaining -= cardCost(pick);
    }
  }

  const manager = pickNear(managersPool, targetOverall, used);
  const stadium = pickNear(stadiumsPool, targetOverall, used);

  return { name, roster, manager, stadium };
}

/** Quick sanity check: enough cards drafted, plus a manager and stadium. */
export function isRosterComplete(team: GauntletTeam): boolean {
  return team.roster.length >= 20 && !!team.manager && !!team.stadium;
}
