import { Player, CollectionData, PackType, PackReward, PackOpenResult, SetInfo, PlayerCategory } from '../types';
import { buildAllPlayersMap, getPlayerTier, Tier } from './draftLogic';

const STORAGE_KEY = 'dugout-draft-collection';

// Set definitions for progress tracking
export const SET_DEFINITIONS: { name: string; category: PlayerCategory | 'current'; icon: string; color: string; completionBonus: number }[] = [
  { name: 'The Show', category: 'current', icon: '⚾', color: '#3498db', completionBonus: 500 },
  { name: 'Hall of Famers', category: 'legend', icon: '🏆', color: '#ffd700', completionBonus: 300 },
  { name: 'Peak Seasons', category: 'peak', icon: '⭐', color: '#ff6b6b', completionBonus: 250 },
  { name: 'Hollywood Stars', category: 'fictional', icon: '🎬', color: '#9b59b6', completionBonus: 300 },
  { name: 'The Niners 12U', category: 'niners', icon: '⚾', color: '#00bfff', completionBonus: 150 },
  { name: 'Classic Era', category: 'decade', icon: '📻', color: '#cd853f', completionBonus: 200 },
  { name: 'Playoff Heroes', category: 'playoff', icon: '🏟️', color: '#228b22', completionBonus: 250 },
  { name: 'One-Year Wonders', category: 'oddity', icon: '⚡', color: '#ff6b35', completionBonus: 200 },
  { name: 'Busted Prospects', category: 'busts', icon: '💔', color: '#dc2626', completionBonus: 200 },
  { name: 'Tainted Legends', category: 'oddity', icon: '💪', color: '#ff1744', completionBonus: 200 },
  { name: 'International Legends', category: 'international', icon: '🌍', color: '#00acc1', completionBonus: 200 },
];

// Pack config — generous sizes for satisfying pulls
const PACK_CONFIG: Record<PackType, { count: number; guaranteedTier: Tier | null; rates: Record<Tier, number> }> = {
  standard: {
    count: 5,
    guaranteedTier: 'bronze',
    rates: { diamond: 0.01, gold: 0.04, silver: 0.15, bronze: 0.30, common: 0.50 },
  },
  premium: {
    count: 6,
    guaranteedTier: 'silver',
    rates: { diamond: 0.08, gold: 0.15, silver: 0.25, bronze: 0.30, common: 0.22 },
  },
  legends: {
    count: 4, guaranteedTier: 'bronze',
    rates: { diamond: 0.18, gold: 0.35, silver: 0.27, bronze: 0.15, common: 0.05 },
  },
  fictional: {
    count: 4, guaranteedTier: null,
    rates: { diamond: 0.08, gold: 0.22, silver: 0.35, bronze: 0.25, common: 0.10 },
  },
  decade: {
    count: 4, guaranteedTier: null,
    rates: { diamond: 0.12, gold: 0.30, silver: 0.33, bronze: 0.20, common: 0.05 },
  },
  international: {
    count: 4, guaranteedTier: null,
    rates: { diamond: 0.12, gold: 0.35, silver: 0.28, bronze: 0.20, common: 0.05 },
  },
  steroid_era: {
    count: 4, guaranteedTier: null,
    rates: { diamond: 0.08, gold: 0.28, silver: 0.34, bronze: 0.22, common: 0.08 },
  },
  playoff: {
    count: 4, guaranteedTier: null,
    rates: { diamond: 0.12, gold: 0.30, silver: 0.33, bronze: 0.20, common: 0.05 },
  },
  allstar: {
    count: 2, guaranteedTier: 'gold',
    rates: { diamond: 0.30, gold: 0.70, silver: 0, bronze: 0, common: 0 },
  },
};

// Stubs earned from duplicates by tier
const DUPE_STUBS: Record<Tier, number> = {
  common: 10,
  bronze: 25,
  silver: 50,
  gold: 100,
  diamond: 250,
};

// Set-specific pack player pool filter
const SET_PACK_CATEGORIES: Partial<Record<PackType, PlayerCategory[]>> = {
  legends: ['legend'],
  fictional: ['fictional'],
  decade: ['decade'],
  international: ['international'],
  steroid_era: ['oddity'],
  playoff: ['playoff'],
};

