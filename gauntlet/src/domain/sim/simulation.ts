import { Player, AtBatResult, StatBoost, ScoutingGrades, CoachEffect, ParkEffect } from '../types';
import { rand } from './rng';

// ============================================================================
// KILLER SIM — Odds Ratio (Log5) matchup engine, anchored to MLB league rates.
//
// Why Odds Ratio: to find P(outcome) when a specific batter faces a specific
// pitcher, you don't average their rates — you combine them in ODDS space
// relative to the league baseline. When both are league-average the result is
// exactly the league rate (self-calibrating, no arbitrary clamps), and an
// ace-vs-slugger duel resolves correctly instead of pinning to a floor.
// ============================================================================

/** Modern-MLB per-plate-appearance baselines the whole model is anchored to. */
const LEAGUE = {
  K: 0.225,      // strikeouts / PA
  BB: 0.085,     // (unintentional) walks / PA
  HBP: 0.011,    // hit-by-pitch / PA  (folded into "reached, like a walk")
  HR: 0.033,     // home runs / PA
  BABIP: 0.300,  // hits per ball-in-play (excludes K/BB/HBP/HR)
} as const;

// In-play hit-type shares (of non-HR hits) and out-type shares — league anchors.
const HIT_SPLIT = { single: 0.78, double: 0.195, triple: 0.025 };
const OUT_SPLIT = { ground: 0.46, fly: 0.34, line: 0.20 };

/**
 * Odds Ratio Method. b, p, lg are the batter's, pitcher's, and league's true
 * rates for the SAME event. Returns the matchup probability. b=p=lg → lg.
 */
function oddsRatio(b: number, p: number, lg: number): number {
  const clamp = (x: number) => Math.min(0.999, Math.max(0.001, x));
  const bo = clamp(b) / (1 - clamp(b));
  const po = clamp(p) / (1 - clamp(p));
  const lo = clamp(lg) / (1 - clamp(lg));
  const o = (bo * po) / lo;
  return o / (1 + o);
}

/**
 * Grade → rate multiplier. A 20-80 grade has mean 50, sd ~10, so (grade-50)/10
 * is roughly a z-score. We scale the league rate by `perSigma` raised to that
 * z, so each 10 grade points multiplies the rate by `perSigma` (dir flips it).
 */
function rateFactor(grade: number, perSigma: number, dir: 1 | -1): number {
  const z = (grade - 50) / 10;
  return Math.pow(perSigma, dir * z);
}

export interface SimulationModifiers {
  momentum?: number;       // 0-100, batter's team momentum
  clutchBoost?: number;    // grade points to add (roughly -5 to +5)
  streakModifier?: number; // +3 for hot, -3 for cold, 0 for neutral
}

// Helper to get scouting grade or default to 50 (average)
function getGrade(grades: ScoutingGrades | undefined, key: keyof ScoutingGrades, fallback = 50): number {
  return grades?.[key] ?? fallback;
}

