import { Player, Position, ROSTER_REQUIREMENTS, TOTAL_ROSTER_SIZE, QUICK_ROSTER_SIZE, QUICK_ROSTER_REQUIREMENTS, GameMode, DraftRoundType, SpecialPlayer } from '../types';
import playersData from '../data/players.json';
import historicalPlayersData from '../data/historical-players.json';
import singleSeasonPlayersData from '../data/single-season-players.json';
import fictionalPlayersData from '../data/fictional-players.json';
import ninersPlayersData from '../data/niners-players.json';
import decade60s70sPlayersData from '../data/decade-60s70s-players.json';
import decade80s90sPlayersData from '../data/decade-80s90s-players.json';
import playoffHeroesPlayersData from '../data/playoff-heroes-players.json';
import oneYearWondersPlayersData from '../data/one-year-wonders-players.json';
import bustedProspectsData from '../data/busted-prospects.json';
import steroidEraPlayersData from '../data/steroid-era-players.json';
import internationalPlayersData from '../data/international-players.json';
import coachesData from '../data/coaches.json';

export const allPlayers: Player[] = playersData as Player[];

export type Tier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'common';
export const ALL_TIERS: Tier[] = ['diamond', 'gold', 'silver', 'bronze', 'common'];

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function getNextPicker(_currentPick: 'player1' | 'player2', pickNumber: number): 'player1' | 'player2' {
  // Snake draft: 1,2,2,1,1,2,2,1...
  const round = Math.floor((pickNumber - 1) / 2);
  const posInRound = (pickNumber - 1) % 2;
  if (round % 2 === 0) {
    return posInRound === 0 ? 'player1' : 'player2';
  }
  return posInRound === 0 ? 'player2' : 'player1';
}

export function getPositionCounts(roster: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = {
    C: 0, '1B': 0, '2B': 0, '3B': 0, SS: 0,
    LF: 0, CF: 0, RF: 0, DH: 0,
    BC: 0, PH: 0, PR: 0, IFD: 0, OFD: 0,
    SP: 0, CL: 0, SU: 0, MRP: 0, LRP: 0, LOOGY: 0,
    HC: 0,
  };
  roster.forEach(player => {
    if (player.positions.length > 0) {
      const primaryPos = player.positions[0];
      counts[primaryPos]++;
    }
  });
  return counts;
}

function getRequirements(mode: GameMode = 'standard'): Partial<Record<Position, number>> {
  return mode === 'quick' ? QUICK_ROSTER_REQUIREMENTS : ROSTER_REQUIREMENTS;
}

export function getNeededPositions(roster: Player[], mode: GameMode = 'standard'): Position[] {
  const counts = getPositionCounts(roster);
  const reqs = getRequirements(mode);
  const needed: Position[] = [];
  (Object.keys(reqs) as Position[]).forEach(pos => {
    if (counts[pos] < (reqs[pos] || 0)) {
      needed.push(pos);
    }
  });
  return needed;
}

/**
 * Count total unfilled roster slots (accounts for positions needing multiple, e.g. PH x2).
 */
export function getRemainingNeedCount(roster: Player[], mode: GameMode = 'standard'): number {
  const counts = getPositionCounts(roster);
  const reqs = getRequirements(mode);
  let needs = 0;
  (Object.keys(reqs) as Position[]).forEach(pos => {
    const deficit = (reqs[pos] || 0) - counts[pos];
    if (deficit > 0) needs += deficit;
  });
  return needs;
}

export function playerFillsPosition(player: Player, positions: Position[]): boolean {
  return player.positions.some(pos => positions.includes(pos));
}

export function getPlayerTier(overall: number): Tier {
  if (overall >= 90) return 'diamond';
  if (overall >= 85) return 'gold';
  if (overall >= 80) return 'silver';
  if (overall >= 75) return 'bronze';
  return 'common';
}

