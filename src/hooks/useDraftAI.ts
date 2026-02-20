import { Player, Position, ROSTER_REQUIREMENTS, PowerCard, PowerCardState, DraftRoundType } from '../types';
import { getNextPicker } from '../utils/draftLogic';

// Scarce positions that are hard to fill — prioritized at higher skill
const SCARCE_POSITIONS: Position[] = ['C', 'SS', 'CL'];

// Safe power cards the CPU can use (disruptive ones need complex UI interactions)
const CPU_SAFE_CARDS = ['shuffle_deck', 'upgrade_tier', 'double_pick', 'peek_ahead', 'sabotage', 'immunity'];

// Cards blocked during coach round (would break 1-coach-per-team rule)
const COACH_BLOCKED_CARDS = ['double_pick', 'skip_turn', 'upgrade_tier', 'sabotage'];

// Get positions still needed by a roster
function getNeededPositions(roster: Player[]): Position[] {
  const counts: Record<string, number> = {};
  (Object.keys(ROSTER_REQUIREMENTS) as Position[]).forEach(pos => {
    counts[pos] = 0;
  });
  roster.forEach(player => {
    if (player.positions.length > 0) {
      const primaryPos = player.positions[0];
      if (counts[primaryPos] !== undefined) counts[primaryPos]++;
    }
  });
  const needed: Position[] = [];
  (Object.keys(ROSTER_REQUIREMENTS) as Position[]).forEach(pos => {
    if (counts[pos] < ROSTER_REQUIREMENTS[pos]) {
      needed.push(pos);
    }
  });
  return needed;
}

function playerFillsNeed(player: Player, needed: Position[]): boolean {
  return player.positions.some(pos => needed.includes(pos));
}

// Score a card for AI evaluation — weights shift based on skill level
function scoreCard(
  player: Player,
  neededPositions: Position[],
  skillLevel: number,
  opponentNeeds?: Position[]
): number {
  const skill = skillLevel / 100;

  // Weights shift with skill: less random, more positional + OVR
  const randomWeight = 0.40 * (1 - skill);
  const needWeight = 0.30 + 0.20 * skill;
  const ovrWeight = 1.0 - needWeight - randomWeight;

  const fillsNeed = playerFillsNeed(player, neededPositions);
  const needScore = fillsNeed ? 100 : 20;
  const overallScore = player.overall;
  const randomScore = Math.random() * 100;

  let score = needScore * needWeight + overallScore * ovrWeight + randomScore * randomWeight;

  // Scarcity bonus: scarce positions worth extra at skill >= 50
  if (skill >= 0.50) {
    const isScarce = player.positions.some(pos => SCARCE_POSITIONS.includes(pos));
    if (isScarce && fillsNeed) {
      score += skill * 25;
    }
  }

  // Counter-drafting: block opponent's needs at skill >= 55
  if (skill >= 0.55 && opponentNeeds) {
    const blocksOpponent = player.positions.some(pos => opponentNeeds.includes(pos));
    if (blocksOpponent && !fillsNeed) {
      score += (skill - 0.55) * 30;
    }
  }

  return score;
}