// Convert legacy stats to approximate scouting grades for backwards compatibility
export function inferGradesFromStats(player: Player): ScoutingGrades {
  const stats = player.stats;
  const isPitcher = player.positions.some(p => ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(p));

  if (isPitcher) {
    // Convert pitcher stats to grades
    const k9 = stats.k9 ?? 8.0;
    const bb9 = stats.bb9 ?? 3.0;

    // K/9 to fastball (higher K/9 = better stuff)
    const fastballGrade = Math.min(80, Math.max(20, 30 + k9 * 4));
    // BB/9 to control (lower BB/9 = better control)
    const controlGrade = Math.min(80, Math.max(20, 80 - bb9 * 8));
    // Breaking based on overall
    const breakingGrade = Math.min(80, Math.max(20, player.overall * 0.8));

    return {
      fastball: Math.round(fastballGrade),
      breaking: Math.round(breakingGrade),
      control: Math.round(controlGrade),
      stamina: player.positions.includes('SP') ? 70 : 50,
    };
  } else {
    // Convert hitter stats to grades
    const avg = stats.avg ?? 0.250;
    const obp = stats.obp ?? 0.320;
    const slg = stats.slg ?? 0.400;
    const speed = stats.speed ?? 50;
    const hr = stats.hr ?? 15;

    // Contact based on AVG
    const contactGrade = Math.min(80, Math.max(20, 20 + avg * 200));
    // Power based on SLG and HR
    const iso = slg - avg;
    const powerGrade = Math.min(80, Math.max(20, 30 + iso * 150 + hr * 0.3));
    // Eye based on OBP - AVG (walk rate proxy)
    const eyeGrade = Math.min(80, Math.max(20, 30 + (obp - avg) * 400));
    // Speed directly from legacy speed stat (0-100 to 20-80)
    const speedGrade = Math.min(80, Math.max(20, 20 + speed * 0.6));
    // Fielding/arm default to average, slightly better for overall
    const fieldingGrade = Math.min(80, Math.max(20, 40 + player.overall * 0.2));

    return {
      contact: Math.round(contactGrade),
      power: Math.round(powerGrade),
      speed: Math.round(speedGrade),
      eye: Math.round(eyeGrade),
      fielding: Math.round(fieldingGrade),
      arm: Math.round(fieldingGrade),
    };
  }
}

/**
 * Calculate platoon advantage based on batter/pitcher handedness.
 * Returns a grade-point modifier (roughly -3 to +3).
 */
function getPlatoonModifier(batter: Player, pitcher: Player): number {
  const bats = batter.bats;
  const throws = pitcher.throws;

  // Switch hitters: no platoon penalty or bonus
  if (bats === 'S') return 0;

  // Same-handed matchup = disadvantage for batter
  if (bats === 'L' && throws === 'L') return -3;  // LHB vs LHP
  if (bats === 'R' && throws === 'R') return -2;  // RHB vs RHP (less pronounced)

  // Opposite-handed matchup = advantage for batter
  if (bats === 'L' && throws === 'R') return 2;   // LHB vs RHP
  if (bats === 'R' && throws === 'L') return 3;   // RHB vs LHP

  return 0;
}

