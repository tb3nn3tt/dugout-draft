import { Player, Position, RosterSlot } from './types';
import { playersPool, managersPool, stadiumsPool, getTier } from './players';
import { canPlayPosition } from './sim/helpers';
import { rand } from './sim/rng';

// ============================================================================
// Draft flow — the order slots are filled and how candidate cards are offered.
// Headline slots (the 9 starters + rotation + closer + manager + stadium) are
// the meaningful picks; the rest fill out a series-ready bench and bullpen.
// ============================================================================

export const DRAFT_SLOTS: RosterSlot[] = [
  { key: 'C', label: 'Catcher', fills: 'C' },
  { key: '1B', label: 'First Base', fills: '1B' },
  { key: '2B', label: 'Second Base', fills: '2B' },
  { key: '3B', label: 'Third Base', fills: '3B' },
  { key: 'SS', label: 'Shortstop', fills: 'SS' },
  { key: 'LF', label: 'Left Field', fills: 'LF' },
  { key: 'CF', label: 'Center Field', fills: 'CF' },
  { key: 'RF', label: 'Right Field', fills: 'RF' },
  { key: 'DH', label: 'Designated Hitter', fills: 'DH' },
  { key: 'SP1', label: 'Ace Starter', fills: 'SP' },
  { key: 'SP2', label: '#2 Starter', fills: 'SP' },
  { key: 'SP3', label: '#3 Starter', fills: 'SP' },
  { key: 'SP4', label: '#4 Starter', fills: 'SP' },
  { key: 'CL', label: 'Closer', fills: 'CL' },
  { key: 'SU1', label: 'Setup Man', fills: 'SU' },
  { key: 'SU2', label: 'Setup Man', fills: 'SU' },
  { key: 'MRP1', label: 'Middle Relief', fills: 'MRP' },
  { key: 'MRP2', label: 'Middle Relief', fills: 'MRP' },
  { key: 'LRP', label: 'Long Relief', fills: 'LRP' },
  { key: 'LOOGY', label: 'Lefty Specialist', fills: 'LOOGY' },
  { key: 'BC', label: 'Backup Catcher', fills: 'BC' },
  { key: 'PH1', label: 'Pinch Hitter', fills: 'PH' },
  { key: 'PH2', label: 'Pinch Hitter', fills: 'PH' },
  { key: 'PR', label: 'Pinch Runner', fills: 'PR' },
  { key: 'IFD', label: 'Infield Defense', fills: 'IFD' },
  { key: 'OFD', label: 'Outfield Defense', fills: 'OFD' },
  { key: 'HC', label: 'Manager', fills: 'HC' },
  { key: 'ST', label: 'Home Stadium', fills: 'ST' },
];

export const TOTAL_PICKS = DRAFT_SLOTS.length;

function poolForPosition(pos: Position): Player[] {
  if (pos === 'HC') return managersPool;
  if (pos === 'ST') return stadiumsPool;
  return playersPool.filter(p => canPlayPosition(p, pos));
}

/**
 * Offer `count` candidate cards for a slot. We sample a tiered spread — a couple
 * of strong options, a couple of mid, sometimes a sleeper — so every pick is a
 * real choice (stud vs. fit vs. upside), not just "take the highest number".
 * Uses the seeded RNG so a run's draft is reproducible.
 */
export function offerForSlot(pos: Position, pickedIds: Set<string>, count = 5): Player[] {
  const eligible = poolForPosition(pos)
    .filter(p => !pickedIds.has(p.id))
    .sort((a, b) => b.overall - a.overall);
  if (eligible.length <= count) return eligible;

  // Buckets by quality band so the offer always has range.
  const top = eligible.slice(0, Math.ceil(eligible.length * 0.15));   // best ~15%
  const mid = eligible.slice(Math.ceil(eligible.length * 0.15), Math.ceil(eligible.length * 0.55));
  const rest = eligible.slice(Math.ceil(eligible.length * 0.55));

  const pickFrom = (arr: Player[], n: number): Player[] => {
    const out: Player[] = [];
    const copy = [...arr];
    for (let i = 0; i < n && copy.length > 0; i++) {
      out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    }
    return out;
  };

  const offered = [
    ...pickFrom(top, 2),
    ...pickFrom(mid, 2),
    ...pickFrom(rest, 1),
  ].filter(Boolean);

  // Backfill if a bucket was thin.
  while (offered.length < count && eligible.length > offered.length) {
    const candidate = eligible[Math.floor(rand() * eligible.length)];
    if (!offered.some(o => o.id === candidate.id)) offered.push(candidate);
  }

  return offered.sort((a, b) => b.overall - a.overall);
}

/** Tier of a card for visual treatment in the draft UI. */
export { getTier };