export function evaluatePool(
  pool: Player[],
  roster: Player[],
  pickedFromPool: string[],
  skillLevel: number = 35,
  opponentRoster: Player[] = []
): Player | null {
  const available = pool.filter(p => !pickedFromPool.includes(p.id));
  if (available.length === 0) return null;

  const needed = getNeededPositions(roster);
  const opponentNeeds = skillLevel >= 55 ? getNeededPositions(opponentRoster) : undefined;

  const scored = available.map(p => ({
    player: p,
    score: scoreCard(p, needed, skillLevel, opponentNeeds),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].player;
}

export function shouldUsePowerCard(
  hand: PowerCard[],
  _state: PowerCardState,
  currentTurn: number,
  currentPlayer: 'player1' | 'player2',
  pool: Player[],
  roster: Player[],
  pickedFromPool: string[],
  skillLevel: number = 35,
  roundType?: DraftRoundType
): PowerCard | null {
  // Low skill: never use power cards
  if (skillLevel < 30) return null;

  // Probability of considering power cards scales with skill
  const useChance = Math.min(0.8, (skillLevel - 30) / 80);
  if (Math.random() > useChance) return null;

  const available = pool.filter(p => !pickedFromPool.includes(p.id));
  if (available.length === 0) return null;

  const needed = getNeededPositions(roster);
  const avgScore = available.reduce(
    (sum, p) => sum + scoreCard(p, needed, skillLevel),
    0
  ) / available.length;

  // Only consider safe cards the CPU can handle
  let usableCards = hand.filter(c => !c.used && CPU_SAFE_CARDS.includes(c.type));

  // Block certain cards during coach round
  if (roundType === 'coach') {
    usableCards = usableCards.filter(c => !COACH_BLOCKED_CARDS.includes(c.type));
  }

  // Block double_pick when snake draft already gives back-to-back turns
  // (prevents the dreaded 3-consecutive-picks scenario)
  const nextPicker = getNextPicker(currentPlayer, currentTurn + 1);
  if (nextPicker === currentPlayer) {
    usableCards = usableCards.filter(c => c.type !== 'double_pick');
  }

  if (usableCards.length === 0) return null;

  // Use shuffle if pool is weak
  if (avgScore < 35) {
    const shuffle = usableCards.find(c => c.type === 'shuffle_deck');
    if (shuffle) return shuffle;
  }

  // Use upgrade_tier if pool is mediocre
  if (avgScore < 45) {
    const upgrade = usableCards.find(c => c.type === 'upgrade_tier');
    if (upgrade) return upgrade;
  }

  // Use sabotage if opponent likely needs scarce positions (mid-late draft)
  if (skillLevel >= 45 && roster.length >= 12) {
    const sabotage = usableCards.find(c => c.type === 'sabotage');
    if (sabotage && Math.random() < 0.4) return sabotage;
  }

  // Use immunity if we have valuable players (late draft)
  if (skillLevel >= 40 && roster.length >= 10) {
    const immunity = usableCards.find(c => c.type === 'immunity');
    if (immunity && Math.random() < 0.25) return immunity;
  }

  // Random chance to use a utility card
  if (Math.random() < 0.15) {
    const safe = usableCards.filter(c =>
      ['double_pick', 'peek_ahead'].includes(c.type)
    );
    if (safe.length > 0) {
      return safe[Math.floor(Math.random() * safe.length)];
    }
  }

  return null;
}

export function getAuctionBid(
  roster: Player[],
  skillLevel: number = 35
): Player | null {
  if (roster.length === 0) return null;
  const sorted = [...roster].sort((a, b) => a.overall - b.overall);

  // Low skill: offer worst player. High skill: offer better to win auctions.
  const skill = skillLevel / 100;
  const maxIndex = sorted.length - 1;
  const index = Math.min(Math.floor(skill * 0.65 * maxIndex), maxIndex);
  return sorted[index];
}

export function getMysteryPick(
  pool: Player[],
  roster: Player[],
  pickedFromPool: string[],
  skillLevel: number = 35
): Player | null {
  const available = pool.filter(p => !pickedFromPool.includes(p.id));
  if (available.length === 0) return null;

  // Low skill: sometimes pick randomly (bad scouting in mystery rounds)
  if (skillLevel < 40 && Math.random() < 0.4) {
    return available[Math.floor(Math.random() * available.length)];
  }

  const needed = getNeededPositions(roster);

  const needFillers = available.filter(p => playerFillsNeed(p, needed));
  if (needFillers.length > 0) {
    needFillers.sort((a, b) => b.overall - a.overall);
    return needFillers[0];
  }

  const sorted = [...available].sort((a, b) => b.overall - a.overall);
  return sorted[0];
}