// XP level thresholds — each level requires more XP
export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1));
}

export function calculateLevel(totalXP: number): { level: number; currentXP: number; nextLevelXP: number } {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= getXPForLevel(level)) {
    remaining -= getXPForLevel(level);
    level++;
  }
  return { level, currentXP: remaining, nextLevelXP: getXPForLevel(level) };
}

function createDefaultCollection(): CollectionData {
  return {
    version: 1,
    ownedPlayerIds: [],
    stubs: 0,
    xp: 0,
    xpLevel: 1,
    packs: {
      standard: 0, premium: 0, legends: 0, fictional: 0,
      decade: 0, international: 0, steroid_era: 0, playoff: 0, allstar: 0,
    },
    stats: { packsOpened: 0, gamesPlayed: 0, gamesWon: 0 },
    milestones: {},
  };
}

export function loadCollection(): CollectionData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as CollectionData;
      // Ensure all pack types exist (forward compatibility)
      if (!data.packs) data.packs = createDefaultCollection().packs;
      for (const key of Object.keys(createDefaultCollection().packs) as PackType[]) {
        if (data.packs[key] === undefined) data.packs[key] = 0;
      }
      if (!data.stats) data.stats = { packsOpened: 0, gamesPlayed: 0, gamesWon: 0 };
      if (!data.milestones) data.milestones = {};
      if (data.xp === undefined) data.xp = 0;
      if (data.xpLevel === undefined) data.xpLevel = 1;
      return data;
    }
  } catch { /* corrupted data, start fresh */ }
  return createDefaultCollection();
}

export function saveCollection(data: CollectionData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* localStorage full */ }
}

export function isFirstLaunch(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

/**
 * Generate a position-balanced starter collection of ~86 players.
 */
export function generateStarterCollection(): string[] {
  const allPlayersMap = buildAllPlayersMap();
  const allPlayers = Array.from(allPlayersMap.values());
  const starterIds: Set<string> = new Set();

  // Helper to add random players matching criteria
  const addRandom = (pool: Player[], count: number) => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    let added = 0;
    for (const p of shuffled) {
      if (added >= count) break;
      if (!starterIds.has(p.id)) {
        starterIds.add(p.id);
        added++;
      }
    }
  };

  // Categorize by tier
  const byTier = (tier: Tier) => allPlayers.filter(p => getPlayerTier(p.overall) === tier);
  const currentPlayers = allPlayers.filter(p => !p.category || p.category === 'current');

  // 1 Diamond star (guaranteed marquee)
  const diamonds = byTier('diamond').filter(p => !p.category || p.category === 'current');
  if (diamonds.length > 0) {
    const star = diamonds[Math.floor(Math.random() * diamonds.length)];
    starterIds.add(star.id);
  }

  // 2 Gold
  addRandom(byTier('gold').filter(p => currentPlayers.includes(p)), 2);

  // 5 Silver
  addRandom(byTier('silver').filter(p => currentPlayers.includes(p)), 5);

  // 15 Bronze - position balanced: ensure C, SS, SP, CL coverage
  const bronzePlayers = byTier('bronze').filter(p => currentPlayers.includes(p));
  const scarcePositions = ['C', 'SS', 'SP', 'CL'];
  for (const pos of scarcePositions) {
    const posPlayers = bronzePlayers.filter(p => p.positions[0] === pos && !starterIds.has(p.id));
    if (posPlayers.length > 0) {
      const pick = posPlayers[Math.floor(Math.random() * posPlayers.length)];
      starterIds.add(pick.id);
    }
  }
  addRandom(bronzePlayers, 15 - (starterIds.size - 8)); // Fill remaining bronze

  // 60 Common - position balanced
  const commonPlayers = byTier('common').filter(p => currentPlayers.includes(p));
  // Ensure at least 1 of each starting position
  const startingPositions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'CL', 'SU', 'MRP'];
  for (const pos of startingPositions) {
    const posPlayers = commonPlayers.filter(p => p.positions[0] === pos && !starterIds.has(p.id));
    if (posPlayers.length > 0) {
      const pick = posPlayers[Math.floor(Math.random() * posPlayers.length)];
      starterIds.add(pick.id);
    }
  }
  addRandom(commonPlayers, 60 - Math.max(0, starterIds.size - 23));

  // 3 special category players
  const specialCategories: PlayerCategory[] = ['legend', 'fictional', 'decade', 'playoff', 'international'];
  const shuffledCats = [...specialCategories].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 3 && i < shuffledCats.length; i++) {
    const catPlayers = allPlayers.filter(p => p.category === shuffledCats[i] && !starterIds.has(p.id));
    if (catPlayers.length > 0) {
      const pick = catPlayers[Math.floor(Math.random() * catPlayers.length)];
      starterIds.add(pick.id);
    }
  }

  return Array.from(starterIds);
}

