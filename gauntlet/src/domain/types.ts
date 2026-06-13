export type Position =
  | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'
  | 'BC' | 'PH' | 'PR' | 'IFD' | 'OFD'
  | 'SP' | 'CL' | 'SU' | 'MRP' | 'LRP' | 'LOOGY'
  | 'RP' | 'BN'   // draft-only generic roles (Reliever / Bench) — never tag a real player
  | 'HC'
  | 'ST';

export type HandBat = 'L' | 'R' | 'S';
export type HandThrow = 'L' | 'R';

// 20-80 Scouting Scale
// 80 = Elite (Hall of Fame level)
// 70 = Plus-Plus (All-Star caliber)
// 60 = Plus (Above average starter)
// 50 = Average (MLB average)
// 40 = Below Average (Fringe starter)
// 30 = Poor (Bench player level)
// 20 = Terrible (Liability)
export interface ScoutingGrades {
  // Hitters (20-80 scale)
  contact?: number;    // Ability to make contact
  power?: number;      // Raw power / HR ability
  speed?: number;      // Running speed
  fielding?: number;   // Defensive ability
  arm?: number;        // Throwing arm strength
  eye?: number;        // Plate discipline

  // Pitchers (20-80 scale)
  fastball?: number;   // Velocity + movement
  breaking?: number;   // Curve/slider quality
  changeup?: number;   // Offspeed quality
  control?: number;    // Command
  stamina?: number;    // SP (70+) vs RP (40-60)

  // Universal (20-80 scale)
  clutch?: number;     // Performance in high-pressure situations
}

export interface PlayerStats {
  // Hitters (legacy stats for display)
  avg?: number;
  obp?: number;
  slg?: number;
  hr?: number;
  speed?: number;
  // Pitchers (legacy stats for display)
  era?: number;
  whip?: number;
  k9?: number;
  bb9?: number;
  ip?: number;  // Innings pitched
}

export interface CoachEffect {
  style: string;           // "Power Game", "Pitching Guru", etc.
  offensiveBonus: number;  // 0-8% boost to batting grades
  pitchingBonus: number;   // 0-8% boost to pitching grades
  clutchBonus: number;     // 0-5 grade points in clutch situations
  staminaBonus: number;    // 0-10 extra max pitches before fatigue
  speedBonus: number;      // 0-5 grade points to speed
  fieldingBonus: number;   // 0-5 grade points to fielding
}

export interface ParkEffect {
  name: string;           // "Short Porch Power", "Green Monster Haven"
  hrFactor: number;       // 0.80-1.25 (multiplier on HR rate)
  doublesFactor: number;  // 0.85-1.20 (multiplier on doubles rate)
  triplesFactor: number;  // 0.80-1.30 (multiplier on triples rate)
  runFactor: number;      // 0.90-1.15 (multiplier on overall BABIP)
  errorFactor: number;    // 0.90-1.15 (multiplier on error chance)
}

export interface Player {
  id: string;
  name: string;
  team: string;
  positions: Position[];
  bats: HandBat;
  throws: HandThrow;
  stats: PlayerStats;
  overall: number;           // 20-80 overall rating
  grades?: ScoutingGrades;   // Scouting grades
  category?: PlayerCategory; // Player category
  era?: string;              // Era (e.g., "2024", "1927 Season", "Major League (1989)")
  nickname?: string;         // Nickname (e.g., "The Sultan of Swat")
  specialty?: string;        // Specialty (e.g., "5-Tool", "Power Arm", "Speedster")
  funFact?: string;          // Fun fact about the player
  coachEffect?: CoachEffect; // Coaching bonuses (HC only)
  parkEffect?: ParkEffect;   // Park effect bonuses (ST only)
}

export interface DraftedTeam {
  owner: 'player1' | 'player2';
  name: string;
  roster: Player[];
  battingOrder: Player[];
  rotation: Player[];
  closer: Player | null;
  bullpen: Player[];
}