/**
 * Structured tier progression: early rounds are premium, tapering down.
 * Round = ceil(pickNumber / 2). Special rounds ignore tiers entirely.
 * Normal rounds: 1-2 Diamond, 4,6 Gold, 8,10,12 Silver, 14,16,18 Bronze, 20+ Common.
 * 15% chance to upgrade one tier for a pleasant surprise.
 */
export function getCurrentRoundTier(pickNumber: number): Tier {
  const round = Math.ceil(pickNumber / 2);

  let baseTier: Tier;
  if (round <= 2) baseTier = 'diamond';
  else if (round <= 6) baseTier = 'gold';
  else if (round <= 12) baseTier = 'silver';
  else if (round <= 18) baseTier = 'bronze';
  else baseTier = 'common';

  // Small chance to upgrade one tier (keeps it exciting)
  if (Math.random() < 0.15) {
    const upgrade: Record<Tier, Tier> = {
      common: 'bronze', bronze: 'silver', silver: 'gold', gold: 'diamond', diamond: 'diamond',
    };
    return upgrade[baseTier];
  }

  return baseTier;
}

// Legacy stubs for online sync compatibility
export function generateRandomTierSequence(): Tier[] {
  // No longer random — tiers are derived from pick number
  return [];
}
export function setCurrentTierSequence(_seq: Tier[]): void { /* no-op */ }
export function resetTierSequence(): void { /* no-op */ }

export function getDraftRoundType(pickNumber: number): DraftRoundType {
  const roundNumber = Math.ceil(pickNumber / 2);
  if (roundNumber === 3) return 'legends';
  if (roundNumber === 5) return 'niners';
  if (roundNumber === 7) return 'peak';
  if (roundNumber === 9) return 'decade_classic';
  if (roundNumber === 11) return 'coach';
  if (roundNumber === 13) return 'decade_modern';
  if (roundNumber === 14) return 'fictional';
  if (roundNumber === 16) return 'mystery';
  if (roundNumber === 18) return 'playoff_heroes';
  if (roundNumber === 20) return 'one_year_wonders';
  if (roundNumber === 22) return 'busts';
  if (roundNumber === 24) return 'auction';
  if (roundNumber === 25) return 'steroid_era';
  if (roundNumber === 26) return 'international';
  return 'normal';
}

/**
 * Quick Play: compressed 13-round draft with fewer special rounds.
 */
export function getDraftRoundTypeQuick(pickNumber: number): DraftRoundType {
  const roundNumber = Math.ceil(pickNumber / 2);
  if (roundNumber === 3) return 'legends';
  if (roundNumber === 5) return 'niners';
  if (roundNumber === 7) return 'mystery';
  if (roundNumber === 8) return 'coach';
  if (roundNumber === 10) return 'peak';
  if (roundNumber === 12) return 'fictional';
  return 'normal';
}

/**
 * Quick Play tier curve: compressed over 13 rounds.
 */
export function getCurrentRoundTierQuick(pickNumber: number): Tier {
  const round = Math.ceil(pickNumber / 2);
  let baseTier: Tier;
  if (round <= 1) baseTier = 'diamond';
  else if (round <= 3) baseTier = 'gold';
  else if (round <= 6) baseTier = 'silver';
  else if (round <= 9) baseTier = 'bronze';
  else baseTier = 'common';

  if (Math.random() < 0.15) {
    const upgrade: Record<Tier, Tier> = {
      common: 'bronze', bronze: 'silver', silver: 'gold', gold: 'diamond', diamond: 'diamond',
    };
    return upgrade[baseTier];
  }
  return baseTier;
}

export function getSpecialPlayerPool(roundType: DraftRoundType): SpecialPlayer[] {
  switch (roundType) {
    case 'legends': return historicalPlayersData as SpecialPlayer[];
    case 'niners': return ninersPlayersData as SpecialPlayer[];
    case 'peak': return singleSeasonPlayersData as SpecialPlayer[];
    case 'decade_classic': return decade60s70sPlayersData as SpecialPlayer[];
    case 'decade_modern': return decade80s90sPlayersData as SpecialPlayer[];
    case 'fictional': return fictionalPlayersData as SpecialPlayer[];
    case 'playoff_heroes': return playoffHeroesPlayersData as SpecialPlayer[];
    case 'one_year_wonders': return oneYearWondersPlayersData as SpecialPlayer[];
    case 'busts': return bustedProspectsData as SpecialPlayer[];
    case 'steroid_era': return steroidEraPlayersData as SpecialPlayer[];
    case 'international': return internationalPlayersData as SpecialPlayer[];
    case 'coach': return coachesData as SpecialPlayer[];
    default: return [];
  }
}

