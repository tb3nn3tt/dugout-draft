import { Player, Position, Tier, PlayerCategory } from './types';
import { playersPool, managersPool, stadiumsPool, getTier } from './players';
import { canPlayPosition, getPositionLabel } from './sim/helpers';
import { rand } from './sim/rng';
import { capTier, affordable, cardCost } from './salary';

// ============================================================================
// Spin-draft rounds. Each pick "spins" a quality (tier) and a role you still
// need, sometimes themed from baseball history/fiction/lore — producing a named
// round with a flavored offer. Backed by the expanded pool so every (role x
// tier) cell has a full slate.
// ============================================================================

// Full 28-man roster the sim needs.
export const ROLE_REQUIREMENTS: Record<string, number> = {
  C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1,
  SP: 4, CL: 1, SU: 2, MRP: 2, LRP: 1, LOOGY: 1,
  BC: 1, PH: 2, PR: 1, IFD: 1, OFD: 1,
  HC: 1, ST: 1,
};

// You only INTERACTIVELY draft the marquee 14 — the players who define a team —
// so a run is quick to click through. The depth (extra arms + bench) auto-fills.
export const MARQUEE_REQUIREMENTS: Record<string, number> = {
  C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, LF: 1, CF: 1, RF: 1, DH: 1, // 9 lineup
  SP: 2, CL: 1,                                                       // ace + #2 + closer
  HC: 1, ST: 1,                                                       // manager + ballpark
};
export const DEPTH_REQUIREMENTS: Record<string, number> = {
  SP: 2, SU: 2, MRP: 2, LRP: 1, LOOGY: 1,   // rotation depth + bullpen
  BC: 1, PH: 2, PR: 1, IFD: 1, OFD: 1,      // bench
};
export const TOTAL_PICKS = Object.values(MARQUEE_REQUIREMENTS).reduce((a, b) => a + b, 0);

export interface DraftRound {
  role: Position;
  roleLabel: string;
  tier: Tier;
  name: string;       // round title, e.g. "The Diamond Mine"
  emoji: string;
  flavor: string;     // one-line theme blurb
  category?: PlayerCategory; // themed pool, when applicable
}

// --- tiers: weighted so diamond is a treat and silver is the workhorse ---
const TIER_WEIGHTS: { tier: Tier; w: number }[] = [
  { tier: 'diamond', w: 12 },
  { tier: 'gold', w: 26 },
  { tier: 'silver', w: 34 },
  { tier: 'bronze', w: 18 },
  { tier: 'common', w: 10 },
];
function spinTier(): Tier {
  const total = TIER_WEIGHTS.reduce((a, t) => a + t.w, 0);
  let r = rand() * total;
  for (const t of TIER_WEIGHTS) { if ((r -= t.w) < 0) return t.tier; }
  return 'silver';
}

const TIER_META: Record<Tier, { label: string; emoji: string }> = {
  diamond: { label: 'Diamond', emoji: '💎' },
  gold: { label: 'Gold', emoji: '🏅' },
  silver: { label: 'Silver', emoji: '⚪' },
  bronze: { label: 'Bronze', emoji: '🟫' },
  common: { label: 'Common', emoji: '⚾' },
};

// --- themed pools drawn from real card categories (fact + fiction + lore) ---
interface Theme { category: PlayerCategory; name: string; emoji: string; flavor: string; }
const THEMES: Theme[] = [
  { category: 'legend', name: 'Cooperstown Calls', emoji: '🏆', flavor: 'The immortals. History\'s very best step to the plate.' },
  { category: 'fictional', name: 'Hollywood Heaters', emoji: '🎬', flavor: 'Straight off the silver screen — fact\'s wilder cousins.' },
  { category: 'oddity', name: 'Tales from the Bush Leagues', emoji: '🃏', flavor: 'Cult heroes, one-game wonders, and beautiful weirdos.' },
  { category: 'decade', name: 'Throwback Threads', emoji: '📻', flavor: 'Dialed back to a golden age of the game.' },
  { category: 'playoff', name: 'October Legends', emoji: '🍂', flavor: 'Forged under the brightest lights.' },
  { category: 'international', name: 'Around the Horn of the World', emoji: '🌎', flavor: 'Stars from every corner of the baseball globe.' },
  { category: 'niners', name: 'The Niners Sandlot', emoji: '🐻', flavor: 'The misfits, the kids, the heart of the game.' },
  { category: 'busts', name: 'Bust or Boom', emoji: '🎲', flavor: 'Phenoms who never were — or maybe, this time, will be.' },
];

