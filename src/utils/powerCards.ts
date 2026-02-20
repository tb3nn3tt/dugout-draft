import { PowerCard, PowerCardType, PowerCardState, Player, Position, DraftRoundType, ROSTER_REQUIREMENTS } from '../types';
import { getNeededPositions, getDraftRoundType } from './draftLogic';

// Power card definitions
const POWER_CARD_DEFINITIONS: Record<PowerCardType, Omit<PowerCard, 'id' | 'used'>> = {
  shuffle_deck: {
    type: 'shuffle_deck',
    name: 'Fresh Deck',
    description: 'Redraw 4 new cards in the pool',
    icon: '🔄',
  },
  return_player: {
    type: 'return_player',
    name: 'Second Chance',
    description: 'Return your last pick to the pool and draft again',
    icon: '↩️',
  },
  steal_player: {
    type: 'steal_player',
    name: 'Grand Theft',
    description: 'Take one player from your opponent\'s roster',
    icon: '🦹',
    cooldown: 5, // Can't use for 5 turns after
  },
  skip_turn: {
    type: 'skip_turn',
    name: 'Strike Out',
    description: 'Opponent loses their next pick',
    icon: '⛔',
    cooldown: 5,
  },
  double_pick: {
    type: 'double_pick',
    name: 'Double Header',
    description: 'Draft 2 players this turn',
    icon: '✌️',
  },
  peek_ahead: {
    type: 'peek_ahead',
    name: 'Scout Report',
    description: 'See what cards will be available next round',
    icon: '🔮',
  },
  upgrade_tier: {
    type: 'upgrade_tier',
    name: 'Call Up',
    description: 'Current pool upgrades to a higher tier',
    icon: '⬆️',
  },
  trade_pick: {
    type: 'trade_pick',
    name: 'Trade Deadline',
    description: 'Swap one of your players with one from your opponent',
    icon: '🔁',
    cooldown: 4,
  },
  reverse_order: {
    type: 'reverse_order',
    name: 'Swap Turns',
    description: 'Opponent picks from the current pool — but the player goes to YOUR roster',
    icon: '🔀',
    cooldown: 5,
  },
  time_extension: {
    type: 'time_extension',
    name: 'Extra Innings',
    description: 'Add 15 seconds to your draft timer',
    icon: '⏰',
  },
  sabotage: {
    type: 'sabotage',
    name: 'Scouting Sabotage',
    description: "Opponent's next pool will be all bronze/common tier players",
    icon: '🕵️',
    cooldown: 5,
  },
  immunity: {
    type: 'immunity',
    name: 'Untouchable',
    description: 'Protect your roster from steal and trade for 3 turns',
    icon: '🛡️',
    cooldown: 6,
  },
};

// Cards that can only be used once per player (enforced via max 1 per hand)
// const SINGLE_USE_CARDS: PowerCardType[] = ['steal_player', 'skip_turn'];

// Generate a unique ID for a card
let cardIdCounter = 0;
function generateCardId(): string {
  return `power-${++cardIdCounter}`;
}

// Create a new power card instance
export function createPowerCard(type: PowerCardType): PowerCard {
  const definition = POWER_CARD_DEFINITIONS[type];
  return {
    ...definition,
    id: generateCardId(),
    used: false,
  };
}

// Generate random starting hand for a player
export function generateStartingHand(count: number = 4): PowerCard[] {
  const availableTypes = Object.keys(POWER_CARD_DEFINITIONS) as PowerCardType[];
  const hand: PowerCard[] = [];

  // Ensure at most 1 steal and 1 skip per player
  const shuffled = shuffleArray([...availableTypes]);
  let stealCount = 0;
  let skipCount = 0;

  for (const type of shuffled) {
    if (hand.length >= count) break;

    if (type === 'steal_player') {
      if (stealCount >= 1) continue;
      stealCount++;
    }
    if (type === 'skip_turn') {
      if (skipCount >= 1) continue;
      skipCount++;
    }

    hand.push(createPowerCard(type));
  }

  return hand;
}