export function simulateAtBat(
  batter: Player,
  pitcher: Player,
  statBoost?: StatBoost,
  modifiers?: SimulationModifiers,
  batterCoach?: CoachEffect | null,
  pitcherCoach?: CoachEffect | null,
  parkEffect?: ParkEffect | null
): AtBatResult {
  // Get scouting grades (use explicit grades or infer from stats)
  const batterGrades = batter.grades ?? inferGradesFromStats(batter);
  const pitcherGrades = pitcher.grades ?? inferGradesFromStats(pitcher);

  // Apply synergy boosts
  const offensiveMultiplier = statBoost?.offensiveBonus ?? 1.0;
  const pitchingMultiplier = statBoost?.pitchingBonus ?? 1.0;

  // --- Situational grade adjustments (momentum / clutch / streak / platoon /
  //     coach) are applied as grade POINTS to the batter, preserving the
  //     intuitive semantics of the original modifiers. ---
  const momentumBoost = modifiers?.momentum ? (modifiers.momentum / 100) * 5 : 0;
  const clutchBoost = modifiers?.clutchBoost ?? 0;
  const streakMod = modifiers?.streakModifier ?? 0;
  const platoonMod = getPlatoonModifier(batter, pitcher);
  const coachClutch = batterCoach?.clutchBonus ?? 0;
  const coachSpeed = batterCoach?.speedBonus ?? 0;
  const coachFielding = pitcherCoach?.fieldingBonus ?? 0; // pitching team's defense

  const hitterBoost = momentumBoost + clutchBoost + streakMod + platoonMod + coachClutch;

  // Effective batter grades (clamped to the 20-80 scouting band).
  const clampG = (g: number) => Math.min(80, Math.max(20, g));
  const contact = clampG(getGrade(batterGrades, 'contact') + hitterBoost);
  const power   = clampG(getGrade(batterGrades, 'power') + momentumBoost + clutchBoost + platoonMod);
  const speed   = clampG(getGrade(batterGrades, 'speed') + coachSpeed);
  const eye     = clampG(getGrade(batterGrades, 'eye') + momentumBoost + clutchBoost);

  // Pitcher grades.
  const fastball = getGrade(pitcherGrades, 'fastball');
  const breaking = getGrade(pitcherGrades, 'breaking');
  const control  = getGrade(pitcherGrades, 'control');
  const stuff    = fastball * 0.4 + breaking * 0.4 + control * 0.2; // composite "stuff"

  // === Per-PA true rates for batter and pitcher, then combine via Odds Ratio ===
  // Synergy multipliers nudge a side's whole profile (offense up / pitching up).

  // Strikeouts: batter avoids with contact+eye; pitcher generates with stuff.
  const bK = LEAGUE.K * rateFactor(contact * 0.6 + eye * 0.4, 1.27, -1) / offensiveMultiplier;
  const pK = LEAGUE.K * rateFactor(stuff, 1.27, 1) * pitchingMultiplier;
  const kProb = oddsRatio(bK, pK, LEAGUE.K);

  // Walks (+ HBP folded in): batter earns with eye; pitcher prevents with control.
  const bBB = LEAGUE.BB * rateFactor(eye, 1.24, 1) * offensiveMultiplier;
  const pBB = LEAGUE.BB * rateFactor(control, 1.24, -1) / pitchingMultiplier;
  const bbProb = oddsRatio(bBB, pBB, LEAGUE.BB) + LEAGUE.HBP;

  // Home runs: batter drives with power; pitcher suppresses with control+breaking.
  const parkHR = parkEffect?.hrFactor ?? 1.0;
  const bHR = LEAGUE.HR * rateFactor(power, 1.34, 1) * offensiveMultiplier;
  const pHR = LEAGUE.HR * rateFactor(control * 0.5 + breaking * 0.5, 1.32, -1) / pitchingMultiplier;
  const hrProb = oddsRatio(bHR, pHR, LEAGUE.HR) * parkHR;

  // Guard a floor so at least ~8% of PAs are balls in play. If the three
  // terminal events (K/BB/HR) sum too high, scale them down together so the
  // outcome draw below stays consistent with the floor.
  let kP = kProb, bbP = bbProb, hrP = hrProb;
  const terminal = kP + bbP + hrP;
  if (terminal > 0.92) {
    const s = 0.92 / terminal;
    kP *= s; bbP *= s; hrP *= s;
  }

  // BABIP matchup: batter (contact+speed) vs pitcher stuff, park + defense applied.
  const parkRun = parkEffect?.runFactor ?? 1.0;
  const fieldingReduction = 1 + coachFielding * 0.004; // better D → fewer hits on balls in play
  const bBABIP = LEAGUE.BABIP * rateFactor(contact * 0.7 + speed * 0.3, 1.09, 1) * offensiveMultiplier;
  const pBABIP = LEAGUE.BABIP * rateFactor(stuff, 1.10, -1) / pitchingMultiplier;
  const babip = Math.min(0.420, Math.max(0.220, oddsRatio(bBABIP, pBABIP, LEAGUE.BABIP) * parkRun / fieldingReduction));

  // === OUTCOME DRAW (seeded) ===
  const roll = rand();
  if (roll < kP) return 'strikeout';
  if (roll < kP + bbP) return 'walk';                 // walk or HBP — reaches first
  if (roll < kP + bbP + hrP) return 'homerun';

  // Ball in play (non-HR): hit or out?
  if (rand() < babip) {
    // Hit type among non-HR hits. Power lifts doubles; speed lifts triples.
    const parkDouble = parkEffect?.doublesFactor ?? 1.0;
    const parkTriple = parkEffect?.triplesFactor ?? 1.0;
    let p3 = HIT_SPLIT.triple * rateFactor(speed, 1.30, 1) * parkTriple;
    let p2 = HIT_SPLIT.double * rateFactor(power * 0.6 + speed * 0.4, 1.18, 1) * parkDouble;
    p3 = Math.min(0.10, p3);
    p2 = Math.min(0.40, p2);
    const t = rand();
    if (t < p3) return 'triple';
    if (t < p3 + p2) return 'double';
    return 'single';
  }

  // Out on a ball in play. Park errors can convert an out into a reached-base.
  const parkError = parkEffect?.errorFactor ?? 1.0;
  const errorChance = Math.max(0, (parkError - 1.0) * 0.5);
  if (errorChance > 0 && rand() < errorChance) return 'single';

  // Double play more likely behind slow batters (advanceRunners gates on base state).
  const dpChance = Math.min(0.14, Math.max(0.02, 0.09 * rateFactor(speed, 1.25, -1)));
  const outRoll = rand();
  if (outRoll < dpChance) return 'double_play';

  // Remaining outs split ground / fly / line.
  const rest = (outRoll - dpChance) / (1 - dpChance);
  if (rest < OUT_SPLIT.ground) return 'groundout';
  if (rest < OUT_SPLIT.ground + OUT_SPLIT.fly) return 'flyout';
  return 'lineout';
}

