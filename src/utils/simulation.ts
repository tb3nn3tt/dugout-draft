import { Player, AtBatResult, StatBoost, ScoutingGrades, CoachEffect } from '../types';

export interface SimulationModifiers {
  momentum?: number;       // 0-100, batter's team momentum
  clutchBoost?: number;    // grade points to add (roughly -5 to +5)
  streakModifier?: number; // +3 for hot, -3 for cold, 0 for neutral
}

// Helper to get scouting grade or default to 50 (average)
function getGrade(grades: ScoutingGrades | undefined, key: keyof ScoutingGrades, fallback = 50): number {
  return grades?.[key] ?? fallback;
}

// Convert 20-80 grade to a multiplier (0.5 to 1.5 range)
// 50 = 1.0, 80 = 1.5, 20 = 0.5
function gradeToMultiplier(grade: number): number {
  return 0.5 + ((grade - 20) / 60);
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
  pitcherCoach?: CoachEffect | null
): AtBatResult {
  // Get scouting grades (use explicit grades or infer from stats)
  const batterGrades = batter.grades ?? inferGradesFromStats(batter);
  const pitcherGrades = pitcher.grades ?? inferGradesFromStats(pitcher);

  // Apply synergy boosts
  const offensiveMultiplier = statBoost?.offensiveBonus ?? 1.0;
  const pitchingMultiplier = statBoost?.pitchingBonus ?? 1.0;

  // Calculate momentum/clutch/streak modifiers
  const momentumBoost = modifiers?.momentum ? (modifiers.momentum / 100) * 5 : 0;
  const clutchBoost = modifiers?.clutchBoost ?? 0;
  const streakMod = modifiers?.streakModifier ?? 0;

  // Platoon advantage (handedness matchup)
  const platoonMod = getPlatoonModifier(batter, pitcher);

  // Coach bonuses (grade-point boosts applied directly)
  const coachClutch = batterCoach?.clutchBonus ?? 0;
  const coachSpeed = batterCoach?.speedBonus ?? 0;
  // Fielding bonus comes from the pitching team's coach (better defense)
  const coachFielding = pitcherCoach?.fieldingBonus ?? 0;

  const totalBoost = momentumBoost + clutchBoost + streakMod + platoonMod + coachClutch;

  // === BATTER GRADES (20-80 scale) ===
  const contact = (getGrade(batterGrades, 'contact') + totalBoost) * offensiveMultiplier;
  const power = (getGrade(batterGrades, 'power') + momentumBoost + clutchBoost + platoonMod) * offensiveMultiplier;
  const speed = getGrade(batterGrades, 'speed') + coachSpeed;
  const eye = (getGrade(batterGrades, 'eye') + momentumBoost + clutchBoost) * offensiveMultiplier;

  // === PITCHER GRADES (20-80 scale) ===
  const fastball = getGrade(pitcherGrades, 'fastball') * pitchingMultiplier;
  const breaking = getGrade(pitcherGrades, 'breaking') * pitchingMultiplier;
  const control = getGrade(pitcherGrades, 'control') * pitchingMultiplier;

  // === REALISTIC MLB PROBABILITY MODEL WITH SCOUTING GRADES ===
  // MLB averages per PA: ~22% strikeout, ~8.5% walk, ~70% balls in play
  // Of balls in play: ~30% become hits (BABIP)

  // Strikeout rate: Based on contact + eye vs pitcher control + breaking
  // Higher contact/eye = fewer Ks, higher pitcher grades = more Ks
  const batterKAvoid = gradeToMultiplier(contact * 0.6 + eye * 0.4);
  const pitcherKAbility = gradeToMultiplier(breaking * 0.5 + control * 0.3 + fastball * 0.2);
  const baseK = 0.22 * pitcherKAbility / batterKAvoid;
  const strikeoutChance = Math.max(0.08, Math.min(0.42, baseK));

  // Walk rate: Based on eye vs pitcher control
  // Higher eye = more walks, higher control = fewer walks
  const batterWalkAbility = gradeToMultiplier(eye);
  const pitcherWalkAvoid = gradeToMultiplier(control);
  const baseWalk = 0.085 * batterWalkAbility / pitcherWalkAvoid;
  const walkChance = Math.max(0.03, Math.min(0.20, baseWalk));

  // BABIP: Based on contact + speed
  // Higher contact = more hits on contact, higher speed = more infield hits
  const contactMod = gradeToMultiplier(contact);
  const speedMod = gradeToMultiplier(speed);
  const baseBabip = 0.300 * (contactMod * 0.7 + speedMod * 0.3);
  const babip = Math.min(0.380, Math.max(0.240, baseBabip));

  // Pitcher effectiveness reduces BABIP (coaching fielding bonus also reduces BABIP)
  const pitcherEffectiveness = gradeToMultiplier((fastball + breaking + control) / 3);
  const fieldingReduction = 1 + (coachFielding * 0.005); // 5 fielding pts → ~2.5% BABIP reduction
  const effectiveBabip = babip / (pitcherEffectiveness * fieldingReduction);

  // === OUTCOME DETERMINATION ===
  const roll = Math.random();
  let cumulative = 0;

  // Strikeout
  cumulative += strikeoutChance;
  if (roll < cumulative) return 'strikeout';

  // Walk
  cumulative += walkChance;
  if (roll < cumulative) return 'walk';

  // Now we're in "ball in play" territory
  const hitRoll = Math.random();

  if (hitRoll < effectiveBabip) {
    // It's a hit! Determine type based on power
    const powerMod = gradeToMultiplier(power);
    const typeRoll = Math.random();

    // Home run: Based on power grade
    // 80 power = ~12% HR rate, 50 power = ~4%, 20 power = ~1%
    const hrRate = Math.min(0.15, Math.max(0.01, 0.04 * powerMod));
    if (typeRoll < hrRate) return 'homerun';

    // Triple: Based on speed grade
    const tripleRate = Math.min(0.05, Math.max(0.005, 0.02 * gradeToMultiplier(speed)));
    if (typeRoll < hrRate + tripleRate) return 'triple';

    // Double: Based on power + speed
    const doubleRate = Math.min(0.30, Math.max(0.12, 0.18 * (powerMod * 0.7 + speedMod * 0.3)));
    if (typeRoll < hrRate + tripleRate + doubleRate) return 'double';

    // Single: remainder
    return 'single';
  }

  // Out on contact - determine type
  const outRoll = Math.random();

  // Double play: More likely for slow runners
  const dpChance = Math.max(0.02, Math.min(0.12, 0.10 * (1 - (speed - 20) / 80)));
  if (outRoll < dpChance) return 'double_play';

  // Ground out: ~45% of outs
  if (outRoll < 0.45) return 'groundout';

  // Fly out: ~40% of outs
  if (outRoll < 0.85) return 'flyout';

  // Line out: ~15% of outs
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
        if (Math.random() < scoreProb) {
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
          if (Math.random() < dpScoreProb) {
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