export interface GameState {
  inning: number;
  halfInning: 'top' | 'bottom';
  outs: number;
  runners: [boolean, boolean, boolean];
  score: [number, number];
  currentBatterIndex: number;
  currentPitcher: Player | null;
  pitchCount: number;
  boxScore: GameBoxScore;
  lineScore: number[][]; // [away innings[], home innings[]]
}

export interface SeriesState {
  games: GameResult[];
  currentGame: number;
  homeTeam: 'player1' | 'player2';
}

export interface BatterBoxScore {
  playerId: string;
  name: string;
  position: string;
  ab: number;    // At bats
  r: number;     // Runs
  h: number;     // Hits
  rbi: number;   // Runs batted in
  bb: number;    // Walks
  so: number;    // Strikeouts
  hr: number;    // Home runs
  doubles?: number;  // Doubles (for SLG calculation)
  triples?: number;  // Triples (for SLG calculation)
}

export interface PitcherBoxScore {
  playerId: string;
  name: string;
  ip: number;    // Innings pitched (as decimal, e.g., 6.1 = 6 1/3)
  h: number;     // Hits allowed
  r: number;     // Runs allowed
  er: number;    // Earned runs
  bb: number;    // Walks
  so: number;    // Strikeouts
  pitches: number;
  decision?: 'W' | 'L' | 'S';  // Win, Loss, Save
}

export interface TeamBoxScore {
  batters: BatterBoxScore[];
  pitchers: PitcherBoxScore[];
  totals: {
    ab: number;
    r: number;
    h: number;
    rbi: number;
    bb: number;
    so: number;
  };
}

export interface GameBoxScore {
  away: TeamBoxScore;
  home: TeamBoxScore;
  lineScore: number[][]; // [away innings, home innings]
}

export interface GameResult {
  score: [number, number];
  winner: 'player1' | 'player2';
  innings: InningScore[];
  boxScore?: GameBoxScore;
}

export interface InningScore {
  away: number;
  home: number;
}

export type AtBatResult =
  | 'strikeout'
  | 'walk'
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun'
  | 'groundout'
  | 'flyout'
  | 'lineout'
  | 'double_play';

export type GamePhase = 'start' | 'draft' | 'team-setup' | 'simulation' | 'results';

export interface RosterRequirements {
  C: number;
  '1B': number;
  '2B': number;
  '3B': number;
  SS: number;
  LF: number;
  CF: number;
  RF: number;
  DH: number;
  BC: number;
  PH: number;
  PR: number;
  IFD: number;
  OFD: number;
  SP: number;
  CL: number;
  SU: number;
  MRP: number;
  LRP: number;
  LOOGY: number;
  HC: number;
  ST: number;
}

// 15 Hitters: 9 starters (C, 1B, 2B, 3B, SS, LF, CF, RF, DH) + 6 bench (BC, PH×2, PR, IFD, OFD)
// 11 Pitchers: 4 SP, 1 CL, 2 SU, 2 MRP, 1 LRP, 1 LOOGY
// 1 Head Coach + 1 Stadium
export const ROSTER_REQUIREMENTS: RosterRequirements = {
  C: 1,
  '1B': 1,
  '2B': 1,
  '3B': 1,
  SS: 1,
  LF: 1,
  CF: 1,
  RF: 1,
  DH: 1,
  BC: 1,
  PH: 2,
  PR: 1,
  IFD: 1,
  OFD: 1,
  SP: 4,
  CL: 1,
  SU: 2,
  MRP: 2,
  LRP: 1,
  LOOGY: 1,
  HC: 1,
  ST: 1,
};

export const TOTAL_ROSTER_SIZE = 28;

// Quick Play mode: 13 players (9 hitters + 4 pitchers), single game
export type GameMode = 'standard' | 'quick';

export const QUICK_ROSTER_SIZE = 15;

export const QUICK_ROSTER_REQUIREMENTS: Partial<RosterRequirements> = {
  C: 1,
  '1B': 1,
  '2B': 1,
  '3B': 1,
  SS: 1,
  LF: 1,
  CF: 1,
  RF: 1,
  DH: 1,
  SP: 2,
  CL: 1,
  MRP: 1,
  HC: 1,
  ST: 1,
};

