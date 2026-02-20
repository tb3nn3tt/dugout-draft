import { GameState, PressureLevel, GameSituation, PlayLogEntry, AtBatResult } from '../types';

/**
 * Calculate the pressure level of the current game situation
 */
export function calculatePressure(gameState: GameState): PressureLevel {
  const { inning, halfInning, outs, runners, score } = gameState;
  const [awayScore, homeScore] = score;
  const scoreDiff = Math.abs(awayScore - homeScore);

  // Late game close situations are high pressure
  const isLateGame = inning >= 7;
  const isCloseGame = scoreDiff <= 2;
  const isVeryCloseGame = scoreDiff <= 1;

  // Runners in scoring position with 2 outs
  const runnersInScoringPosition = runners[1] || runners[2];
  const twoOuts = outs === 2;

  // 9th inning or later with close game
  if (inning >= 9) {
    if (scoreDiff === 0) return 'clutch';
    if (halfInning === 'bottom' && homeScore < awayScore && scoreDiff <= 3) {
      return 'clutch';
    }
    if (isVeryCloseGame) return 'clutch';
  }

  // High pressure situations
  if (isLateGame && isCloseGame && runnersInScoringPosition && twoOuts) {
    return 'high';
  }

  if (isLateGame && isVeryCloseGame) {
    return 'high';
  }

  // Medium pressure
  if (isLateGame || (isCloseGame && runnersInScoringPosition)) {
    return 'medium';
  }

  return 'low';
}

/**
 * Get a description of the current runner situation
 */
export function getRunnerSituation(runners: [boolean, boolean, boolean]): string {
  const [first, second, third] = runners;

  if (!first && !second && !third) return 'Bases empty';
  if (first && second && third) return 'Bases loaded';
  if (first && !second && !third) return 'Runner on first';
  if (!first && second && !third) return 'Runner on second';
  if (!first && !second && third) return 'Runner on third';
  if (first && second && !third) return 'Runners on first and second';
  if (first && !second && third) return 'Runners on first and third';
  if (!first && second && third) return 'Runners in scoring position';

  return 'Runners on base';
}

/**
 * Get a dramatic description of the game situation
 */
export function getGameSituation(gameState: GameState): GameSituation {
  const { inning, halfInning, outs, runners, score } = gameState;
  const [awayScore, homeScore] = score;
  const pressure = calculatePressure(gameState);
  const runnerSituation = getRunnerSituation(runners);

  const halfLabel = halfInning === 'top' ? 'Top' : 'Bottom';
  const outsText = outs === 1 ? '1 out' : `${outs} outs`;

  let description = `${halfLabel} ${inning}, ${outsText}`;

  // Add score context
  if (awayScore === homeScore) {
    description += ', game tied';
  } else if (halfInning === 'bottom' && homeScore < awayScore) {
    const deficit = awayScore - homeScore;
    if (deficit === 1) {
      description += ', trailing by 1';
    } else {
      description += `, down by ${deficit}`;
    }
  }

  // Add runner context for dramatic situations
  if (pressure === 'clutch' || pressure === 'high') {
    if (runners[2]) {
      description += ', tying run on third';
    } else if (runners[1]) {
      description += ', tying run in scoring position';
    }
  }

  return {
    description,
    pressure,
    isClutch: pressure === 'clutch',
    runnerSituation,
  };
}

/**
 * Determine the type of play for styling
 */
export function getPlayType(result: AtBatResult): PlayLogEntry['type'] {
  switch (result) {
    case 'homerun':
      return 'homerun';
    case 'triple':
      return 'triple';
    case 'double':
      return 'double';
    case 'single':
      return 'single';
    case 'strikeout':
      return 'strikeout';
    case 'walk':
      return 'walk';
    case 'groundout':
    case 'flyout':
    case 'lineout':
    case 'double_play':
      return 'out';
    default:
      return 'normal';
  }
}

/**
 * Create a play log entry with proper type
 */
let playLogCounter = 0;
export function createPlayLogEntry(
  description: string,
  type: PlayLogEntry['type'],
  batterId: string,
  batterName: string,
  inning: number,
  half: 'top' | 'bottom',
  isUserPlayer?: boolean
): PlayLogEntry {
  return {
    id: `play-${++playLogCounter}`,
    description,
    type,
    batterId,
    batterName,
    inning,
    half,
    isUserPlayer,
    timestamp: Date.now(),
  };
}

/**
 * Get color for play type
 */
export function getPlayColor(type: PlayLogEntry['type']): string {
  const colors: Record<PlayLogEntry['type'], string> = {
    normal: '#a0aec0',
    single: '#68d391',
    double: '#48bb78',
    triple: '#ed8936',
    homerun: '#f6e05e',
    strikeout: '#fc8181',
    walk: '#63b3ed',
    out: '#a0aec0',
    run: '#9f7aea',
    walkoff: '#f6e05e',
    inning: '#805ad5',
    momentum: '#f687b3',
  };
  return colors[type];
}

/**
 * Get pressure color
 */
export function getPressureColor(pressure: PressureLevel): string {
  const colors: Record<PressureLevel, string> = {
    low: '#48bb78',
    medium: '#f6e05e',
    high: '#ed8936',
    clutch: '#fc8181',
  };
  return colors[pressure];
}

/**
 * Get speed delay in milliseconds
 */
export function getSpeedDelay(speed: 'slow' | 'normal' | 'fast' | 'instant'): number {
  const delays = {
    slow: 1500,
    normal: 500,
    fast: 150,
    instant: 0,
  };
  return delays[speed];
}
