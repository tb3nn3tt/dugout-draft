import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CollectionData, PackType, PackOpenResult, PackReward, MilestoneReward, SetInfo } from '../types';
import {
  loadCollection,
  saveCollection,
  isFirstLaunch,
  generateStarterCollection,
  openPack as openPackUtil,
  calculateGameReward,
  calculateLevel,
  getLevelUpReward,
  getSetProgress,
  getTotalPlayerCount,
} from '../utils/collection';
import { evaluateMilestones } from '../utils/milestones';

interface LevelUpInfo {
  newLevel: number;
  rewards: PackReward[];
}

interface CollectionContextValue {
  collection: CollectionData;
  ownedSet: Set<string>;
  totalPlayers: number;
  isNewUser: boolean;

  // XP
  xpLevel: number;
  xpCurrent: number;
  xpNextLevel: number;
  xpTotal: number;
  spendXP: (amount: number) => boolean;
  lastLevelUp: LevelUpInfo | null;
  clearLevelUp: () => void;

  // Pack operations
  openPack: (type: PackType) => PackOpenResult | null;
  hasPacksToOpen: boolean;
  totalPacks: number;

  // Rewards
  earnGameReward: (won: boolean, swept: boolean, recordBroken: boolean) => {
    packs: PackReward[];
    stubs: number;
    xp: number;
    milestones: MilestoneReward[];
  };
  addPacks: (packs: PackReward[]) => void;
  addStubs: (amount: number) => void;

  // Collection info
  hasPlayer: (id: string) => boolean;
  setProgress: SetInfo[];
  collectionPercent: number;

  // Starter pack
  openStarterPack: () => string[];
  markNotNew: () => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [collection, setCollection] = useState<CollectionData>(() => loadCollection());
  const [isNewUser, setIsNewUser] = useState(() => isFirstLaunch());
  const [lastLevelUp, setLastLevelUp] = useState<LevelUpInfo | null>(null);
  const ownedSetRef = useRef(new Set(collection.ownedPlayerIds));

  // Keep ownedSet in sync
  useEffect(() => {
    ownedSetRef.current = new Set(collection.ownedPlayerIds);
  }, [collection.ownedPlayerIds]);

  // Auto-save on change
  useEffect(() => {
    saveCollection(collection);
  }, [collection]);

  const totalPlayers = getTotalPlayerCount();

  // Compute XP info
  const xpInfo = calculateLevel(collection.xp);
  const xpLevel = xpInfo.level;
  const xpCurrent = xpInfo.currentXP;
  const xpNextLevel = xpInfo.nextLevelXP;

  const hasPlayer = useCallback((id: string) => {
    return ownedSetRef.current.has(id);
  }, []);

  const openStarterPack = useCallback(() => {
    const starterIds = generateStarterCollection();
    setCollection(prev => ({
      ...prev,
      ownedPlayerIds: [...new Set([...prev.ownedPlayerIds, ...starterIds])],
    }));
    return starterIds;
  }, []);

  const markNotNew = useCallback(() => {
    setIsNewUser(false);
  }, []);

  const openPack = useCallback((type: PackType): PackOpenResult | null => {
    if (collection.packs[type] <= 0) return null;

    const currentOwned = new Set(collection.ownedPlayerIds);
    const result = openPackUtil(type, currentOwned);

    setCollection(prev => {
      const newOwnedIds = [...prev.ownedPlayerIds, ...result.newPlayers.map(p => p.id)];
      return {
        ...prev,
        ownedPlayerIds: [...new Set(newOwnedIds)],
        stubs: prev.stubs + result.stubsEarned,
        packs: { ...prev.packs, [type]: prev.packs[type] - 1 },
        stats: { ...prev.stats, packsOpened: prev.stats.packsOpened + 1 },
      };
    });

    return result;
  }, [collection.ownedPlayerIds, collection.packs]);

  const hasPacksToOpen = Object.values(collection.packs).some(count => count > 0);
  const totalPacks = Object.values(collection.packs).reduce((sum, count) => sum + count, 0);

  const spendXP = useCallback((amount: number): boolean => {
    if (collection.xp < amount) return false;
    setCollection(prev => ({
      ...prev,
      xp: prev.xp - amount,
      xpLevel: calculateLevel(prev.xp - amount).level,
    }));
    return true;
  }, [collection.xp]);