// Initialize power card state for a new game
export function initializePowerCardState(): PowerCardState {
  return {
    player1Hand: generateStartingHand(4),
    player2Hand: generateStartingHand(4),
    lastUsedTurn: {},
    skipNextTurn: null,
    doublePick: null,
    peekPool: null,
    pickForTeam: null,
    sabotageNextPool: null,
    immuneUntilTurn: { player1: 0, player2: 0 },
  };
}

// Check if a card can be used
export function canUseCard(
  card: PowerCard,
  state: PowerCardState,
  currentTurn: number,
  _currentPlayer: 'player1' | 'player2',
  playerRoster: Player[]
): { canUse: boolean; reason?: string } {
  if (card.used) {
    return { canUse: false, reason: 'Card already used' };
  }

  // Check cooldown
  if (card.cooldown) {
    const lastUsed = state.lastUsedTurn[card.type];
    if (lastUsed && currentTurn - lastUsed < card.cooldown) {
      const remaining = card.cooldown - (currentTurn - lastUsed);
      return { canUse: false, reason: `On cooldown (${remaining} turns)` };
    }
  }

  // Special checks for certain cards
  if (card.type === 'return_player' && playerRoster.length === 0) {
    return { canUse: false, reason: 'No players to return' };
  }

  if (card.type === 'trade_pick' && playerRoster.length === 0) {
    return { canUse: false, reason: 'No players to trade' };
  }

  return { canUse: true };
}

// Get card by type from a hand
export function getCardFromHand(hand: PowerCard[], type: PowerCardType): PowerCard | undefined {
  return hand.find(c => c.type === type && !c.used);
}

// Get all usable cards from a hand
export function getUsableCards(
  hand: PowerCard[],
  state: PowerCardState,
  currentTurn: number,
  currentPlayer: 'player1' | 'player2',
  playerRoster: Player[]
): PowerCard[] {
  return hand.filter(card => {
    const { canUse } = canUseCard(card, state, currentTurn, currentPlayer, playerRoster);
    return canUse;
  });
}

// Shuffle array utility
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Get card color based on type
export function getCardColor(type: PowerCardType): string {
  const colors: Record<PowerCardType, string> = {
    shuffle_deck: '#3498db',
    return_player: '#2ecc71',
    steal_player: '#e74c3c',
    skip_turn: '#9b59b6',
    double_pick: '#f1c40f',
    peek_ahead: '#1abc9c',
    upgrade_tier: '#e67e22',
    trade_pick: '#34495e',
    reverse_order: '#ff6347',
    time_extension: '#27ae60',
    sabotage: '#7c3aed',
    immunity: '#0ea5e9',
  };
  return colors[type];
}

// Get card rarity
export function getCardRarity(type: PowerCardType): 'common' | 'rare' | 'legendary' {
  const legendary: PowerCardType[] = ['steal_player', 'skip_turn', 'double_pick'];
  const rare: PowerCardType[] = ['trade_pick', 'upgrade_tier', 'return_player', 'reverse_order', 'sabotage', 'immunity'];

  if (legendary.includes(type)) return 'legendary';
  if (rare.includes(type)) return 'rare';
  return 'common';
}

/**
 * Analyze the current game state and suggest which power cards would be smart to play.
 * Returns a map of card type → short suggestion reason.
 */
