// Server-side simulation engine (Deno-compatible port)
// Mirrors the logic from src/utils/simulation.ts

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

export interface ScoutingGrades {
  contact?: number;
  power?: number;
  speed?: number;
  fielding?: number;
  arm?: number;
  eye?: number;
  fastball?: number;
  breaking?: number;
  changeup?: number;
  control?: number;
  stamina?: number;
  clutch?: number;
}

export interface StatBoost {
  offensiveBonus: number;
  pitchingBonus: number;
}

export interface SimulationModifiers {
  momentum?: number;
  clutchBoost?: number;
  streakModifier?: number;
}

function getGrade(grades: ScoutingGrades | undefined, key: keyof ScoutingGrades, fallback = 50): number {
  return grades?.[key] ?? fallback;
}

function gradeToMultiplier(grade: number): number {
  return 0.5 + ((grade - 20) / 60);
}

export function simulateAtBat(
  batterGrades: ScoutingGrades,
  pitcherGrades: ScoutingGrades,
  statBoost?: StatBoost,
  modifiers?: SimulationModifiers
): AtBatResult {
  const offensiveMultiplier = statBoost?.offensiveBonus ?? 1.0;
  const pitchingMultiplier = statBoost?.pitchingBonus ?? 1.0;

  const momentumBoost = modifiers?.momentum ? (modifiers.momentum / 100) * 5 : 0;
  const clutchBoost = modifiers?.clutchBoost ?? 0;
  const streakMod = modifiers?.streakModifier ?? 0;
  const totalBoost = momentumBoost + clutchBoost + streakMod;

  const contact = (getGrade(batterGrades, 'contact') + totalBoost) * offensiveMultiplier;
  const power = (getGrade(batterGrades, 'power') + momentumBoost + clutchBoost) * offensiveMultiplier;
  const speed = getGrade(batterGrades, 'speed');
  const eye = (getGrade(batterGrades, 'eye') + momentumBoost + clutchBoost) * offensiveMultiplier;

  const fastball = getGrade(pitcherGrades, 'fastball') * pitchingMultiplier;
  const breaking = getGrade(pitcherGrades, 'breaking') * pitchingMultiplier;
  const control = getGrade(pitcherGrades, 'control') * pitchingMultiplier;

  const batterKAvoid = gradeToMultiplier(contact * 0.6 + eye * 0.4);
  const pitcherKAbility = gradeToMultiplier(breaking * 0.5 + control * 0.3 + fastball * 0.2);
  const baseK = 0.22 * pitcherKAbility / batterKAvoid;
  const strikeoutChance = Math.max(0.08, Math.min(0.42, baseK));

  const batterWalkAbility = gradeToMultiplier(eye);
  const pitcherWalkAvoid = gradeToMultiplier(control);
  const baseWalk = 0.085 * batterWalkAbility / pitcherWalkAvoid;
  const walkChance = Math.max(0.03, Math.min(0.20, baseWalk));

  const contactMod = gradeToMultiplier(contact);
  const speedMod = gradeToMultiplier(speed);
  const baseBabip = 0.300 * (contactMod * 0.7 + speedMod * 0.3);
  const babip = Math.min(0.380, Math.max(0.240, baseBabip));

  const pitcherEffectiveness = gradeToMultiplier((fastball + breaking + control) / 3);
  const effectiveBabip = babip / pitcherEffectiveness;

  const roll = Math.random();
  let cumulative = 0;

  cumulative += strikeoutChance;
  if (roll < cumulative) return 'strikeout';

  cumulative += walkChance;
  if (roll < cumulative) return 'walk';

  const hitRoll = Math.random();
  if (hitRoll < effectiveBabip) {
    const powerMod = gradeToMultiplier(power);
    const typeRoll = Math.random();
    const hrRate = Math.min(0.15, Math.max(0.01, 0.04 * powerMod));
    if (typeRoll < hrRate) return 'homerun';

    const tripleRate = Math.min(0.05, Math.max(0.005, 0.02 * gradeToMultiplier(speed)));
    if (typeRoll < hrRate + tripleRate) return 'triple';

    const doubleRate = Math.min(0.30, Math.max(0.12, 0.18 * (powerMod * 0.7 + speedMod * 0.3)));
    if (typeRoll < hrRate + tripleRate + doubleRate) return 'double';

    return 'single';
  }

  const outRoll = Math.random();
  const dpChance = Math.max(0.02, Math.min(0.12, 0.10 * (1 - (speed - 20) / 80)));
  if (outRoll < dpChance) return 'double_play';
  if (outRoll < 0.45) return 'groundout';
  if (outRoll < 0.85) return 'flyout';
  return 'lineout';
}

export interface RunnerAdvanceResult {
  runsScored: number;
  newRunners: [boolean, boolean, boolean];
  newOuts: number;
}

export function advanceRunners(
  result: AtBatResult,
  runners: [boolean, boolean, boolean],
  batterSpeed: number,
  currentOuts: number
): RunnerAdvanceResult {
  let runsScored = 0;
  let newRunners: [boolean, boolean, boolean] = [...runners];
  let newOuts = currentOuts;

  switch (result) {
    case 'homerun':
      runsScored = 1 + runners.filter(Boolean).length;
      newRunners = [false, false, false];
      break;
    case 'triple':
      runsScored = runners.filter(Boolean).length;
      newRunners = [false, false, true];
      break;
    case 'double':
      if (runners[2]) runsScored++;
      if (runners[1]) runsScored++;
      newRunners = runners[0] ? [false, true, true] : [false, true, false];
      break;
    case 'single':
      newRunners = [true, runners[0], runners[1]];
      if (runners[2]) runsScored++;
      if (runners[1] && batterSpeed > 70) { runsScored++; newRunners[2] = false; }
      break;
    case 'walk':
      if (runners[0]) {
        if (runners[1]) {
          if (runners[2]) runsScored = 1;
          newRunners = [true, true, true];
        } else {
          newRunners = [true, true, runners[2]];
        }
      } else {
        newRunners = [true, runners[1], runners[2]];
      }
      break;
    case 'strikeout':
      newOuts++;
      break;
    case 'groundout':
      newOuts++;
      if (runners[2] && currentOuts < 2) { runsScored = 1; newRunners[2] = false; }
      if (runners[1] && !runners[2]) { newRunners[2] = true; newRunners[1] = false; }
      if (runners[0] && !runners[1]) { newRunners[1] = true; newRunners[0] = false; }
      break;
    case 'flyout':
      newOuts++;
      if (runners[2] && currentOuts < 2) { runsScored = 1; newRunners[2] = false; }
      break;
    case 'lineout':
      newOuts++;
      break;
    case 'double_play':
      if (runners[0] && currentOuts < 2) {
        newOuts += 2;
        newRunners[0] = false;
        if (runners[2] && Math.random() > 0.5) { runsScored = 1; newRunners[2] = false; }
      } else {
        newOuts++;
      }
      break;
  }

  return { runsScored, newRunners, newOuts };
}

export function shouldSubstitutePitcher(
  isStarter: boolean,
  pitchCount: number,
  inning: number,
): boolean {
  if (isStarter) {
    if (pitchCount > 95) return true;
    if (inning >= 7 && pitchCount > 80) return true;
  } else {
    if (pitchCount > 35) return true;
  }
  return false;
}