interface RunnerAdvanceResult {
  runsScored: number;
  newRunners: [boolean, boolean, boolean];
  newOuts: number;
  description: string;
}

export function advanceRunners(
  result: AtBatResult,
  runners: [boolean, boolean, boolean],
  batter: Player,
  currentOuts: number
): RunnerAdvanceResult {
  let runsScored = 0;
  let newRunners: [boolean, boolean, boolean] = [...runners];
  let newOuts = currentOuts;
  let description = '';

  const speed = batter.stats.speed ?? 50;

  switch (result) {
    case 'homerun':
      runsScored = 1 + runners.filter(Boolean).length;
      newRunners = [false, false, false];
      description = `HOME RUN! ${runsScored} run(s) score!`;
      break;

    case 'triple':
      runsScored = runners.filter(Boolean).length;
      newRunners = [false, false, true];
      description = `Triple!${runsScored > 0 ? ` ${runsScored} run(s) score!` : ''}`;
      break;

    case 'double':
      // Runners on 3rd and 2nd always score. Runner on 1st always goes to 3rd (realistic for doubles).
      if (runners[2]) runsScored++;
      if (runners[1]) runsScored++;
      if (runners[0]) {
        newRunners = [false, true, true]; // Batter to 2nd, runner from 1st to 3rd
      } else {
        newRunners = [false, true, false]; // Batter to 2nd
      }
      description = `Double!${runsScored > 0 ? ` ${runsScored} run(s) score!` : ''}`;
      break;

    case 'single': {
      // Runner on 3rd always scores.
      // Runner on 2nd: speed-weighted probability 0.35 + (speed/100)*0.50 (range ~45-85%)
      // Runner on 1st → 2nd. Batter → 1st.
      runsScored = 0;
      if (runners[2]) runsScored++;
      let runnerFromSecondScored = false;
      if (runners[1]) {
        const scoreProb = 0.35 + (speed / 100) * 0.50;
        if (rand() < scoreProb) {
          runsScored++;
          runnerFromSecondScored = true;
        }
      }
      // Set new runners: batter to 1st, runner from 1st to 2nd,
      // runner from 2nd to 3rd (if didn't score)
      newRunners = [
        true,                                    // batter → 1st
        runners[0],                              // runner from 1st → 2nd
        runners[1] && !runnerFromSecondScored,   // runner from 2nd → 3rd (if didn't score)
      ];
      description = `Single${runsScored > 0 ? ` - ${runsScored} run(s) score!` : ''}`;
    }
      break;

    case 'walk':
      // Advance runners only if forced
      if (runners[0]) {
        if (runners[1]) {
          if (runners[2]) {
            runsScored = 1;
          }
          newRunners = [true, true, true];
        } else {
          newRunners = [true, true, runners[2]];
        }
      } else {
        newRunners = [true, runners[1], runners[2]];
      }
      description = `Walk${runsScored > 0 ? ' - run scores!' : ''}`;
      break;

    case 'strikeout':
      newOuts++;
      description = 'Strikeout';
      break;

    case 'groundout':
      newOuts++;
      // Runner on 3rd might score on groundout with less than 2 outs
      if (runners[2] && currentOuts < 2) {
        runsScored = 1;
        newRunners[2] = false;
      }
      // Runners advance
      if (runners[1] && !runners[2]) {
        newRunners[2] = true;
        newRunners[1] = false;
      }
      if (runners[0] && !runners[1]) {
        newRunners[1] = true;
        newRunners[0] = false;
      }
      description = `Groundout${runsScored > 0 ? ' - run scores!' : ''}`;
      break;

    case 'flyout':
      newOuts++;
      // Sac fly - runner on 3rd scores with less than 2 outs
      if (runners[2] && currentOuts < 2) {
        runsScored = 1;
        newRunners[2] = false;
        description = 'Sacrifice fly - run scores!';
      } else {
        description = 'Flyout';
      }
      break;

    case 'lineout':
      newOuts++;
      description = 'Lineout';
      break;

    case 'double_play':
      if (runners[0] && currentOuts < 2) {
        newOuts += 2;
        newRunners[0] = false; // Runner on 1st forced out
        // Runner on 2nd advances to 3rd on DP
        if (runners[1]) {
          newRunners[1] = false;
          newRunners[2] = true;
        }
        // Runner on 3rd scoring chance: 0.20 + (speed/100)*0.50 (range ~30-70%)
        if (runners[2]) {
          const dpScoreProb = 0.20 + (speed / 100) * 0.50;
          if (rand() < dpScoreProb) {
            runsScored = 1;
            newRunners[2] = false;
          }
        }
        description = `Double play!${runsScored > 0 ? ' Run scores!' : ''}`;
      } else {
        newOuts++;
        description = 'Groundout';
      }
      break;
  }

  return { runsScored, newRunners, newOuts, description };
}