/**
 * Check if a player's primary position is already at max for the given roster.
 */
function isPositionMaxed(player: Player, roster: Player[], mode: GameMode = 'standard'): boolean {
  const counts = getPositionCounts(roster);
  const reqs = getRequirements(mode);
  // A player is "maxed" if ALL of their positions are at or above the requirement
  return player.positions.every(pos => {
    const max = reqs[pos] ?? 0;
    return max > 0 && counts[pos] >= max;
  });
}

/**
 * Draw a card targeted at a specific team's needs.
 * Strongly prefers players that fill the target team's needed positions.
 */
function drawCardForTeam(
  available: Player[],
  currentPool: Player[],
  targetRoster: Player[],
  targetNeeds: Position[],
  targetTier: Tier,
  mode: GameMode = 'standard'
): Player | null {
  const currentIds = new Set(currentPool.map(p => p.id));
  let remaining = available.filter(p => !currentIds.has(p.id));
  if (remaining.length === 0) return null;

  // Filter out players whose positions are all maxed for target team
  const nonMaxed = remaining.filter(p => !isPositionMaxed(p, targetRoster, mode));
  if (nonMaxed.length > 0) {
    remaining = nonMaxed;
  }

  // Try tier-filtered first
  const tierPlayers = remaining.filter(p => getPlayerTier(p.overall) === targetTier);
  const tierPool = tierPlayers.length > 0 ? tierPlayers : remaining;

  // Strongly prefer need-filling players (always try, not just 60%)
  if (targetNeeds.length > 0) {
    const neededPlayers = tierPool.filter(p => playerFillsPosition(p, targetNeeds));
    if (neededPlayers.length > 0) {
      return neededPlayers[Math.floor(Math.random() * neededPlayers.length)];
    }
    // Fall back: try without tier filter
    const neededAnyTier = remaining.filter(p => playerFillsPosition(p, targetNeeds));
    if (neededAnyTier.length > 0) {
      return neededAnyTier[Math.floor(Math.random() * neededAnyTier.length)];
    }
  }

  // No need-filling players available — pick from tier pool
  return tierPool[Math.floor(Math.random() * tierPool.length)];
}

export function drawNewCard(
  available: Player[],
  currentPool: Player[],
  team1Roster: Player[],
  team2Roster: Player[],
  currentPick: 'player1' | 'player2',
  targetTier: Tier,
  mode: GameMode = 'standard'
): Player | null {
  const currentRoster = currentPick === 'player1' ? team1Roster : team2Roster;
  const neededPositions = getNeededPositions(currentRoster, mode);
  return drawCardForTeam(available, currentPool, currentRoster, neededPositions, targetTier, mode);
}