// Some named "pure tier" rounds for flavor when no theme is rolled.
// Named by QUALITY TIER (not player archetype) so a slick-fielding silver hitter
// in a silver round doesn't read as a contradiction.
const TIER_ROUND_NAMES: Record<Tier, { name: string; flavor: string }> = {
  diamond: { name: 'The Diamond Vault', flavor: 'The rarest, highest-rated players in the game.' },
  gold: { name: 'The Gold Standard', flavor: 'Bona fide A-list talent — the backbone of a contender.' },
  silver: { name: 'The Silver Circuit', flavor: 'Solid, reliable pros who quietly win you ballgames.' },
  bronze: { name: 'The Bronze League', flavor: 'Affordable role players and blue-collar depth.' },
  common: { name: 'The Open Tryout', flavor: 'Bargain-bin fliers and diamonds in the rough.' },
};

function poolFor(role: Position): Player[] {
  if (role === 'HC') return managersPool;
  if (role === 'ST') return stadiumsPool;
  return playersPool.filter(p => canPlayPosition(p, role));
}

/** Build a tiered, optionally-themed offer for a role, widening if a cell is thin. */
export function offerForRound(
  role: Position,
  tier: Tier,
  pickedIds: Set<string>,
  category?: PlayerCategory,
  count = 5,
  poolFilter?: (p: Player) => boolean,
  budgetRemaining = Infinity
): Player[] {
  const all = poolFor(role).filter(p => !pickedIds.has(p.id));
  let base = all.filter(p => affordable(p, budgetRemaining));
  // Safety net: if nothing's affordable for this slot, offer the cheapest cards
  // anyway so the draft always completes (a forced cheap fill).
  if (base.length === 0) {
    return [...all].sort((a, b) => cardCost(a) - cardCost(b)).slice(0, count);
  }
  const restrict = poolFilter && role !== 'HC' && role !== 'ST' ? poolFilter : undefined;
  const usable = restrict ? base.filter(restrict) : base;

  // Try progressively looser constraints until we have a full slate.
  const tries: ((p: Player) => boolean)[] = [
    p => getTier(p.overall) === tier && (!category || p.category === category),
    p => getTier(p.overall) === tier,
    p => (!category || p.category === category),
    () => true,
  ];
  let candidates: Player[] = [];
  for (const t of tries) {
    candidates = usable.filter(t);
    if (candidates.length >= count) break;
  }
  // If a restrictive mutator left no affordable themed cards for this slot, fall
  // back to affordable cards (any theme) so the draft never stalls.
  if (candidates.length === 0) candidates = base;
  // Random sample from the matched candidates.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).sort((a, b) => b.overall - a.overall);
}

/** Spin the next round given which roles are still needed + the budget left. */
export function spinRound(
  remaining: Record<string, number>,
  budgetRemaining = Infinity,
  slotsLeft = 1
): DraftRound {
  const needed = Object.keys(remaining).filter(r => remaining[r] > 0) as Position[];
  const role = needed[Math.floor(rand() * needed.length)];
  const roleLabel = getPositionLabel(role);

  // Manager + stadium get their own bespoke rounds (free — no budget impact).
  if (role === 'HC') {
    return { role, roleLabel: 'Manager', tier: 'gold', name: 'Hire a Skipper', emoji: '🎩', flavor: 'Every great club needs a great mind in the dugout.' };
  }
  if (role === 'ST') {
    return { role, roleLabel: 'Ballpark', tier: 'gold', name: 'Claim Your Cathedral', emoji: '🏟️', flavor: 'Pick the field you\'ll call home — it shapes every game.' };
  }

  // Budget caps how rich a tier you can roll — broke teams draw lower tiers.
  const tier = capTier(spinTier(), budgetRemaining, slotsLeft);
  // ~38% of player rounds get a history/fiction theme.
  const themed = rand() < 0.38;
  if (themed) {
    const theme = THEMES[Math.floor(rand() * THEMES.length)];
    return {
      role, roleLabel, tier,
      name: theme.name, emoji: theme.emoji, flavor: theme.flavor,
      category: theme.category,
    };
  }
  const tm = TIER_META[tier];
  const tn = TIER_ROUND_NAMES[tier];
  return { role, roleLabel, tier, name: tn.name, emoji: tm.emoji, flavor: tn.flavor };
}