/**
 * Stamina-aware pitcher substitution check.
 * Uses pitcher.grades?.stamina (20-80 scale) to determine max pitch count.
 * SP: maxPitches = 55 + stamina * 0.67  (stamina 30→75, 50→89, 70→102, 90→115)
 * RP: maxPitches = 5 + stamina * 0.5    (stamina 30→20, 50→30, 70→40)
 */
export function shouldSubstitutePitcher(
  pitcher: Player,
  pitchCount: number,
  inning: number,
  _outs: number,
  staminaBonus: number = 0
): boolean {
  const isStarter = pitcher.positions.includes('SP');
  const grades = pitcher.grades ?? inferGradesFromStats(pitcher);
  const stamina = grades.stamina ?? (isStarter ? 70 : 50);

  if (isStarter) {
    const maxPitches = 55 + stamina * 0.67 + staminaBonus;
    if (pitchCount > maxPitches) return true;
    // Late-game threshold: pull earlier in 7th+
    if (inning >= 7 && pitchCount > maxPitches - 15) return true;
  } else {
    const maxPitches = 5 + stamina * 0.5 + staminaBonus;
    if (pitchCount > maxPitches) return true;
  }

  return false;
}

/**
 * Shared role-based reliever selection.
 * Priority: 9th+lead→CL, 7-8+lead→SU, LHB→LOOGY, <7th→LRP, mid→MRP, fallback→highest OVR
 */
