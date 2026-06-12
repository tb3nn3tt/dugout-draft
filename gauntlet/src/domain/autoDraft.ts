import { GauntletTeam, Player, Position } from './types';
import { playersPool, managersPool, stadiumsPool } from './players';
import { canPlayPosition } from './sim/helpers';

// Draft order for the position-player + pitching slots. Scarce defensive spots
// (C, SS) come first so the pool isn't drained by flexible bats. Manager and
// stadium are handled separately at the end.
const SLOT_ORDER: Position[] = [
  'C', 'SS', '2B', '3B', 'CF', 'RF', 'LF', '1B', 'DH',
  'SP', 'SP', 'SP', 'SP', 'CL', 'SU', 'SU', 'MRP', 'MRP', 'LRP', 'LOOGY',
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
  poolFilter?: (p: Player) => boolean
): GauntletTeam {
  const used = new Set<string>();
  const roster: Player[] = [];

  for (const pos of SLOT_ORDER) {
    let eligible = playersPool.filter(p => canPlayPosition(p, pos));
    if (poolFilter) {
      const filtered = eligible.filter(poolFilter);
      // Fall back to the full pool if a filter leaves a slot unfillable.
      if (filtered.length >= 3) eligible = filtered;
    }
    const pick = pickNear(eligible, targetOverall, used);
    if (pick) {
      used.add(pick.id);
      roster.push(pick);
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
