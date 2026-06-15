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
const FIELD_ROLES: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
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

/** A spun round is a GROUP (Texas Rangers, Speedsters, Playoff Heroes…). */
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
function fittingMembers(group: Group, remaining: Record<string, number>, picked: Set<string>, poolFilter?: (p: Player) => boolean, capA = false, capB = false): Player[] {
  const out: Player[] = [];
  for (const id of group.memberIds) {
    const p = getCard(id);
    if (!p || picked.has(p.id)) continue;
    if (capA && p.overall >= 85) continue;                       // star cap reached — no more A's
    if (capB && p.overall >= 70 && p.overall < 85) continue;     // regular cap reached — no more B's
    // A bench-tagged player is offerable ONLY if they can actually FIELD an open
    // defensive spot — a backup catcher at C, an IF/OF defender at their position
    // (this rescues high-rated cards mis-tagged as bench). Pure pinch-runners /
    // pinch-hitters, who'd only slide into DH via the catch-all, stay auto-fill depth.
    if (BENCH_POS.includes(p.positions[0]) &&
        !FIELD_ROLES.some(r => (remaining[r] ?? 0) > 0 && canPlayPosition(p, r))) continue;
    if (poolFilter && !isStaffCard(p) && !poolFilter(p)) continue;
    if (assignRole(p, remaining) !== null) out.push(p);
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Draft weight: a gentle decay above ~72 OVR, PLUS a team-aware soft cap — once a
// team already has a few A-grade studs (85+), further A's are strongly suppressed
// in the offers. So every team ends up a believable spread: a handful of stars and
// a lot of solid B/C role players, never an A at every position. `teamA` = how many
// A-grade players are already on the roster.
const A_SOFT_CAP = 1;   // A-grade odds start decaying once the team has this many
const A_HARD_CAP = 2;   // ...and stop entirely here — at most a couple of stars
const B_HARD_CAP = 5;   // after the stars + this many B-grade regulars, the rest is C/role-player
function draftWeight(overall: number, teamA: number): number {
  let w = Math.exp(-Math.max(0, overall - 72) / 14);
  if (overall >= 85) w *= Math.exp(-Math.max(0, teamA - A_SOFT_CAP) * 1.15);
  return w;
}
/** Order players by a quality-WEIGHTED random key (low OVR + the star cap come first). */
function weightedOrder(players: Player[], teamA: number): Player[] {
  return players
    .map(p => ({ p, k: Math.pow(rand(), 1 / draftWeight(p.overall, teamA)) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.p);
}

/**
 * Spin a GROUP and offer up to 4 of its players that fit an open roster slot.
 * The pick then auto-slots into the best open role it qualifies for.
 * Returns null only when the roster is full.
 *
 * opts.forceGroupId   → keep this group, re-deal 4 members ("Refresh").
 * opts.excludeGroupId → spin a DIFFERENT group ("New Group").
 */
export function spinGroupRound(
  remaining: Record<string, number>,
  picked: Set<string>,
  poolFilter?: (p: Player) => boolean,
  opts?: { forceGroupId?: string; excludeGroupId?: string }
): { round: DraftRound; offered: Player[] } | null {
  const open = Object.keys(remaining).filter(r => (remaining[r] ?? 0) > 0);
  if (open.length === 0) return null;

  // Quality caps: count A/B-grade players already on the roster. Once at a cap,
  // offers exclude that tier so a team fills out with a few stars, some regulars,
  // and a healthy number of C-grade role players — never A/B at every spot.
  let teamA = 0, teamB = 0;
  for (const id of picked) { const cp = getCard(id); if (!cp) continue; if (cp.overall >= 85) teamA++; else if (cp.overall >= 70) teamB++; }
  const capA = teamA >= A_HARD_CAP;
  const capB = teamB >= B_HARD_CAP;

  const candidates: Group[] = [...GROUPS];
  if ((remaining['HC'] ?? 0) > 0) candidates.push(STAFF_GROUPS.HC);
  if ((remaining['ST'] ?? 0) > 0) candidates.push(STAFF_GROUPS.ST);

  let viable = candidates.filter(g => fittingMembers(g, remaining, picked, poolFilter, capA, capB).length > 0);
  // "New Group" → don't land on the same one again (when alternatives exist).
  if (opts?.excludeGroupId) {
    const others = viable.filter(g => g.id !== opts.excludeGroupId);
    if (others.length > 0) viable = others;
  }

  let chosen: Group;
  const forced = opts?.forceGroupId ? candidates.find(g => g.id === opts.forceGroupId) : undefined;
  if (forced && fittingMembers(forced, remaining, picked, poolFilter).length > 0) {
    chosen = forced;                                   // "Refresh" — same group, new members
  } else if (viable.length > 0) {
    chosen = viable[Math.floor(rand() * viable.length)];
  } else {
    // Fallback: an ad-hoc "free agents" group of everyone who fits an open slot.
    // Respect the caps if possible; relax them only if nothing else is available.
    const buildFA = (caps: boolean) => playersPool
      .filter(p => !picked.has(p.id) && (!poolFilter || poolFilter(p)) && assignRole(p, remaining) !== null
        && (!caps || (!(capA && p.overall >= 85) && !(capB && p.overall >= 70 && p.overall < 85))))
      .map(p => p.id);
    let ids = buildFA(true);
    if (ids.length === 0) ids = buildFA(false);
    if ((remaining['HC'] ?? 0) > 0) ids.push(...STAFF_GROUPS.HC.memberIds);
    if ((remaining['ST'] ?? 0) > 0) ids.push(...STAFF_GROUPS.ST.memberIds);
    chosen = { id: 'free-agents', name: 'Free Agents', emoji: '🎲', blurb: 'A grab bag of available talent.', memberIds: ids };
  }

  const isStaff = chosen.id === STAFF_GROUPS.HC.id || chosen.id === STAFF_GROUPS.ST.id;

  // Build a SPREAD of 4 FROM THIS GROUP: role variety, and AT MOST ONE A-grade
  // card per offer — so you're never handed four stars to pick from. The ROSTER
  // A/B caps still gate the candidate pool (so a maxed-out team is offered no
  // more A's/B's, even under reroll abuse); relax only if that empties the group.
  let fitting = fittingMembers(chosen, remaining, picked, poolFilter, capA, capB);
  if (fitting.length === 0) fitting = fittingMembers(chosen, remaining, picked, poolFilter);
  const groupMembers = weightedOrder(fitting, teamA);

  const offered: Player[] = [];
  const usedIds = new Set<string>();
  const usedRoles = new Set<string>();
  let aCount = 0;
  const tryAdd = (p: Player, opts: { variety?: boolean; capA?: boolean } = {}) => {
    if (offered.length >= 4 || usedIds.has(p.id)) return;
    const r = assignRole(p, remaining);
    if (!r) return;
    if (opts.variety && usedRoles.has(r)) return;
    if (opts.capA && !isStaff && p.overall >= 85 && aCount >= 1) return;
    offered.push(p); usedIds.add(p.id); usedRoles.add(r);
    if (p.overall >= 85) aCount++;
  };
  // 1) non-A, one per open role   2) allow the single A, by role
  for (const m of groupMembers) if (m.overall < 85) tryAdd(m, { variety: true, capA: true });
  for (const m of groupMembers) tryAdd(m, { variety: true, capA: true });
  // 3) drop the role-variety constraint, still ≤1 A   4) last resort: fill to 4
  for (const m of groupMembers) tryAdd(m, { capA: true });
  for (const m of groupMembers) tryAdd(m, {});

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