export function selectReliever(
  bullpen: Player[],
  closer: Player | null,
  currentPitcherId: string,
  inning: number,
  scoreDiff: number,
  nextBatterBats: string,
  usedPitcherIds: Set<string>
): Player | null {
  const available = bullpen.filter(
    p => p.id !== currentPitcherId && !usedPitcherIds.has(p.id)
  );

  // 9th+ with lead: bring in closer
  if (inning >= 9 && scoreDiff > 0 && closer &&
      closer.id !== currentPitcherId && !usedPitcherIds.has(closer.id)) {
    return closer;
  }

  if (available.length === 0) return null;

  // 7th-8th with lead: prefer SU
  if (inning >= 7 && scoreDiff > 0) {
    const su = available.filter(p => p.positions.includes('SU'));
    if (su.length > 0) return su[0];
  }

  // LOOGY: left-handed batter → prefer LOOGY specialist
  if (nextBatterBats === 'L') {
    const loogy = available.filter(p => p.positions.includes('LOOGY'));
    if (loogy.length > 0) return loogy[0];
  }

  // Early relief (before 7th): prefer LRP
  if (inning < 7) {
    const lrp = available.filter(p => p.positions.includes('LRP'));
    if (lrp.length > 0) return lrp[0];
  }

  // Mid-game: prefer MRP
  const mrp = available.filter(p => p.positions.includes('MRP'));
  if (mrp.length > 0) return mrp[0];

  // Default: highest overall
  return [...available].sort((a, b) => b.overall - a.overall)[0];
}

/**
 * Emergency pitcher when bullpen is exhausted.
 * Re-enters the highest-OVR reliever who already pitched.
 */
export function selectEmergencyPitcher(
  bullpen: Player[],
  closer: Player | null,
  currentPitcherId: string
): Player | null {
  const allRelievers = [...bullpen];
  if (closer) allRelievers.push(closer);
  const candidates = allRelievers.filter(p => p.id !== currentPitcherId);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.overall - a.overall)[0];
}

// ── Shared Bench Utility Functions ──────────────────────────────────────────

/**
 * Get bench hitters: roster players not in lineup or pitching staff.
 */
export function getBenchPlayers(
  roster: Player[],
  battingOrder: Player[],
  rotation: Player[],
  closer: Player | null,
  bullpen: Player[]
): Player[] {
  const lineupIds = new Set(battingOrder.map(p => p.id));
  const pitcherIds = new Set([
    ...rotation.map(p => p.id),
    ...(closer ? [closer.id] : []),
    ...bullpen.map(p => p.id),
  ]);
  return roster.filter(p => !lineupIds.has(p.id) && !pitcherIds.has(p.id));
}

/**
 * Find a pinch hitter for a batter with same-hand disadvantage.
 * 7th+ inning, close game (within 3 runs), platoon disadvantage.
 */
export function findPinchHitter(
  bench: Player[],
  batter: Player,
  pitcherThrows: string,
  inning: number,
  scoreDiff: number,
  usedBenchIds: Set<string>
): Player | null {
  if (inning < 7 || Math.abs(scoreDiff) > 3) return null;

  const hasDisadvantage =
    (batter.bats === 'L' && pitcherThrows === 'L') ||
    (batter.bats === 'R' && pitcherThrows === 'R');
  if (!hasDisadvantage) return null;

  const available = bench.filter(p => !usedBenchIds.has(p.id));
  const opposite = available.filter(p =>
    (pitcherThrows === 'L' && (p.bats === 'R' || p.bats === 'S')) ||
    (pitcherThrows === 'R' && (p.bats === 'L' || p.bats === 'S'))
  );
  if (opposite.length === 0) return null;

  // Prefer PH-position players first
  const phPlayers = opposite.filter(p => p.positions.includes('PH'));
  if (phPlayers.length > 0) return [...phPlayers].sort((a, b) => b.overall - a.overall)[0];
  return [...opposite].sort((a, b) => b.overall - a.overall)[0];
}

/**
 * Find a pinch runner for a slow baserunner.
 * 8th+ inning, runner with speed < 35.
 */
export function findPinchRunner(
  bench: Player[],
  runner: Player,
  inning: number,
  usedBenchIds: Set<string>
): Player | null {
  if (inning < 8) return null;
  const speed = runner.stats.speed ?? 50;
  if (speed >= 35) return null;

  const available = bench.filter(p => !usedBenchIds.has(p.id));

  // Prefer PR-position players first
  const prPlayers = available.filter(p => p.positions.includes('PR'));
  if (prPlayers.length > 0) return [...prPlayers].sort((a, b) => (b.stats.speed ?? 50) - (a.stats.speed ?? 50))[0];

  const fast = available.filter(p => (p.stats.speed ?? 50) >= 70);
  if (fast.length === 0) return null;
  return [...fast].sort((a, b) => (b.stats.speed ?? 50) - (a.stats.speed ?? 50))[0];
}