/**
 * Open a pack and return results.
 */
export function openPack(
  packType: PackType,
  ownedIds: Set<string>,
): PackOpenResult {
  const config = PACK_CONFIG[packType];
  const allPlayersMap = buildAllPlayersMap();
  const allPlayers = Array.from(allPlayersMap.values());

  // Filter to set-specific pool for set packs
  const categories = SET_PACK_CATEGORIES[packType];
  let pool = categories
    ? allPlayers.filter(p => p.category && categories.includes(p.category))
    : allPlayers;

  // For gold/diamond guaranteed packs (allstar type)
  if (packType === 'allstar') {
    pool = allPlayers.filter(p => p.overall >= 85);
  }

  const pickedPlayers: Player[] = [];
  const usedIds = new Set<string>();

  // Roll cards based on rates
  for (let i = 0; i < config.count; i++) {
    const tier = rollTier(config.rates);
    const tierPool = pool.filter(p => getPlayerTier(p.overall) === tier && !usedIds.has(p.id));
    const fallbackPool = pool.filter(p => !usedIds.has(p.id));
    const pickFrom = tierPool.length > 0 ? tierPool : fallbackPool;

    if (pickFrom.length > 0) {
      const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      pickedPlayers.push(pick);
      usedIds.add(pick.id);
    }
  }

  // Guarantee minimum tier if needed
  if (config.guaranteedTier) {
    const tierRank: Record<Tier, number> = { common: 0, bronze: 1, silver: 2, gold: 3, diamond: 4 };
    const minRank = tierRank[config.guaranteedTier];
    const hasGuarantee = pickedPlayers.some(p => tierRank[getPlayerTier(p.overall)] >= minRank);

    if (!hasGuarantee && pickedPlayers.length > 0) {
      // Replace the last card with a guaranteed tier card
      const guaranteePool = pool.filter(
        p => tierRank[getPlayerTier(p.overall)] >= minRank && !usedIds.has(p.id)
      );
      if (guaranteePool.length > 0) {
        const replacement = guaranteePool[Math.floor(Math.random() * guaranteePool.length)];
        pickedPlayers[pickedPlayers.length - 1] = replacement;
      }
    }
  }

  // Split into new and duplicates
  const newPlayers: Player[] = [];
  const duplicates: Player[] = [];
  let stubsEarned = 0;

  for (const player of pickedPlayers) {
    if (ownedIds.has(player.id)) {
      duplicates.push(player);
      stubsEarned += DUPE_STUBS[getPlayerTier(player.overall)];
    } else {
      newPlayers.push(player);
    }
  }

  return { newPlayers, duplicates, stubsEarned };
}

function rollTier(rates: Record<Tier, number>): Tier {
  const roll = Math.random();
  let cumulative = 0;

  // Roll from rarest to most common
  const tiers: Tier[] = ['diamond', 'gold', 'silver', 'bronze', 'common'];
  for (const tier of tiers) {
    cumulative += rates[tier];
    if (roll < cumulative) return tier;
  }
  return 'common';
}

/**
 * Calculate rewards earned after a game.
 */
