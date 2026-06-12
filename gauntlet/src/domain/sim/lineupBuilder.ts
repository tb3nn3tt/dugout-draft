import { Player, Position } from '../types';
import { isHitter, canPlayPosition } from './helpers';

const DEFENSIVE_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const BENCH_ROLES: Position[] = ['BC', 'PH', 'PR', 'IFD', 'OFD'];

export interface LineupEntry {
  player: Player;
  assignedPosition: Position;
}

/** Returns true if all of a player's positions are bench roles (no defensive position) */
function isBenchOnly(player: Player): boolean {
  return player.positions.every(pos => BENCH_ROLES.includes(pos as Position));
}

/**
 * Sort 9 chosen starters into an optimal batting order:
 * Slots 1-2: Best OBP (table-setters)
 * Slots 3-5: Best SLG (power)
 * Slots 6-9: By overall rating
 */
function sortIntoBattingOrder(entries: LineupEntry[]): LineupEntry[] {
  if (entries.length === 0) return [];
  const pool = [...entries];
  const lineup: LineupEntry[] = [];

  // Slots 1-2: OBP
  pool.sort((a, b) => (b.player.stats.obp ?? 0) - (a.player.stats.obp ?? 0));
  lineup.push(pool.shift()!);
  if (pool.length > 0) lineup.push(pool.shift()!);

  // Slots 3-5: SLG
  pool.sort((a, b) => (b.player.stats.slg ?? 0) - (a.player.stats.slg ?? 0));
  for (let i = 0; i < 3 && pool.length > 0; i++) lineup.push(pool.shift()!);

  // Slots 6-9: Overall
  pool.sort((a, b) => b.player.overall - a.player.overall);
  while (pool.length > 0) lineup.push(pool.shift()!);

  return lineup;
}

/**
 * Generate a position-aware optimal lineup of 9 starters.
 * Ensures one player per defensive position (C, 1B, 2B, 3B, SS, LF, CF, RF, DH).
 * Returns LineupEntry[] with each player's assigned defensive position.
 */
export function generateOptimalLineup(roster: Player[]): LineupEntry[] {
  const hitters = roster.filter(isHitter);
  const starters = hitters.filter(h => !isBenchOnly(h));

  const usedIds = new Set<string>();
  const assigned: LineupEntry[] = [];

  // Step 1: Sort defensive positions by scarcity (fewest eligible candidates first)
  // This prevents conflicts — fill C and SS before 1B and DH
  const positionsByScarcity = [...DEFENSIVE_POSITIONS].sort((a, b) => {
    const aCount = starters.filter(h => canPlayPosition(h, a) && !usedIds.has(h.id)).length;
    const bCount = starters.filter(h => canPlayPosition(h, b) && !usedIds.has(h.id)).length;
    return aCount - bCount;
  });

  // Step 2: Assign best available player to each defensive position
  for (const pos of positionsByScarcity) {
    const candidates = starters.filter(
      h => canPlayPosition(h, pos) && !usedIds.has(h.id)
    );
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => b.overall - a.overall)[0];
      assigned.push({ player: best, assignedPosition: pos });
      usedIds.add(best.id);
    }
  }

  // Step 3: Fill DH with best remaining hitter (including bench players as DH)
  const dhCandidates = hitters.filter(h => !usedIds.has(h.id));
  if (dhCandidates.length > 0) {
    const bestDH = dhCandidates.sort((a, b) => b.overall - a.overall)[0];
    assigned.push({ player: bestDH, assignedPosition: 'DH' });
    usedIds.add(bestDH.id);
  }

  // Step 4: If we still don't have 9, fill from best available (edge case fallback)
  const remaining = hitters.filter(h => !usedIds.has(h.id))
    .sort((a, b) => b.overall - a.overall);
  while (assigned.length < 9 && remaining.length > 0) {
    const fallback = remaining.shift()!;
    assigned.push({ player: fallback, assignedPosition: 'DH' });
  }

  // Step 5: Sort into optimal batting order
  return sortIntoBattingOrder(assigned);
}

/**
 * Re-assign positions for an existing lineup after a swap.
 * Takes a list of players and tries to optimally assign defensive positions.
 */
export function reassignPositions(players: Player[]): LineupEntry[] {
  const usedIds = new Set<string>();
  const entries: LineupEntry[] = [];

  // Use same scarcity-first algorithm
  const positionsByScarcity = [...DEFENSIVE_POSITIONS].sort((a, b) => {
    const aCount = players.filter(h => canPlayPosition(h, a)).length;
    const bCount = players.filter(h => canPlayPosition(h, b)).length;
    return aCount - bCount;
  });

  for (const pos of positionsByScarcity) {
    const candidates = players.filter(
      h => canPlayPosition(h, pos) && !usedIds.has(h.id)
    );
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => b.overall - a.overall)[0];
      entries.push({ player: best, assignedPosition: pos });
      usedIds.add(best.id);
    }
  }

  // Remaining players get DH
  for (const p of players) {
    if (!usedIds.has(p.id)) {
      entries.push({ player: p, assignedPosition: 'DH' });
      usedIds.add(p.id);
    }
  }

  // Preserve original order
  return players.map(p => entries.find(e => e.player.id === p.id)!);
}

/**
 * Check if a bench player can replace a starter in the lineup.
 * Either the bench player directly fills the position, or reassigning
 * all 9 positions with the bench player produces a valid arrangement.
 */
export function canBenchReplaceStarter(
  benchPlayer: Player,
  starterEntry: LineupEntry,
  currentLineup: LineupEntry[]
): boolean {
  // Quick check: can the bench player play the exact assigned position?
  if (canPlayPosition(benchPlayer, starterEntry.assignedPosition)) return true;
  // Fallback: try reassigning all 9 positions with the bench player instead
  const newPlayers = currentLineup.map(e =>
    e.player.id === starterEntry.player.id ? benchPlayer : e.player
  );
  const reassigned = reassignPositions(newPlayers);
  // Valid if all 8 defensive positions are still covered
  const defPositions = new Set(
    reassigned.filter(e => e.assignedPosition !== 'DH').map(e => e.assignedPosition)
  );
  return defPositions.size >= Math.min(8, reassigned.length - 1);
}

export function generateOptimalRotation(roster: Player[]): Player[] {
  const starters = roster.filter(p => p.positions.includes('SP'));
  return [...starters].sort((a, b) => (a.stats.era ?? 99) - (b.stats.era ?? 99)).slice(0, 4);
}

export interface BullpenConfig {
  closer: Player | null;
  setup: Player[];
  middleRelief: Player[];
  longRelief: Player[];
}

export function generateOptimalBullpen(roster: Player[]): BullpenConfig {
  const allRelievers = roster.filter(p =>
    p.positions.some(pos => ['CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(pos))
  );
  const sorted = [...allRelievers].sort((a, b) => (a.stats.era ?? 99) - (b.stats.era ?? 99));
  const closers = sorted.filter(p => p.positions.includes('CL'));
  const closer = closers[0] || sorted[0] || null;
  const remaining = sorted.filter(p => p.id !== closer?.id);
  const setupCandidates = remaining.filter(p => p.positions.includes('SU'));
  const setup = setupCandidates.slice(0, 2);
  const afterSetup = remaining.filter(p => !setup.some(s => s.id === p.id));
  const lrpCandidates = afterSetup.filter(p => p.positions.includes('LRP'));
  const longRelief = lrpCandidates.slice(0, 2);
  const middleRelief = afterSetup.filter(p => !longRelief.some(l => l.id === p.id));
  return { closer, setup, middleRelief, longRelief };
}