/**
 * Find a defensive substitute for weak fielders.
 * 8th+ inning with 2+ run lead. IFD replaces weakest infielder, OFD replaces weakest outfielder.
 */
export function findDefensiveSub(
  bench: Player[],
  battingOrder: Player[],
  inning: number,
  scoreDiff: number,
  usedBenchIds: Set<string>
): { sub: Player; replacedId: string; position: string } | null {
  if (inning < 8 || scoreDiff < 2) return null;

  const available = bench.filter(p => !usedBenchIds.has(p.id));

  const getFielding = (p: Player): number => {
    const grades = p.grades ?? inferGradesFromStats(p);
    return grades.fielding ?? 50;
  };

  // Check IFD subs
  const ifd = available.find(p => p.positions.includes('IFD'));
  if (ifd) {
    const infielders = battingOrder.filter(p =>
      p.positions.some(pos => ['2B', '3B', 'SS'].includes(pos))
    );
    const weakest = infielders
      .filter(p => getFielding(p) < 55)
      .sort((a, b) => getFielding(a) - getFielding(b))[0];
    if (weakest) {
      return { sub: ifd, replacedId: weakest.id, position: 'IFD' };
    }
  }

  // Check OFD subs
  const ofd = available.find(p => p.positions.includes('OFD'));
  if (ofd) {
    const outfielders = battingOrder.filter(p =>
      p.positions.some(pos => ['LF', 'CF', 'RF'].includes(pos))
    );
    const weakest = outfielders
      .filter(p => getFielding(p) < 55)
      .sort((a, b) => getFielding(a) - getFielding(b))[0];
    if (weakest) {
      return { sub: ofd, replacedId: weakest.id, position: 'OFD' };
    }
  }

  return null;
}

/**
 * Find a backup catcher substitute.
 * Blowout (5+ run diff) or extra innings (11+).
 */
export function findBackupCatcher(
  bench: Player[],
  battingOrder: Player[],
  inning: number,
  scoreDiff: number,
  usedBenchIds: Set<string>
): { sub: Player; replacedId: string } | null {
  if (Math.abs(scoreDiff) < 5 && inning < 11) return null;

  const available = bench.filter(p => !usedBenchIds.has(p.id));
  const bc = available.find(p => p.positions.includes('BC'));
  if (!bc) return null;

  const startingC = battingOrder.find(p => p.positions.includes('C'));
  if (!startingC) return null;

  return { sub: bc, replacedId: startingC.id };
}

/**
 * Determine which team is "home" for a given game in a 2-3-2 series format.
 * Games 1,2,6,7 = higher seed (player1) home; Games 3,4,5 = away team (player2) home.
 */
export function getHomeTeamForGame(
  gameNumber: number,
  higherSeed: 'player1' | 'player2' = 'player1'
): 'player1' | 'player2' {
  const higherSeedHome = [1, 2, 6, 7];
  if (higherSeedHome.includes(gameNumber)) {
    return higherSeed;
  }
  return higherSeed === 'player1' ? 'player2' : 'player1';
}

export function getGameSituation(gameState: {
  inning: number;
  halfInning: 'top' | 'bottom';
  outs: number;
  runners: [boolean, boolean, boolean];
  score: [number, number];
}): string {
  const { inning, halfInning, outs, runners, score } = gameState;

  const half = halfInning === 'top' ? 'Top' : 'Bottom';
  const runnerDesc = [];
  if (runners[0]) runnerDesc.push('1st');
  if (runners[1]) runnerDesc.push('2nd');
  if (runners[2]) runnerDesc.push('3rd');

  const runnersText = runnerDesc.length > 0 ? `Runners on ${runnerDesc.join(', ')}` : 'Bases empty';

  return `${half} ${inning} | ${outs} out(s) | ${runnersText} | Score: ${score[0]}-${score[1]}`;
}