  const clearLevelUp = useCallback(() => setLastLevelUp(null), []);

  const earnGameReward = useCallback((won: boolean, swept: boolean, recordBroken: boolean) => {
    const reward = calculateGameReward(won, swept, recordBroken);

    setCollection(prev => {
      const newPacks = { ...prev.packs };
      for (const pack of reward.packs) {
        newPacks[pack.type] = (newPacks[pack.type] || 0) + pack.count;
      }

      const newXP = prev.xp + reward.xp;
      const prevLevelInfo = calculateLevel(prev.xp);
      const newLevelInfo = calculateLevel(newXP);

      // Grant level-up rewards if leveled up
      const levelUpPacks: PackReward[] = [];
      if (newLevelInfo.level > prevLevelInfo.level) {
        for (let lvl = prevLevelInfo.level + 1; lvl <= newLevelInfo.level; lvl++) {
          const lvlRewards = getLevelUpReward(lvl);
          levelUpPacks.push(...lvlRewards);
        }
        for (const pack of levelUpPacks) {
          newPacks[pack.type] = (newPacks[pack.type] || 0) + pack.count;
        }
      }

      const updated: CollectionData = {
        ...prev,
        stubs: prev.stubs + reward.stubs,
        xp: newXP,
        xpLevel: newLevelInfo.level,
        packs: newPacks,
        stats: {
          ...prev.stats,
          gamesPlayed: prev.stats.gamesPlayed + 1,
          gamesWon: prev.stats.gamesWon + (won ? 1 : 0),
        },
      };

      // Check sweep milestone eligibility
      if (swept && !updated.milestones['first_sweep_eligible']) {
        updated.milestones = { ...updated.milestones, first_sweep_eligible: true };
      }

      // Check milestones
      const milestones = evaluateMilestones(updated);
      for (const m of milestones) {
        updated.milestones = { ...updated.milestones, [m.id]: true };
        updated.stubs += m.stubs;
        for (const pack of m.packs) {
          updated.packs[pack.type] = (updated.packs[pack.type] || 0) + pack.count;
        }
      }

      // Set level-up notification
      if (newLevelInfo.level > prevLevelInfo.level) {
        // Use setTimeout to avoid setState-in-setState
        setTimeout(() => setLastLevelUp({ newLevel: newLevelInfo.level, rewards: levelUpPacks }), 0);
      }

      return updated;
    });

    // Calculate milestones for return value (using projected state)
    const projectedStats = {
      ...collection,
      stats: {
        ...collection.stats,
        gamesPlayed: collection.stats.gamesPlayed + 1,
        gamesWon: collection.stats.gamesWon + (won ? 1 : 0),
      },
      xp: collection.xp + reward.xp,
      xpLevel: calculateLevel(collection.xp + reward.xp).level,
      milestones: swept
        ? { ...collection.milestones, first_sweep_eligible: true }
        : collection.milestones,
    };
    const milestones = evaluateMilestones(projectedStats);

    return { ...reward, milestones };
  }, [collection]);

  const addPacks = useCallback((packs: PackReward[]) => {
    setCollection(prev => {
      const newPacks = { ...prev.packs };
      for (const pack of packs) {
        newPacks[pack.type] = (newPacks[pack.type] || 0) + pack.count;
      }
      return { ...prev, packs: newPacks };
    });
  }, []);

  const addStubs = useCallback((amount: number) => {
    setCollection(prev => ({ ...prev, stubs: prev.stubs + amount }));
  }, []);

  const setProgressData = getSetProgress(new Set(collection.ownedPlayerIds));
  const collectionPercent = totalPlayers > 0
    ? Math.round((collection.ownedPlayerIds.length / totalPlayers) * 100)
    : 0;

  return (
    <CollectionContext.Provider value={{
      collection,
      ownedSet: new Set(collection.ownedPlayerIds),
      totalPlayers,
      isNewUser,
      xpLevel,
      xpCurrent,
      xpNextLevel,
      xpTotal: collection.xp,
      spendXP,
      lastLevelUp,
      clearLevelUp,
      openPack,
      hasPacksToOpen,
      totalPacks,
      earnGameReward,
      addPacks,
      addStubs,
      hasPlayer,
      setProgress: setProgressData,
      collectionPercent,
      openStarterPack,
      markNotNew,
    }}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used within CollectionProvider');
  return ctx;
}
