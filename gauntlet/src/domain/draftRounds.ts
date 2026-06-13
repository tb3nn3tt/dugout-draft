import { Player, Position, Tier, PlayerCategory } from './types';
import { playersPool, getCard, getTier } from './players';
import { canPlayPosition } from './sim/helpers';
import { rand } from './sim/rng';
import { GROUPS, STAFF_GROUPS, Group } from './groups';

// ============================================================================
// Spin-the-wheel draft. Each pick spins a THEMED GROUP ("Texas Rangers", "Movie
// Shortstops", "Flamethrowers"…); you choose one of four of its players, and the
// pick auto-slots into the best open roster position it's eligible for. Roster
// positions can be reshuffled before you submit (see the roster editor).
// ============================================================================

const PITCHING_ROLES = ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
const RELIEVER_POS = ['CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
const BENCH_POS = ['PH', 'PR', 'BC', 'IFD', 'OFD'];
const isHitterCard = (p: Player) => !PITCHING_ROLES.includes(p.positions[0]) && p.positions[0] !== 'HC' && p.positions[0] !== 'ST';

// Full 28-man roster the sim needs.
export const ROLE_REQUIREMENTS: Record<string, number> = {
  C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1,
  SP: 4, CL: 1, SU: 2, MRP: 2, LRP: 1, LOOGY: 1,
  BC: 1, PH: 2, PR: 1, IFD: 1, OFD: 1,
  HC: 1, ST: 1,
};

// You draft only the IMPACTFUL pieces of a playoff roster: 9 batters, 4 starters,
// 3 high-leverage relievers (closer + 2 setup-equivalent), a coach + a field = 18.
// No bench in the draft — extra arms + a small bench auto-fill behind the scenes
// so the sim still plays full games.
export const MARQUEE_REQUIREMENTS: Record<string, number> = {
  C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1, // 9 batters
  SP: 4,                                                              // 4 starters
  RP: 3,                                                              // 3 high-leverage relievers
  HC: 1, ST: 1,                                                       // coach + field
};
export const DEPTH_REQUIREMENTS: Record<string, number> = {
  RP: 4,                                    // round out the bullpen for the sim
  BN: 4,                                    // a small bench for pinch/defense subs
};
export const TOTAL_PICKS = Object.values(MARQUEE_REQUIREMENTS).reduce((a, b) => a + b, 0);

/** A spun round is now a GROUP, not a tier/position. */
export interface DraftRound {
  groupId: string;
  name: string;       // group name, e.g. "Texas Rangers"
  emoji: string;
  flavor: string;     // one-line blurb
}

// ---------------------------------------------------------------------------
// Role eligibility + assignment
// ---------------------------------------------------------------------------

/** Can this player legally fill this OPEN roster role? */
export function playerFitsRole(p: Player, role: Position): boolean {
  switch (role) {
    case 'HC': return p.positions.includes('HC');
    case 'ST': return p.positions.includes('ST');
    case 'SP': return p.positions.includes('SP');
    case 'RP': return RELIEVER_POS.includes(p.positions[0]);
    case 'BN': return isHitterCard(p);     // any position player can sit the bench
    case 'DH': return isHitterCard(p);     // any hitter can DH
    default: return canPlayPosition(p, role); // C/1B/2B/3B/SS/LF/CF/RF (+ flex)
  }
}

// Order in which a picked player claims an open slot — scarce defense first, then
// rotation, pen, then DH/bench as catch-alls so a hitter always lands somewhere.
const ASSIGN_PRIORITY: Position[] = ['C', 'SS', '2B', '3B', 'CF', 'RF', 'LF', '1B', 'SP', 'RP', 'DH', 'BN', 'HC', 'ST'];

/** The best open role this player should slot into, or null if nothing fits. */
export function assignRole(p: Player, remaining: Record<string, number>): Position | null {
  const prim = p.positions[0] as Position;
  if ((remaining[prim] ?? 0) > 0 && playerFitsRole(p, prim)) return prim;
  for (const role of ASSIGN_PRIORITY) {
    if ((remaining[role] ?? 0) > 0 && playerFitsRole(p, role)) return role;
  }
  return null;
}

const isStaffCard = (p: Player) => p.positions[0] === 'HC' || p.positions[0] === 'ST';

/** Group members that are pickable now: not drafted, pass the mutator filter, and fit an open slot. */
function fittingMembers(group: Group, remaining: Record<string, number>, picked: Set<string>, poolFilter?: (p: Player) => boolean): Player[] {
  const out: Player[] = [];
  for (const id of group.memberIds) {
    const p = getCard(id);
    if (!p || picked.has(p.id)) continue;
    if (poolFilter && !isStaffCard(p) && !poolFilter(p)) continue;
    if (assignRole(p, remaining) !== null) out.push(p);
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Spin a group and offer up to 4 of its players that fit an open roster slot.
 * Returns null only when the roster is full.
 */
export function spinGroupRound(
  remaining: Record<string, number>,
  picked: Set<string>,
  poolFilter?: (p: Player) => boolean
): { round: DraftRound; offered: Player[] } | null {
  const open = Object.keys(remaining).filter(r => (remaining[r] ?? 0) > 0);
  if (open.length === 0) return null;

  const candidates: Group[] = [...GROUPS];
  if ((remaining['HC'] ?? 0) > 0) candidates.push(STAFF_GROUPS.HC);
  if ((remaining['ST'] ?? 0) > 0) candidates.push(STAFF_GROUPS.ST);

  const viable = candidates.filter(g => fittingMembers(g, remaining, picked, poolFilter).length > 0);

  let chosen: Group;
  if (viable.length > 0) {
    chosen = viable[Math.floor(rand() * viable.length)];
  } else {
    // Fallback: an ad-hoc "free agents" group of everyone who fits an open slot.
    const ids = playersPool
      .filter(p => !picked.has(p.id) && (!poolFilter || poolFilter(p)) && assignRole(p, remaining) !== null)
      .map(p => p.id);
    if ((remaining['HC'] ?? 0) > 0) ids.push(...STAFF_GROUPS.HC.memberIds);
    if ((remaining['ST'] ?? 0) > 0) ids.push(...STAFF_GROUPS.ST.memberIds);
    chosen = { id: 'free-agents', name: 'Free Agents', emoji: '🎲', blurb: 'A grab bag of available talent.', memberIds: ids };
  }

  const members = shuffle(fittingMembers(chosen, remaining, picked, poolFilter));
  // Offer VARIETY: prefer one player per distinct open slot this group can fill,
  // so a round shows e.g. a catcher, a center fielder, a third baseman and an arm
  // — you choose which position to fill — rather than four of the same spot.
  const byRole = new Map<string, Player>();
  for (const m of members) { const r = assignRole(m, remaining); if (r && !byRole.has(r)) byRole.set(r, m); }
  const offered: Player[] = [...byRole.values()];
  if (offered.length < 4) {
    const used = new Set(offered.map(p => p.id));
    for (const m of members) { if (offered.length >= 4) break; if (!used.has(m.id)) offered.push(m); }
  }
  return { round: { groupId: chosen.id, name: chosen.name, emoji: chosen.emoji, flavor: chosen.blurb }, offered: offered.slice(0, 4).sort((a, b) => b.overall - a.overall) };
}

// ---------------------------------------------------------------------------
// Depth auto-fill — still pulls the best available for a specific role.
// ---------------------------------------------------------------------------

function eligibleForRole(role: Position): Player[] {
  if (role === 'DH') return playersPool.filter(isHitterCard);
  if (role === 'RP') return playersPool.filter(p => RELIEVER_POS.includes(p.positions[0]));
  if (role === 'BN') return playersPool.filter(p => BENCH_POS.includes(p.positions[0]));
  return playersPool.filter(p => p.positions[0] === role);
}

/** A simple tiered offer for auto-filling depth roles (RP/BN). */
export function offerForRound(
  role: Position,
  tier: Tier,
  picked: Set<string>,
  _category?: PlayerCategory,
  count = 5,
  poolFilter?: (p: Player) => boolean,
): Player[] {
  const all = eligibleForRole(role).filter(p => !picked.has(p.id) && (!poolFilter || poolFilter(p)));
  const base = all.length ? all : eligibleForRole(role).filter(p => !picked.has(p.id));
  const tries: ((p: Player) => boolean)[] = [p => getTier(p.overall) === tier, () => true];
  let candidates: Player[] = [];
  for (const t of tries) { candidates = base.filter(t); if (candidates.length >= count) break; }
  if (candidates.length === 0) candidates = base;
  return shuffle([...candidates]).slice(0, count).sort((a, b) => b.overall - a.overall);
}