// Synergy Types
export type SynergyType = 'team' | 'battery';

export interface SynergyBonus {
  type: SynergyType;
  team?: string; // MLB team code for team synergy
  players: Player[];
  bonus: number; // Percentage bonus (e.g., 3 for 3%)
  description: string;
}

export interface ActiveSynergies {
  teamSynergies: SynergyBonus[];
  batteryBonus: SynergyBonus | null;
}

export interface StatBoost {
  offensiveBonus: number; // Multiplier for offensive stats
  pitchingBonus: number;  // Multiplier for pitching effectiveness
}

// Special Player Categories
export type PlayerCategory = 'current' | 'legend' | 'peak' | 'fictional' | 'oddity' | 'niners' | 'decade' | 'playoff' | 'busts' | 'international' | 'coach' | 'stadium';

export type DraftRoundType = 'normal' | 'legends' | 'peak' | 'fictional' | 'niners' | 'decade_classic' | 'decade_modern' | 'playoff_heroes' | 'one_year_wonders' | 'busts' | 'mystery' | 'auction' | 'steroid_era' | 'international' | 'coach' | 'stadium';

export interface AuctionState {
  elitePlayer: Player;
  phase: 'offer_p1' | 'offer_p2' | 'reveal' | 'done';
  player1Offer: Player | null;
  player2Offer: Player | null;
  winner: 'player1' | 'player2' | null;
}

export interface DraftRound {
  roundNumber: number;
  type: DraftRoundType;
  tier: 'diamond' | 'gold' | 'silver' | 'bronze' | 'common';
}

export interface SpecialPlayer extends Player {
  category: PlayerCategory;
  cardArt?: string; // Special visual treatment
}

// Power Card Types
export type PowerCardType =
  | 'shuffle_deck'    // Redraw 4 new cards
  | 'return_player'   // Return last pick, draft again
  | 'steal_player'    // Take one player from opponent
  | 'skip_turn'       // Opponent loses next pick
  | 'double_pick'     // Draft 2 players this turn
  | 'peek_ahead'      // See next round's pool
  | 'upgrade_tier'    // Current pool upgrades one tier
  | 'trade_pick'      // Swap a player with opponent
  | 'reverse_order'   // Opponent picks from your pool
  | 'time_extension' // Add 15 seconds to draft timer
  | 'sabotage'       // Opponent's next pool is bronze/common
  | 'immunity';      // Protect roster from steal/trade

export interface PowerCard {
  id: string;
  type: PowerCardType;
  name: string;
  description: string;
  icon: string;
  used: boolean;
  cooldown?: number; // Turns until usable again
}

export interface PowerCardState {
  player1Hand: PowerCard[];
  player2Hand: PowerCard[];
  lastUsedTurn: Record<string, number>; // Card type -> turn used
  skipNextTurn: 'player1' | 'player2' | null;
  doublePick: 'player1' | 'player2' | null;
  peekPool: Player[] | null;
  pickForTeam: 'player1' | 'player2' | null;
  sabotageNextPool: 'player1' | 'player2' | null;
  immuneUntilTurn: Record<'player1' | 'player2', number>;
}

// Play Screen Enhancement Types
export type SimulationSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export type PressureLevel = 'low' | 'medium' | 'high' | 'clutch';

export interface GameSituation {
  description: string;
  pressure: PressureLevel;
  isClutch: boolean;
  runnerSituation: string;
}

export interface CurrentMatchup {
  batter: Player;
  pitcher: Player;
  batterTeam: 'player1' | 'player2';
  pitcherTeam: 'player1' | 'player2';
  count?: { balls: number; strikes: number };
}