export function getCardSuggestions(
  hand: PowerCard[],
  state: PowerCardState,
  currentTurn: number,
  currentPlayer: 'player1' | 'player2',
  playerRoster: Player[],
  opponentRoster: Player[],
  cardPool: Player[],
  pickedFromPool: string[],
  neededPositions: Position[],
  timer: number,
): Map<PowerCardType, string> {
  const suggestions = new Map<PowerCardType, string>();

  // Only consider usable cards the player actually has
  const usableTypes = new Set<PowerCardType>();
  for (const card of hand) {
    const { canUse } = canUseCard(card, state, currentTurn, currentPlayer, playerRoster);
    if (canUse) usableTypes.add(card.type);
  }

  const available = cardPool.filter(p => !pickedFromPool.includes(p.id));
  if (available.length === 0) return suggestions;

  const needFillers = available.filter(p =>
    p.positions.some(pos => neededPositions.includes(pos))
  );

  // Helper: check if all of a player's positions are full
  const isPosFull = (player: Player): boolean => {
    const counts: Partial<Record<Position, number>> = {};
    playerRoster.forEach(p => {
      const pos = p.positions[0];
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return player.positions.every(pos => {
      const max = ROSTER_REQUIREMENTS[pos] ?? 0;
      return max > 0 && (counts[pos] || 0) >= max;
    });
  };

  const fullCards = available.filter(p => isPosFull(p));

  // Fresh Deck: No cards fill needs, or all positions already full
  if (usableTypes.has('shuffle_deck')) {
    if (needFillers.length === 0) {
      suggestions.set('shuffle_deck', 'No cards fit your needs');
    } else if (fullCards.length === available.length) {
      suggestions.set('shuffle_deck', 'All positions already filled');
    }
  }

  // Call Up: Pool is low tier (all cards below 80 OVR)
  if (usableTypes.has('upgrade_tier')) {
    const maxOvr = Math.max(...available.map(p => p.overall));
    if (maxOvr < 80) {
      suggestions.set('upgrade_tier', 'Low-tier pool — upgrade!');
    }
  }

  // Double Header: 2+ need-filling cards
  if (usableTypes.has('double_pick')) {
    if (needFillers.length >= 2) {
      suggestions.set('double_pick', `${needFillers.length} cards you need!`);
    }
  }

  // Grand Theft: Opponent has a player at a position you need
  if (usableTypes.has('steal_player') && neededPositions.length > 0) {
    const stealTargets = opponentRoster.filter(p =>
      p.positions.some(pos => neededPositions.includes(pos))
    );
    if (stealTargets.length > 0) {
      const best = stealTargets.sort((a, b) => b.overall - a.overall)[0];
      const lastName = best.name.split(' ').pop();
      suggestions.set('steal_player', `Steal ${lastName} (${best.positions[0]})!`);
    }
  }

  // Second Chance: Pool has a much better player at same position as your last pick
  if (usableTypes.has('return_player') && playerRoster.length > 0) {
    const lastPick = playerRoster[playerRoster.length - 1];
    const betterSamePos = available.filter(p =>
      p.positions.some(pos => lastPick.positions.includes(pos)) &&
      p.overall > lastPick.overall + 5
    );
    if (betterSamePos.length > 0) {
      suggestions.set('return_player', `Better ${lastPick.positions[0]} in pool!`);
    }
  }

  // Scout Report: Next round is a special round
  if (usableTypes.has('peek_ahead')) {
    const nextRoundPick = currentTurn + 2;
    const nextRoundType: DraftRoundType = getDraftRoundType(nextRoundPick);
    if (nextRoundType !== 'normal') {
      suggestions.set('peek_ahead', 'Special round up next!');
    }
  }

  // Skip Turn: Late in draft, opponent still needs many positions
  if (usableTypes.has('skip_turn')) {
    const oppNeeds = getNeededPositions(opponentRoster);
    if (oppNeeds.length > 5 && currentTurn > 30) {
      suggestions.set('skip_turn', `Opponent needs ${oppNeeds.length} positions!`);
    }
  }

  // Time Extension: Timer is getting low
  if (usableTypes.has('time_extension') && timer <= 10 && timer > 0) {
    suggestions.set('time_extension', 'Timer running low!');
  }

  // Scouting Sabotage: Opponent needs scarce positions (C, SS, CL)
  if (usableTypes.has('sabotage')) {
    const oppNeeds = getNeededPositions(opponentRoster);
    const scarce: Position[] = ['C', 'SS', 'CL'];
    const scarceNeeds = oppNeeds.filter(p => scarce.includes(p));
    if (scarceNeeds.length >= 2) {
      suggestions.set('sabotage', `Sabotage opponent's next pool!`);
    }
  }

  // Untouchable: You have high-value targets and opponent has steal/trade potential
  if (usableTypes.has('immunity') && playerRoster.length >= 5) {
    const highValue = playerRoster.filter(p => p.overall >= 90);
    if (highValue.length >= 3) {
      suggestions.set('immunity', 'Protect your stars!');
    }
  }

  return suggestions;
}