export function rebuildCardPool(
  available: Player[],
  count: number,
  team1Roster: Player[],
  team2Roster: Player[],
  _currentPick: 'player1' | 'player2',
  pickNumber: number,
  mode: GameMode = 'standard',
): Player[] {
  const pool: Player[] = [];
  const roundType = mode === 'quick' ? getDraftRoundTypeQuick(pickNumber) : getDraftRoundType(pickNumber);
  const rosterSize = mode === 'quick' ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;

  if (roundType === 'auction') {
    return [];
  }

  // Check if either team is running low on slack (must fill needs soon)
  const t1Remaining = rosterSize - team1Roster.length;
  const t2Remaining = rosterSize - team2Roster.length;
  const t1NeedCount = getRemainingNeedCount(team1Roster, mode);
  const t2NeedCount = getRemainingNeedCount(team2Roster, mode);
  const t1MustFill = t1Remaining <= t1NeedCount + 2;
  const t2MustFill = t2Remaining <= t2NeedCount + 2;

  const team1Needs = getNeededPositions(team1Roster, mode);
  const team2Needs = getNeededPositions(team2Roster, mode);

  const draftedIds = new Set([
    ...team1Roster.map(p => p.id),
    ...team2Roster.map(p => p.id)
  ]);

  if (roundType === 'mystery') {
    const remaining = available.filter(p => !draftedIds.has(p.id));

    // If a team must fill, ensure at least one mystery card fills their needs
    if (t1MustFill || t2MustFill) {
      const mysteryPool: Player[] = [];
      // Guarantee need-filling cards first
      if (t1MustFill && team1Needs.length > 0) {
        const t1Fillers = remaining.filter(p => playerFillsPosition(p, team1Needs));
        if (t1Fillers.length > 0) {
          mysteryPool.push(t1Fillers[Math.floor(Math.random() * t1Fillers.length)]);
        }
      }
      if (t2MustFill && team2Needs.length > 0) {
        const usedIds = new Set(mysteryPool.map(p => p.id));
        const t2Fillers = remaining.filter(p => !usedIds.has(p.id) && playerFillsPosition(p, team2Needs));
        if (t2Fillers.length > 0) {
          mysteryPool.push(t2Fillers[Math.floor(Math.random() * t2Fillers.length)]);
        }
      }
      // Fill remaining slots from tier-diverse pool
      const mysteryTiers: Tier[] = ['diamond', 'gold', 'silver', 'bronze'];
      const usedIds = new Set(mysteryPool.map(p => p.id));
      for (const tier of mysteryTiers) {
        if (mysteryPool.length >= count) break;
        const tierPlayers = remaining.filter(p => !usedIds.has(p.id) && getPlayerTier(p.overall) === tier);
        if (tierPlayers.length > 0) {
          const pick = tierPlayers[Math.floor(Math.random() * tierPlayers.length)];
          mysteryPool.push(pick);
          usedIds.add(pick.id);
        }
      }
      return shuffleArray(mysteryPool);
    }

    // Standard mystery: one from each tier
    const mysteryTiers: Tier[] = ['diamond', 'gold', 'silver', 'bronze'];
    const mysteryPool: Player[] = [];
    for (const tier of mysteryTiers) {
      const tierPlayers = remaining.filter(p => getPlayerTier(p.overall) === tier && !mysteryPool.some(pp => pp.id === p.id));
      if (tierPlayers.length > 0) {
        mysteryPool.push(tierPlayers[Math.floor(Math.random() * tierPlayers.length)]);
      }
    }
    return shuffleArray(mysteryPool);
  }

  if (roundType !== 'normal') {
    const specialPool: Player[] = getSpecialPlayerPool(roundType);
    const availableSpecial = shuffleArray([...specialPool]).filter(p => !draftedIds.has(p.id));

    const specialResult: Player[] = [];
    const half = Math.floor(count / 2);

    // Pick up to half that fill team1 needs
    const t1Candidates = availableSpecial.filter(p => playerFillsPosition(p, team1Needs));
    for (let i = 0; i < half && t1Candidates.length > 0; i++) {
      const pick = t1Candidates.splice(Math.floor(Math.random() * t1Candidates.length), 1)[0];
      specialResult.push(pick);
    }

    // Pick up to half that fill team2 needs (skip already picked)
    const pickedIds = new Set(specialResult.map(p => p.id));
    const t2Candidates = availableSpecial.filter(p => !pickedIds.has(p.id) && playerFillsPosition(p, team2Needs));
    for (let i = 0; i < half && t2Candidates.length > 0; i++) {
      const pick = t2Candidates.splice(Math.floor(Math.random() * t2Candidates.length), 1)[0];
      specialResult.push(pick);
    }

    // Fill remaining slots with any available special
    const usedIds = new Set(specialResult.map(p => p.id));
    const remainder = availableSpecial.filter(p => !usedIds.has(p.id));
    while (specialResult.length < count && remainder.length > 0) {
      specialResult.push(remainder.shift()!);
    }

    // If a team is in must-fill mode but got zero need-filling cards from
    // the special pool, supplement from the general pool
    const resultIds = new Set(specialResult.map(p => p.id));
    const generalAvail = available.filter(p => !draftedIds.has(p.id) && !resultIds.has(p.id));

    if (t1MustFill && team1Needs.length > 0) {
      const hasT1Need = specialResult.some(p => playerFillsPosition(p, team1Needs));
      if (!hasT1Need) {
        const generalFiller = generalAvail.filter(p => playerFillsPosition(p, team1Needs));
        if (generalFiller.length > 0) {
          const filler = generalFiller[Math.floor(Math.random() * generalFiller.length)];
          // Replace the last non-need card
          if (specialResult.length >= count) {
            specialResult.pop();
          }
          specialResult.push(filler);
        }
      }
    }

    if (t2MustFill && team2Needs.length > 0) {
      const resultIds2 = new Set(specialResult.map(p => p.id));
      const hasT2Need = specialResult.some(p => playerFillsPosition(p, team2Needs));
      if (!hasT2Need) {
        const generalFiller = generalAvail.filter(p => !resultIds2.has(p.id) && playerFillsPosition(p, team2Needs));
        if (generalFiller.length > 0) {
          const filler = generalFiller[Math.floor(Math.random() * generalFiller.length)];
          if (specialResult.length >= count) {
            specialResult.pop();
          }
          specialResult.push(filler);
        }
      }
    }

    return shuffleArray(specialResult);
  }

  // Normal rounds
  let remainingAvailable = shuffleArray([...available]);
  const targetTier = mode === 'quick' ? getCurrentRoundTierQuick(pickNumber) : getCurrentRoundTier(pickNumber);
  const half = Math.floor(count / 2);

  // Draw half the cards targeted at team 1's needs
  for (let i = 0; i < half && remainingAvailable.length > 0; i++) {
    const card = drawCardForTeam(remainingAvailable, pool, team1Roster, team1Needs, targetTier, mode);
    if (card) {
      pool.push(card);
      remainingAvailable = remainingAvailable.filter(p => p.id !== card.id);
    }
  }

  // Draw half the cards targeted at team 2's needs
  for (let i = 0; i < half && remainingAvailable.length > 0; i++) {
    const card = drawCardForTeam(remainingAvailable, pool, team2Roster, team2Needs, targetTier, mode);
    if (card) {
      pool.push(card);
      remainingAvailable = remainingAvailable.filter(p => p.id !== card.id);
    }
  }

  // Shuffle so it's not obvious which cards target which player
  return shuffleArray(pool);
}

/**
 * Hydrate player IDs to full Player objects using the bundled JSON data.
 * Used by online mode where Firestore stores only IDs.
 */
export function hydratePlayerIds(ids: string[]): Player[] {
  const allPlayerMap = buildAllPlayersMap();
  return ids.map(id => allPlayerMap.get(id)).filter((p): p is Player => !!p);
}

/**
 * Build a map of all players (regular + special) by ID for fast lookups.
 */
export function buildAllPlayersMap(): Map<string, Player> {
  const map = new Map<string, Player>();

  const allSources: Player[][] = [
    playersData as Player[],
    historicalPlayersData as Player[],
    singleSeasonPlayersData as Player[],
    fictionalPlayersData as Player[],
    ninersPlayersData as Player[],
    decade60s70sPlayersData as Player[],
    decade80s90sPlayersData as Player[],
    playoffHeroesPlayersData as Player[],
    oneYearWondersPlayersData as Player[],
    bustedProspectsData as Player[],
    steroidEraPlayersData as Player[],
    internationalPlayersData as Player[],
    coachesData as Player[],
  ];

  for (const source of allSources) {
    for (const player of source) {
      map.set(player.id, player);
    }
  }

  return map;
}