export interface PlayLogEntry {
  id: string;
  description: string;
  type: 'normal' | 'single' | 'double' | 'triple' | 'homerun' | 'strikeout' | 'walk' | 'out' | 'run' | 'walkoff' | 'inning' | 'momentum';
  batterId: string;
  batterName: string;
  inning: number;
  half: 'top' | 'bottom';
  isUserPlayer?: boolean;
  timestamp: number;
  momentumEvent?: 'rally_building' | 'momentum_shift' | 'rally_killed';
  isClutch?: boolean;
  runsScored?: number;
}

// Collection & Pack System Types
export type PackType = 'standard' | 'premium' | 'legends' | 'fictional' | 'decade' | 'international' | 'steroid_era' | 'playoff' | 'allstar';

export interface CollectionData {
  version: number;
  ownedPlayerIds: string[];
  stubs: number;
  xp: number;
  xpLevel: number;
  packs: Record<PackType, number>;
  stats: {
    packsOpened: number;
    gamesPlayed: number;
    gamesWon: number;
  };
  milestones: Record<string, boolean>;
}

export interface PackReward {
  type: PackType;
  count: number;
  reason: string;
}

export interface PackOpenResult {
  newPlayers: Player[];
  duplicates: Player[];
  stubsEarned: number;
}

export interface SetInfo {
  name: string;
  category: PlayerCategory | 'all';
  icon: string;
  color: string;
  totalPlayers: number;
  ownedPlayers: number;
  completionBonus: number; // stubs
}

export type MilestoneId =
  | 'first_game'
  | 'first_win'
  | 'first_sweep'
  | 'games_5'
  | 'games_10'
  | 'games_20'
  | 'games_50'
  | 'collection_25'
  | 'collection_50'
  | 'collection_75'
  | 'collection_100'
  | 'xp_level_5'
  | 'xp_level_10'
  | 'xp_level_20'
  | 'packs_opened_10'
  | 'packs_opened_25';

export interface MilestoneReward {
  id: MilestoneId;
  name: string;
  packs: PackReward[];
  stubs: number;
}

// ============================================================================
// GAUNTLET ADDITIONS — types specific to the single-player battle-royale loop.
// (Appended onto the ported Dugout Draft type model above.)
// ============================================================================

export type Tier = 'diamond' | 'gold' | 'silver' | 'bronze' | 'common';

// One draft pick: the slot being filled and the position a card must satisfy.
export interface RosterSlot {
  key: string;     // unique slot id, e.g. "SP1"
  label: string;   // display, e.g. "Ace Starter"
  fills: Position; // the position this slot represents
}

// One frozen roster that plays the whole run. Unlike the sim's `DraftedTeam`
// (which carries lineup/rotation/bullpen + an owner), this is just the cards;
// lineup/rotation are derived at sim time via lineupBuilder.
export interface GauntletTeam {
  name: string;
  roster: Player[];        // hitters + pitchers, in pick order
  manager: Player | null;  // HC card
  stadium: Player | null;  // ST card
  lineup?: Record<string, string>; // chosen defensive alignment: position -> playerId (incl. DH)
}

// A serialized opponent snapshot stored in the shared pool. Only ids persist;
// cards hydrate from bundled JSON via hydrateIds().
export interface GhostTeam {
  id: string;
  teamName: string;
  ownerName: string;
  playerIds: string[];
  managerId: string | null;
  stadiumId: string | null;
  streak: number;          // series this ghost won before being banked
  createdAt: number;       // epoch ms
  source: 'player' | 'cpu';
}

export type RunPhase =
  | 'menu'
  | 'drafting'
  | 'roster_review' // set your lineup positions before locking the roster in
  | 'gauntlet'      // auto-playing the run; the series list fills in live
  | 'run_over';

export interface SeriesOutcome {
  opponentName: string;
  opponentStreak: number;
  won: boolean;
  wins: number;            // your game wins (0-4)
  losses: number;          // opponent game wins (0-4)
  runsFor: number;
  runsAgainst: number;
}

export interface RunState {
  phase: RunPhase;
  team: GauntletTeam | null;
  streak: number;
  currentOpponent: GhostTeam | null;
  history: SeriesOutcome[];
  totalRunsFor: number;
  totalRunsAgainst: number;
}
