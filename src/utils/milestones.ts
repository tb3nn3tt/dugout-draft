import { MilestoneId, MilestoneReward, CollectionData, PackReward } from '../types';
import { getTotalPlayerCount } from './collection';

interface MilestoneDefinition {
  id: MilestoneId;
  name: string;
  description: string;
  condition: (data: CollectionData) => boolean;
  packs: PackReward[];
  stubs: number;
}

const MILESTONES: MilestoneDefinition[] = [
  {
    id: 'first_game',
    name: 'First Pitch',
    description: 'Play your first game',
    condition: (d) => d.stats.gamesPlayed >= 1,
    packs: [{ type: 'standard', count: 2, reason: 'First Pitch!' }],
    stubs: 50,
  },
  {
    id: 'first_win',
    name: 'First Victory',
    description: 'Win your first series',
    condition: (d) => d.stats.gamesWon >= 1,
    packs: [{ type: 'premium', count: 1, reason: 'First Victory!' }],
    stubs: 100,
  },
  {
    id: 'first_sweep',
    name: 'Clean Sweep',
    description: 'Win a series 4-0',
    condition: (d) => d.milestones['first_sweep_eligible'] === true,
    packs: [{ type: 'premium', count: 2, reason: 'Clean Sweep!' }],
    stubs: 100,
  },
  {
    id: 'games_5',
    name: 'Getting Started',
    description: 'Play 5 games',
    condition: (d) => d.stats.gamesPlayed >= 5,
    packs: [
      { type: 'premium', count: 2, reason: '5 Games!' },
      { type: 'legends', count: 1, reason: '5 Games Bonus!' },
    ],
    stubs: 150,
  },
  {
    id: 'games_10',
    name: 'Regular',
    description: 'Play 10 games',
    condition: (d) => d.stats.gamesPlayed >= 10,
    packs: [
      { type: 'legends', count: 1, reason: '10 Games!' },
      { type: 'playoff', count: 1, reason: '10 Games Bonus!' },
    ],
    stubs: 200,
  },
  {
    id: 'games_20',
    name: 'Veteran',
    description: 'Play 20 games',
    condition: (d) => d.stats.gamesPlayed >= 20,
    packs: [
      { type: 'premium', count: 2, reason: '20 Games!' },
      { type: 'allstar', count: 1, reason: 'Veteran Reward!' },
    ],
    stubs: 500,
  },
  {
    id: 'games_50',
    name: 'Grinder',
    description: 'Play 50 games',
    condition: (d) => d.stats.gamesPlayed >= 50,
    packs: [{ type: 'allstar', count: 2, reason: 'Grinder!' }],
    stubs: 1000,
  },
  {
    id: 'packs_opened_10',
    name: 'Pack Rat',
    description: 'Open 10 packs',
    condition: (d) => d.stats.packsOpened >= 10,
    packs: [{ type: 'premium', count: 1, reason: 'Pack Rat!' }],
    stubs: 100,
  },
  {
    id: 'packs_opened_25',
    name: 'Rip City',
    description: 'Open 25 packs',
    condition: (d) => d.stats.packsOpened >= 25,
    packs: [{ type: 'allstar', count: 1, reason: 'Rip City!' }],
    stubs: 200,
  },
  {
    id: 'xp_level_5',
    name: 'Rising Star',
    description: 'Reach XP Level 5',
    condition: (d) => d.xpLevel >= 5,
    packs: [{ type: 'premium', count: 2, reason: 'Level 5!' }],
    stubs: 150,
  },
  {
    id: 'xp_level_10',
    name: 'All-Star',
    description: 'Reach XP Level 10',
    condition: (d) => d.xpLevel >= 10,
    packs: [
      { type: 'legends', count: 1, reason: 'Level 10!' },
      { type: 'allstar', count: 1, reason: 'All-Star Reward!' },
    ],
    stubs: 300,
  },
  {
    id: 'xp_level_20',
    name: 'Hall of Famer',
    description: 'Reach XP Level 20',
    condition: (d) => d.xpLevel >= 20,
    packs: [{ type: 'allstar', count: 3, reason: 'Hall of Famer!' }],
    stubs: 1000,
  },
  {
    id: 'collection_25',
    name: 'Collector',
    description: 'Collect 25% of all players',
    condition: (d) => d.ownedPlayerIds.length >= getTotalPlayerCount() * 0.25,
    packs: [{ type: 'premium', count: 2, reason: '25% Collection!' }],
    stubs: 150,
  },
  {
    id: 'collection_50',
    name: 'Enthusiast',
    description: 'Collect 50% of all players',
    condition: (d) => d.ownedPlayerIds.length >= getTotalPlayerCount() * 0.5,
    packs: [
      { type: 'premium', count: 3, reason: '50% Collection!' },
      { type: 'allstar', count: 1, reason: '50% Bonus!' },
    ],
    stubs: 500,
  },
  {
    id: 'collection_75',
    name: 'Completionist',
    description: 'Collect 75% of all players',
    condition: (d) => d.ownedPlayerIds.length >= getTotalPlayerCount() * 0.75,
    packs: [{ type: 'allstar', count: 2, reason: '75% Collection!' }],
    stubs: 750,
  },
  {
    id: 'collection_100',
    name: 'Grand Slam',
    description: 'Collect every player',
    condition: (d) => d.ownedPlayerIds.length >= getTotalPlayerCount(),
    packs: [{ type: 'allstar', count: 3, reason: 'Complete Collection!' }],
    stubs: 2000,
  },
];

/**
 * Check which milestones are newly completed and return their rewards.
 */
export function evaluateMilestones(data: CollectionData): MilestoneReward[] {
  const newlyCompleted: MilestoneReward[] = [];

  for (const milestone of MILESTONES) {
    // Skip if already claimed
    if (data.milestones[milestone.id]) continue;

    // Check if condition is met
    if (milestone.condition(data)) {
      newlyCompleted.push({
        id: milestone.id,
        name: milestone.name,
        packs: milestone.packs,
        stubs: milestone.stubs,
      });
    }
  }

  return newlyCompleted;
}

/**
 * Get all milestones with their completion status.
 */
export function getAllMilestones(data: CollectionData): (MilestoneDefinition & { completed: boolean })[] {
  return MILESTONES.map(m => ({
    ...m,
    completed: !!data.milestones[m.id],
  }));
}
