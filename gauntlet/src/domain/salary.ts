import { Player, Tier } from './types';
import { getTier } from './players';

// ============================================================================
// Salary cap — the scarcity mechanic (no collections). Every card costs points
// that scale steeply with overall, and you draft a full roster under a fixed
// budget. You can splurge on a few studs OR spread it around, but you CANNOT
// have stars everywhere — that's the whole point. Managers/stadiums are free.
// ============================================================================

export const BUDGET = 600;

/** Cost of a card: cheap commons, very expensive elites. HC/ST are free. */
export function cardCost(p: Player): number {
  if (p.positions.includes('HC') || p.positions.includes('ST')) return 0;
  const c = Math.pow(Math.max(0, p.overall - 45) / 10, 2.3) * 2;
  return Math.max(1, Math.round(c));
}

const TIER_RANK: Tier[] = ['common', 'bronze', 'silver', 'gold', 'diamond'];

// Typical cost of a card in each tier, and the cheapest a slot can be filled.
const TYPICAL_COST: Record<Tier, number> = { diamond: 82, gold: 50, silver: 24, bronze: 8, common: 2 };
const MIN_RESERVE = 2;

/**
 * The richest tier you can roll: one you can afford a representative card of
 * while still leaving enough to fill every remaining slot with a cheap card.
 * This lets you splurge on a stud early (stars-and-scrubs) but locks out elites
 * once the budget is spent.
 */
export function maxTierForBudget(remaining: number, slotsLeft: number): Tier {
  const reserve = Math.max(0, slotsLeft - 1) * MIN_RESERVE;
  for (const t of ['diamond', 'gold', 'silver', 'bronze'] as Tier[]) {
    if (TYPICAL_COST[t] + reserve <= remaining) return t;
  }
  return 'common';
}

/** Cap a rolled tier to what the budget allows. */
export function capTier(rolled: Tier, remaining: number, slotsLeft: number): Tier {
  const max = maxTierForBudget(remaining, slotsLeft);
  return TIER_RANK.indexOf(rolled) <= TIER_RANK.indexOf(max) ? rolled : max;
}

export function affordable(p: Player, remaining: number): boolean {
  return cardCost(p) <= remaining;
}

/** Tier of a card (re-exported for convenience). */
export { getTier };