export function calculateGameReward(
  won: boolean,
  swept: boolean,
  recordBroken: boolean,
): { packs: PackReward[]; stubs: number; xp: number } {
  const packs: PackReward[] = [];
  let stubs = 0;
  let xp = 0;

  // Everyone gets XP just for playing
  xp += 50;

  if (won) {
    packs.push({ type: 'standard', count: 2, reason: 'Series Win' });
    packs.push({ type: 'premium', count: 1, reason: 'Winner Bonus' });
    stubs += 75;
    xp += 80;

    if (swept) {
      packs.push({ type: 'premium', count: 1, reason: 'Clean Sweep!' });
      stubs += 50;
      xp += 60;
    }
  } else {
    packs.push({ type: 'standard', count: 1, reason: 'Participation' });
    stubs += 40;
    xp += 30;
  }

  if (recordBroken) {
    packs.push({ type: 'premium', count: 1, reason: 'Record Broken!' });
    stubs += 200;
    xp += 100;
  }

  return { packs, stubs, xp };
}

/**
 * Get set progress for collection browser.
 */
export function getSetProgress(ownedIds: Set<string>): SetInfo[] {
  const allPlayersMap = buildAllPlayersMap();
  const allPlayers = Array.from(allPlayersMap.values());

  return SET_DEFINITIONS.map(def => {
    let setPlayers: Player[];
    if (def.category === 'current') {
      setPlayers = allPlayers.filter(p => !p.category || p.category === 'current');
    } else {
      setPlayers = allPlayers.filter(p => p.category === def.category);
    }

    const owned = setPlayers.filter(p => ownedIds.has(p.id));

    return {
      name: def.name,
      category: def.category as PlayerCategory | 'all',
      icon: def.icon,
      color: def.color,
      totalPlayers: setPlayers.length,
      ownedPlayers: owned.length,
      completionBonus: def.completionBonus,
    };
  });
}

/**
 * Get total player count for collection progress.
 */
export function getTotalPlayerCount(): number {
  return buildAllPlayersMap().size;
}

/**
 * Get the pack shop items available for stubs purchase.
 */
export function getShopPacks(): { type: PackType; name: string; cost: number; icon: string }[] {
  return [
    { type: 'standard', name: 'Standard Pack', cost: 50, icon: '📦' },
    { type: 'premium', name: 'Premium Pack', cost: 100, icon: '✨' },
    { type: 'legends', name: 'Legends Pack', cost: 150, icon: '🏆' },
    { type: 'fictional', name: 'Fictional Pack', cost: 150, icon: '🎬' },
    { type: 'decade', name: 'Decade Pack', cost: 150, icon: '📻' },
    { type: 'international', name: 'International Pack', cost: 150, icon: '🌍' },
    { type: 'playoff', name: 'Playoff Pack', cost: 150, icon: '🏟️' },
    { type: 'steroid_era', name: 'Steroid Era Pack', cost: 150, icon: '💪' },
    { type: 'allstar', name: 'Gold Guaranteed', cost: 350, icon: '🌟' },
  ];
}

/**
 * Get XP shop items — spend XP on themed packs.
 */
export function getXPShopPacks(): { type: PackType; name: string; xpCost: number; icon: string }[] {
  return [
    { type: 'standard', name: 'Standard Pack', xpCost: 75, icon: '📦' },
    { type: 'premium', name: 'Premium Pack', xpCost: 150, icon: '✨' },
    { type: 'legends', name: 'Legends Pack', xpCost: 200, icon: '🏆' },
    { type: 'decade', name: 'Decade Pack', xpCost: 200, icon: '📻' },
    { type: 'playoff', name: 'Playoff Pack', xpCost: 200, icon: '🏟️' },
    { type: 'international', name: 'International Pack', xpCost: 200, icon: '🌍' },
    { type: 'allstar', name: 'Gold Guaranteed', xpCost: 500, icon: '🌟' },
  ];
}

/**
 * XP level-up rewards — free packs every few levels
 */
export function getLevelUpReward(level: number): PackReward[] {
  if (level % 10 === 0) return [{ type: 'allstar', count: 1, reason: `Level ${level}!` }];
  if (level % 5 === 0) return [{ type: 'premium', count: 2, reason: `Level ${level}!` }];
  if (level % 2 === 0) return [{ type: 'standard', count: 1, reason: `Level ${level}!` }];
  return [];
}
