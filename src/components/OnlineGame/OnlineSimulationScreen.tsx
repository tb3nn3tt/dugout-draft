import { useState, useEffect, useCallback, useRef } from 'react';
import { OnlineGameProvider, useOnlineGame } from '../../contexts/OnlineGameContext';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../shared/Button';
import {
  Player, AtBatResult, PlayLogEntry, GameBoxScore, BatterBoxScore,
  PitcherBoxScore, TeamBoxScore, InningScore,
} from '../../types';
import { buildAllPlayersMap, hydratePlayerIds } from '../../utils/draftLogic';
import { calculateEloChange } from '../../utils/eloCalculation';
import { simulateAtBat, advanceRunners, shouldSubstitutePitcher, selectEmergencyPitcher, findPinchHitter, findPinchRunner } from '../../utils/simulation';
import { OnlineGameReplay } from './OnlineGameReplay';
import { SeriesCelebration } from '../Game/SeriesCelebration';

interface OnlineSimulationScreenProps {
  matchId: string;
  onComplete: () => void;
}

const allPlayersMap = buildAllPlayersMap();

// ── Types ──────────────────────────────────────────────────────────────────

interface PitchingStaff {
  starter: Player;
  bullpen: Player[];
  closer: Player | null;
}

interface PitcherState {
  current: Player;
  pitchCount: number;
  usedIds: string[];
  closerUsed: boolean;
  outsRecorded: number;
}

interface FullGameData {
  score: [number, number];
  winner: 'player1' | 'player2';
  plays: PlayLogEntry[];
  boxScore: GameBoxScore;
  lineScore: number[][];
  isWalkoff: boolean;
  innings: InningScore[];
}

// Tracks pitcher usage across a series for fatigue
interface SeriesPitcherLog {
  // playerId -> { lastGamePitched: gameNumber, pitchesThrown: total, gamesAppeared: count }
  [playerId: string]: { lastGamePitched: number; pitchesThrown: number; gamesAppeared: number };
}

// ── Pitcher Management ─────────────────────────────────────────────────────

function getNextPitcher(
  state: PitcherState,
  staff: PitchingStaff,
  inning: number,
  teamScore: number,
  opponentScore: number,
  nextBatterBats?: string,
): PitcherState {
  if (!shouldSubstitutePitcher(state.current, state.pitchCount, inning, 0)) {
    return state;
  }

  const scoreDiff = teamScore - opponentScore;
  const available = staff.bullpen.filter(p => !state.usedIds.includes(p.id) && p.id !== state.current.id);

  // 9th+ with lead: bring in closer
  if (staff.closer && !state.closerUsed && inning >= 9 && scoreDiff > 0) {
    return {
      current: staff.closer,
      pitchCount: 0,
      usedIds: [...state.usedIds, staff.closer.id],
      closerUsed: true,
      outsRecorded: 0,
    };
  }

  if (available.length === 0) {
    // Emergency fallback: re-enter best available reliever
    const emergency = selectEmergencyPitcher(staff.bullpen, staff.closer, state.current.id);
    if (!emergency) return state;
    return { current: emergency, pitchCount: 0, usedIds: [...state.usedIds, emergency.id], closerUsed: state.closerUsed, outsRecorded: 0 };
  }

  // 7th-8th with lead: prefer SU
  if (inning >= 7 && scoreDiff > 0) {
    const su = available.find(p => p.positions.includes('SU'));
    if (su) {
      return { current: su, pitchCount: 0, usedIds: [...state.usedIds, su.id], closerUsed: state.closerUsed, outsRecorded: 0 };
    }
  }

  // Early relief: prefer LRP
  if (inning < 7) {
    const lrp = available.find(p => p.positions.includes('LRP'));
    if (lrp) {
      return { current: lrp, pitchCount: 0, usedIds: [...state.usedIds, lrp.id], closerUsed: state.closerUsed, outsRecorded: 0 };
    }
  }

  // LOOGY: left-handed batter → prefer LOOGY specialist
  if (nextBatterBats === 'L') {
    const loogy = available.find(p => p.positions.includes('LOOGY'));
    if (loogy) {
      return { current: loogy, pitchCount: 0, usedIds: [...state.usedIds, loogy.id], closerUsed: state.closerUsed, outsRecorded: 0 };
    }
  }

  // Mid-game: prefer MRP
  const mrp = available.find(p => p.positions.includes('MRP'));
  if (mrp) {
    return { current: mrp, pitchCount: 0, usedIds: [...state.usedIds, mrp.id], closerUsed: state.closerUsed, outsRecorded: 0 };
  }

  // Default: highest overall available
  const best = [...available].sort((a, b) => b.overall - a.overall)[0];
  return { current: best, pitchCount: 0, usedIds: [...state.usedIds, best.id], closerUsed: state.closerUsed, outsRecorded: 0 };
}

/**
 * Build a PitchingStaff for a game, respecting series fatigue.
 * Starters rotate. Relievers who pitched the previous game are deprioritized
 * (moved to the end of the bullpen) unless it's an elimination game.
 */
function buildGameStaff(
  rotation: Player[],
  bullpen: Player[],
  closer: Player | null,
  gameNumber: number,
  seriesLog: SeriesPitcherLog,
  isEliminationGame: boolean,
): PitchingStaff {
  // Rotate starters
  const rotSize = Math.max(1, rotation.length);
  const starter = rotation[(gameNumber - 1) % rotSize] || rotation[0];

  if (isEliminationGame) {
    // Elimination: everyone available, no fatigue penalty
    return { starter, bullpen: [...bullpen], closer };
  }

  // Sort bullpen: those who pitched yesterday go to end
  const freshBullpen = [...bullpen].sort((a, b) => {
    const aLog = seriesLog[a.id];
    const bLog = seriesLog[b.id];
    const aFatigued = aLog && aLog.lastGamePitched === gameNumber - 1;
    const bFatigued = bLog && bLog.lastGamePitched === gameNumber - 1;
    if (aFatigued && !bFatigued) return 1; // a goes later
    if (!aFatigued && bFatigued) return -1;
    return 0;
  });

  // Closer: rest if pitched 2 consecutive games
  let availableCloser = closer;
  if (closer) {
    const cLog = seriesLog[closer.id];
    if (cLog && cLog.lastGamePitched === gameNumber - 1 && cLog.gamesAppeared >= 2) {
      // Closer unavailable, push to bullpen end as emergency option
      availableCloser = null;
      freshBullpen.push(closer);
    }
  }

  return { starter, bullpen: freshBullpen, closer: availableCloser };
}

/**
 * Update series pitcher log after a game.
 */
function updateSeriesPitcherLog(
  log: SeriesPitcherLog,
  pitcherBoxes: PitcherBoxScore[],
  gameNumber: number,
): void {
  for (const pb of pitcherBoxes) {
    const existing = log[pb.playerId];
    if (existing) {
      existing.lastGamePitched = gameNumber;
      existing.pitchesThrown += pb.pitches;
      existing.gamesAppeared += 1;
    } else {
      log[pb.playerId] = {
        lastGamePitched: gameNumber,
        pitchesThrown: pb.pitches,
        gamesAppeared: 1,
      };
    }
  }
}

// ── Play-by-play helpers ───────────────────────────────────────────────────

function mapResultToLogType(result: AtBatResult): PlayLogEntry['type'] {
  switch (result) {
    case 'homerun': return 'homerun';
    case 'triple': return 'triple';
    case 'double': return 'double';
    case 'single': return 'single';
    case 'walk': return 'walk';
    case 'strikeout': return 'strikeout';
    case 'groundout': case 'flyout': case 'lineout': case 'double_play':
      return 'out';
    default: return 'normal';
  }
}

let playIdCounter = 0;
function nextPlayId(): string {
  return `p${++playIdCounter}`;
}

function createPlayEntry(
  result: AtBatResult,
  batter: Player,
  description: string,
  inning: number,
  half: 'top' | 'bottom',
  runsScored: number,
): PlayLogEntry {
  return {
    id: nextPlayId(),
    description: `${batter.name} — ${description}`,
    type: mapResultToLogType(result),
    batterId: batter.id,
    batterName: batter.name,
    inning,
    half,
    timestamp: Date.now(),
    runsScored: runsScored > 0 ? runsScored : undefined,
  };
}

function createInningMarker(inning: number, half: 'top' | 'bottom'): PlayLogEntry {
  const label = half === 'top' ? `Top of Inning ${inning}` : `Bottom of Inning ${inning}`;
  return {
    id: nextPlayId(),
    description: label,
    type: 'inning',
    batterId: '',
    batterName: '',
    inning,
    half,
    timestamp: Date.now(),
  };
}

// ── Box Score helpers ──────────────────────────────────────────────────────

function initBatterBox(player: Player, position: string): BatterBoxScore {
  return {
    playerId: player.id,
    name: player.name,
    position,
    ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0, doubles: 0, triples: 0,
  };
}

function initPitcherBox(player: Player): PitcherBoxScore {
  return {
    playerId: player.id,
    name: player.name,
    ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0,
  };
}

function isHit(result: AtBatResult): boolean {
  return result === 'single' || result === 'double' || result === 'triple' || result === 'homerun';
}

function isAtBat(result: AtBatResult): boolean {
  return result !== 'walk'; // walks don't count as ABs
}

function updateBatterStats(box: BatterBoxScore, result: AtBatResult, runsScored: number): void {
  if (isAtBat(result)) box.ab++;
  if (isHit(result)) box.h++;
  if (result === 'homerun') { box.hr++; box.r++; } // batter scores on HR
  if (result === 'double') box.doubles = (box.doubles || 0) + 1;
  if (result === 'triple') box.triples = (box.triples || 0) + 1;
  if (result === 'walk') box.bb++;
  if (result === 'strikeout') box.so++;
  box.rbi += runsScored;
}

function updatePitcherStats(box: PitcherBoxScore, result: AtBatResult, runsScored: number, _outsAdded: number): void {
  box.pitches += Math.floor(Math.random() * 3) + 3; // 3-5 pitches per AB
  if (isHit(result)) box.h++;
  if (result === 'walk') box.bb++;
  if (result === 'strikeout') box.so++;
  box.r += runsScored;
  box.er += runsScored; // simplified: all runs are earned
  // IP tracked via outsAdded at the end
}

function finalizePitcherIP(box: PitcherBoxScore, outsRecorded: number): void {
  const fullInnings = Math.floor(outsRecorded / 3);
  const partialOuts = outsRecorded % 3;
  box.ip = fullInnings + partialOuts * 0.1;
}

function calculateTotals(batters: BatterBoxScore[]): TeamBoxScore['totals'] {
  return batters.reduce(
    (acc, b) => ({
      ab: acc.ab + b.ab,
      r: acc.r + b.r,
      h: acc.h + b.h,
      rbi: acc.rbi + b.rbi,
      bb: acc.bb + b.bb,
      so: acc.so + b.so,
    }),
    { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
  );
}

function assignDecisions(
  awayPitchers: PitcherBoxScore[],
  homePitchers: PitcherBoxScore[],
  awayScore: number,
  homeScore: number,
): void {
  if (awayScore > homeScore) {
    // Away wins
    if (awayPitchers.length > 0) awayPitchers[0].decision = 'W';
    if (homePitchers.length > 0) homePitchers[0].decision = 'L';
    // Save: last pitcher on winning team if different from starter and team had lead
    if (awayPitchers.length > 1) {
      const lastPitcher = awayPitchers[awayPitchers.length - 1];
      if (lastPitcher.ip > 0) lastPitcher.decision = 'S';
    }
  } else {
    // Home wins
    if (homePitchers.length > 0) homePitchers[0].decision = 'W';
    if (awayPitchers.length > 0) awayPitchers[0].decision = 'L';
    if (homePitchers.length > 1) {
      const lastPitcher = homePitchers[homePitchers.length - 1];
      if (lastPitcher.ip > 0) lastPitcher.decision = 'S';
    }
  }
}

// ── Full Game Simulation with Play-by-Play ─────────────────────────────────

function simulateFullGame(
  awayLineup: Player[],
  homeLineup: Player[],
  awayStaff: PitchingStaff,
  homeStaff: PitchingStaff,
  awayTeamKey: 'player1' | 'player2',
  homeTeamKey: 'player1' | 'player2',
  awayBench?: Player[],
  homeBench?: Player[],
): FullGameData {
  playIdCounter = 0;

  let awayScore = 0;
  let homeScore = 0;
  let awayBatterIdx = 0;
  let homeBatterIdx = 0;

  const plays: PlayLogEntry[] = [];
  const inningScores: InningScore[] = [];
  const lineScore: number[][] = [[], []]; // [away, home]
  let isWalkoff = false;

  // Track used bench players per team
  const awayUsedBench = new Set<string>();
  const homeUsedBench = new Set<string>();

  // Initialize batter box scores
  const awayBatters = new Map<string, BatterBoxScore>();
  const homeBatters = new Map<string, BatterBoxScore>();
  awayLineup.forEach((p, i) => awayBatters.set(p.id, initBatterBox(p, p.positions[0] || `${i + 1}`)));
  homeLineup.forEach((p, i) => homeBatters.set(p.id, initBatterBox(p, p.positions[0] || `${i + 1}`)));

  // Initialize pitcher tracking
  const awayPitcherBoxes: PitcherBoxScore[] = [initPitcherBox(awayStaff.starter)];
  const homePitcherBoxes: PitcherBoxScore[] = [initPitcherBox(homeStaff.starter)];

  let homePitcherState: PitcherState = {
    current: homeStaff.starter, pitchCount: 0, usedIds: [], closerUsed: false, outsRecorded: 0,
  };
  let awayPitcherState: PitcherState = {
    current: awayStaff.starter, pitchCount: 0, usedIds: [], closerUsed: false, outsRecorded: 0,
  };

  // Helper to get/create the active pitcher's box score
  function getActivePitcherBox(boxes: PitcherBoxScore[], state: PitcherState): PitcherBoxScore {
    let box = boxes.find(b => b.playerId === state.current.id);
    if (!box) {
      box = initPitcherBox(state.current);
      boxes.push(box);
    }
    return box;
  }

  function checkPitchingChange(
    pitcherState: PitcherState,
    staff: PitchingStaff,
    boxes: PitcherBoxScore[],
    inning: number,
    teamScore: number,
    oppScore: number,
  ): PitcherState {
    const prevPitcher = pitcherState.current;
    const newState = getNextPitcher(pitcherState, staff, inning, teamScore, oppScore);
    if (newState.current.id !== prevPitcher.id) {
      // Finalize the old pitcher's IP
      const oldBox = boxes.find(b => b.playerId === prevPitcher.id);
      if (oldBox) finalizePitcherIP(oldBox, pitcherState.outsRecorded);

      // Add pitching change play log entry
      plays.push({
        id: nextPlayId(),
        description: `Pitching change: ${newState.current.name} replaces ${prevPitcher.name}`,
        type: 'normal',
        batterId: newState.current.id,
        batterName: newState.current.name,
        inning,
        half: 'top', // will be corrected by caller
        timestamp: Date.now(),
      });
    }
    return newState;
  }

  const simulateHalfInning = (
    lineup: Player[],
    batterIdx: number,
    batterBoxes: Map<string, BatterBoxScore>,
    pitcherState: PitcherState,
    pitcherBoxes: PitcherBoxScore[],
    pitchingStaff: PitchingStaff,
    inning: number,
    half: 'top' | 'bottom',
    isWalkoffEligible: boolean,
    battingTeamScore: number,
    pitchingTeamScore: number,
    benchPlayers?: Player[],
    usedBenchIds?: Set<string>,
  ): { newBatterIdx: number; runsThisHalf: number; newPitcherState: PitcherState; walkoff: boolean } => {
    let outs = 0;
    let runners: [boolean, boolean, boolean] = [false, false, false];
    let runsThisHalf = 0;
    let newBatterIdx = batterIdx;
    let walkoff = false;
    const bench = benchPlayers ?? [];
    const usedBench = usedBenchIds ?? new Set<string>();

    while (outs < 3) {
      let batter = lineup[newBatterIdx % lineup.length];
      newBatterIdx++;

      // Pinch hitter check
      if (bench.length > 0) {
        const scoreDiff = battingTeamScore + runsThisHalf - pitchingTeamScore;
        const ph = findPinchHitter(bench, batter, pitcherState.current.throws, inning, scoreDiff, usedBench);
        if (ph) {
          usedBench.add(ph.id);
          let phBox = batterBoxes.get(ph.id);
          if (!phBox) {
            phBox = initBatterBox(ph, 'PH');
            batterBoxes.set(ph.id, phBox);
          }
          plays.push({
            id: nextPlayId(),
            description: `Pinch hitter: ${ph.name} batting for ${batter.name}`,
            type: 'normal', batterId: ph.id, batterName: ph.name, inning, half, timestamp: Date.now(),
          });
          batter = ph;
        }
      }

      const result = simulateAtBat(batter, pitcherState.current, undefined, undefined);
      const advance = advanceRunners(result, runners, batter, outs);

      // Update batter box score
      let bBox = batterBoxes.get(batter.id);
      if (!bBox) {
        bBox = initBatterBox(batter, batter.positions[0] || 'DH');
        batterBoxes.set(batter.id, bBox);
      }
      updateBatterStats(bBox, result, advance.runsScored);

      // Track runs scored by runners (update their 'r' stat)
      if (advance.runsScored > 0 && result === 'homerun') {
        const runnersOnBase = runners.filter(Boolean).length;
        for (let ri = 0; ri < runnersOnBase; ri++) {
          const runnerBatter = lineup[(newBatterIdx - ri - 2 + lineup.length * 10) % lineup.length];
          const rBox = batterBoxes.get(runnerBatter.id);
          if (rBox) rBox.r++;
        }
      } else if (advance.runsScored > 0) {
        for (let ri = 0; ri < advance.runsScored; ri++) {
          const runnerBatter = lineup[(newBatterIdx - ri - 2 + lineup.length * 10) % lineup.length];
          const rBox = batterBoxes.get(runnerBatter.id);
          if (rBox) rBox.r++;
        }
      }

      // Update pitcher box score
      const pBox = getActivePitcherBox(pitcherBoxes, pitcherState);
      const outsAdded = advance.newOuts - outs;
      updatePitcherStats(pBox, result, advance.runsScored, outsAdded);
      pitcherState.pitchCount += Math.floor(Math.random() * 3) + 3;
      pitcherState.outsRecorded += outsAdded;

      runsThisHalf += advance.runsScored;
      runners = advance.newRunners;
      outs = advance.newOuts;

      // Create play log entry
      plays.push(createPlayEntry(result, batter, advance.description, inning, half, advance.runsScored));

      // Pinch runner check (8th+ inning, slow runner reaches base)
      if (bench.length > 0 && (result === 'walk' || result === 'single') && runners[0] && inning >= 8) {
        const pr = findPinchRunner(bench, batter, inning, usedBench);
        if (pr) {
          usedBench.add(pr.id);
          plays.push({
            id: nextPlayId(),
            description: `Pinch runner: ${pr.name} running for ${batter.name}`,
            type: 'normal', batterId: pr.id, batterName: pr.name, inning, half, timestamp: Date.now(),
          });
        }
      }

      // Mid-inning pitcher substitution with role-based selection
      if (outs < 3 && shouldSubstitutePitcher(pitcherState.current, pitcherState.pitchCount, inning, outs)) {
        const nextBatter = lineup[newBatterIdx % lineup.length];
        const prevPitcher = pitcherState.current;
        const newState = getNextPitcher(
          pitcherState, pitchingStaff, inning,
          pitchingTeamScore, battingTeamScore + runsThisHalf,
          nextBatter?.bats,
        );
        if (newState.current.id !== prevPitcher.id) {
          // Finalize old pitcher's IP
          const oldBox = pitcherBoxes.find(b => b.playerId === prevPitcher.id);
          if (oldBox) finalizePitcherIP(oldBox, pitcherState.outsRecorded);

          plays.push({
            id: nextPlayId(),
            description: `Pitching change: ${newState.current.name} replaces ${prevPitcher.name}`,
            type: 'normal',
            batterId: newState.current.id,
            batterName: newState.current.name,
            inning, half,
            timestamp: Date.now(),
          });

          // Ensure new pitcher has a box score entry
          if (!pitcherBoxes.find(b => b.playerId === newState.current.id)) {
            pitcherBoxes.push(initPitcherBox(newState.current));
          }

          pitcherState.current = newState.current;
          pitcherState.pitchCount = 0;
          pitcherState.usedIds = newState.usedIds;
          pitcherState.closerUsed = newState.closerUsed;
          pitcherState.outsRecorded = 0;
        }
      }

      // Walk-off check
      if (isWalkoffEligible && battingTeamScore + runsThisHalf > pitchingTeamScore) {
        walkoff = true;
        break;
      }
    }

    return { newBatterIdx, runsThisHalf, newPitcherState: pitcherState, walkoff };
  };

  // Main game loop
  for (let inning = 1; inning <= 9; inning++) {
    // Pitching changes between innings
    if (inning > 1) {
      homePitcherState = checkPitchingChange(
        homePitcherState, homeStaff, homePitcherBoxes, inning, homeScore, awayScore,
      );
      awayPitcherState = checkPitchingChange(
        awayPitcherState, awayStaff, awayPitcherBoxes, inning, awayScore, homeScore,
      );
    }

    // Top of inning
    plays.push(createInningMarker(inning, 'top'));
    const topResult = simulateHalfInning(
      awayLineup, awayBatterIdx, awayBatters,
      homePitcherState, homePitcherBoxes, homeStaff,
      inning, 'top', false, awayScore, homeScore,
      awayBench, awayUsedBench,
    );
    awayBatterIdx = topResult.newBatterIdx;
    awayScore += topResult.runsThisHalf;
    homePitcherState = topResult.newPitcherState;
    lineScore[0].push(topResult.runsThisHalf);

    // Bottom of inning — skip if home ahead in 9th
    if (inning === 9 && homeScore > awayScore) {
      lineScore[1].push(0); // X (didn't bat)
      inningScores.push({ away: topResult.runsThisHalf, home: 0 });
      break;
    }

    // Closer check for bottom half
    if (inning >= 9) {
      awayPitcherState = checkPitchingChange(
        awayPitcherState, awayStaff, awayPitcherBoxes, inning, awayScore, homeScore,
      );
    }

    plays.push(createInningMarker(inning, 'bottom'));
    const botResult = simulateHalfInning(
      homeLineup, homeBatterIdx, homeBatters,
      awayPitcherState, awayPitcherBoxes, awayStaff,
      inning, 'bottom', inning >= 9, homeScore, awayScore,
      homeBench, homeUsedBench,
    );
    homeBatterIdx = botResult.newBatterIdx;
    homeScore += botResult.runsThisHalf;
    awayPitcherState = botResult.newPitcherState;
    lineScore[1].push(botResult.runsThisHalf);

    inningScores.push({ away: topResult.runsThisHalf, home: botResult.runsThisHalf });

    if (botResult.walkoff) {
      isWalkoff = true;
      break;
    }

    // If tied after 9, continue to extras
    if (inning === 9 && awayScore === homeScore) {
      // Continue loop below
    } else if (inning === 9) {
      break;
    }
  }

  // Extra innings
  let extraInning = 10;
  while (awayScore === homeScore && extraInning <= 15) {
    homePitcherState = checkPitchingChange(
      homePitcherState, homeStaff, homePitcherBoxes, extraInning, homeScore, awayScore,
    );
    awayPitcherState = checkPitchingChange(
      awayPitcherState, awayStaff, awayPitcherBoxes, extraInning, awayScore, homeScore,
    );

    plays.push(createInningMarker(extraInning, 'top'));
    const topResult = simulateHalfInning(
      awayLineup, awayBatterIdx, awayBatters,
      homePitcherState, homePitcherBoxes, homeStaff,
      extraInning, 'top', false, awayScore, homeScore,
      awayBench, awayUsedBench,
    );
    awayBatterIdx = topResult.newBatterIdx;
    awayScore += topResult.runsThisHalf;
    homePitcherState = topResult.newPitcherState;
    lineScore[0].push(topResult.runsThisHalf);

    plays.push(createInningMarker(extraInning, 'bottom'));
    const botResult = simulateHalfInning(
      homeLineup, homeBatterIdx, homeBatters,
      awayPitcherState, awayPitcherBoxes, awayStaff,
      extraInning, 'bottom', true, homeScore, awayScore,
      homeBench, homeUsedBench,
    );
    homeBatterIdx = botResult.newBatterIdx;
    homeScore += botResult.runsThisHalf;
    awayPitcherState = botResult.newPitcherState;
    lineScore[1].push(botResult.runsThisHalf);

    inningScores.push({ away: topResult.runsThisHalf, home: botResult.runsThisHalf });

    if (botResult.walkoff) {
      isWalkoff = true;
      break;
    }

    extraInning++;
  }

  // Force winner if still tied
  if (awayScore === homeScore) homeScore++;

  // Finalize remaining pitcher IP
  for (const boxes of [awayPitcherBoxes, homePitcherBoxes]) {
    for (const box of boxes) {
      if (box.ip === 0) {
        // Find the pitcher state to get outsRecorded
        // The last pitcher in each staff needs IP finalized
      }
    }
  }
  // Finalize active pitchers
  const awayActiveBox = awayPitcherBoxes.find(b => b.playerId === awayPitcherState.current.id);
  if (awayActiveBox && awayActiveBox.ip === 0) finalizePitcherIP(awayActiveBox, awayPitcherState.outsRecorded);
  const homeActiveBox = homePitcherBoxes.find(b => b.playerId === homePitcherState.current.id);
  if (homeActiveBox && homeActiveBox.ip === 0) finalizePitcherIP(homeActiveBox, homePitcherState.outsRecorded);

  // Assign W/L/S decisions
  assignDecisions(awayPitcherBoxes, homePitcherBoxes, awayScore, homeScore);

  // Build totals
  const awayBatterArr = Array.from(awayBatters.values());
  const homeBatterArr = Array.from(homeBatters.values());

  // Set runs from score (totals.r should match actual score)
  const awayTotals = calculateTotals(awayBatterArr);
  awayTotals.r = awayScore;
  const homeTotals = calculateTotals(homeBatterArr);
  homeTotals.r = homeScore;

  const boxScore: GameBoxScore = {
    away: { batters: awayBatterArr, pitchers: awayPitcherBoxes, totals: awayTotals },
    home: { batters: homeBatterArr, pitchers: homePitcherBoxes, totals: homeTotals },
    lineScore,
  };

  return {
    score: [awayScore, homeScore],
    winner: homeScore > awayScore ? homeTeamKey : awayTeamKey,
    plays,
    boxScore,
    lineScore,
    isWalkoff,
    innings: inningScores,
  };
}

// ── Team Setup ─────────────────────────────────────────────────────────────

function buildTeamFromSetup(
  setup: Record<string, unknown>,
  rosterIds?: string[],
): { lineup: Player[]; rotation: Player[]; closer: Player | null; bullpen: Player[]; bench: Player[] } {
  const battingOrderIds = (setup.battingOrder as string[]) || [];
  const rotationIds = (setup.rotation as string[]) || [];
  const closerId = setup.closer as string | null;
  const bullpenIds = (setup.bullpen as string[]) || [];

  const lineup = hydratePlayerIds(battingOrderIds);
  const rotation = hydratePlayerIds(rotationIds);
  const closer = closerId ? (allPlayersMap.get(closerId) || null) : null;
  const bullpen = hydratePlayerIds(bullpenIds);

  // Compute bench: roster players not in lineup or pitching staff
  const usedIds = new Set([
    ...battingOrderIds,
    ...rotationIds,
    ...(closerId ? [closerId] : []),
    ...bullpenIds,
  ]);
  const bench = rosterIds
    ? hydratePlayerIds(rosterIds.filter(id => !usedIds.has(id)))
    : [];

  return { lineup, rotation, closer, bullpen, bench };
}

// ── Main Component ─────────────────────────────────────────────────────────

function OnlineSimulationInner({ onComplete }: { onComplete: () => void }) {
  const { match, phaseData, myRole, updatePhaseData } = useOnlineGame();
  const { user, profile } = useAuth();
  const [simMode, setSimMode] = useState<'watch' | 'quick' | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const simStartedRef = useRef(false);

  // Watch mode state
  const [watchGameData, setWatchGameData] = useState<FullGameData | null>(null);
  const [watchGameMeta, setWatchGameMeta] = useState<{
    gameNumber: number;
    awayTeam: 'player1' | 'player2';
    homeTeam: 'player1' | 'player2';
    awayName: string;
    homeName: string;
  } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ winner: string; seriesScore: string } | null>(null);
  const gameCompleteResolverRef = useRef<(() => void) | null>(null);

  const seriesScore = phaseData.seriesScore as { player1: number; player2: number } | undefined;
  const gameResults = (phaseData.gameResults as { score: [number, number]; winner: string }[]) || [];

  // Player 2: detect watch mode game data from Firestore
  useEffect(() => {
    if (myRole !== 'player2') return;

    const currentGameData = phaseData.currentGameData as FullGameData & {
      gameNumber: number;
      awayTeam: 'player1' | 'player2';
      homeTeam: 'player1' | 'player2';
    } | null;

    if (currentGameData && phaseData.watchMode) {
      setSimMode('watch');
      setWatchGameData({
        score: currentGameData.score,
        winner: currentGameData.winner,
        plays: currentGameData.plays,
        boxScore: currentGameData.boxScore,
        lineScore: currentGameData.lineScore,
        isWalkoff: currentGameData.isWalkoff,
        innings: currentGameData.innings || [],
      });
      setWatchGameMeta({
        gameNumber: currentGameData.gameNumber,
        awayTeam: currentGameData.awayTeam,
        homeTeam: currentGameData.homeTeam,
        awayName: currentGameData.awayTeam === 'player1' ? (match?.player1_username || 'Team 1') : (match?.player2_username || 'Team 2'),
        homeName: currentGameData.homeTeam === 'player1' ? (match?.player1_username || 'Team 1') : (match?.player2_username || 'Team 2'),
      });
    }
  }, [myRole, phaseData.currentGameData, phaseData.watchMode, match]);

  // ── Quick Sim (existing behavior) ──────────────────────────────────────

  const runQuickSeries = useCallback(async () => {
    if (!db || !match || !user || !profile || myRole !== 'player1') return;
    if (simStartedRef.current) return;
    simStartedRef.current = true;

    const firestore = db;
    setIsSimulating(true);

    const p1Setup = phaseData.player1Setup as Record<string, unknown>;
    const p2Setup = phaseData.player2Setup as Record<string, unknown>;
    if (!p1Setup || !p2Setup) return;

    const p1RosterIds = (phaseData.player1Roster as string[]) || [];
    const p2RosterIds = (phaseData.player2Roster as string[]) || [];
    const team1 = buildTeamFromSetup(p1Setup, p1RosterIds);
    const team2 = buildTeamFromSetup(p2Setup, p2RosterIds);
    const homeTeam = Math.random() < 0.5 ? 'player1' : 'player2';

    let p1Wins = 0;
    let p2Wins = 0;
    const results: { score: [number, number]; winner: string }[] = [];

    const p1SeriesLog: SeriesPitcherLog = {};
    const p2SeriesLog: SeriesPitcherLog = {};

    for (let game = 1; game <= 7 && p1Wins < 4 && p2Wins < 4; game++) {
      const isHomeGame = [1, 2, 6, 7].includes(game);
      const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');

      const homeData = actualHome === 'player1' ? team1 : team2;
      const awayData = actualHome === 'player1' ? team2 : team1;
      const homeLog = actualHome === 'player1' ? p1SeriesLog : p2SeriesLog;
      const awayLog = actualHome === 'player1' ? p2SeriesLog : p1SeriesLog;

      const isElim = (p1Wins === 3 || p2Wins === 3);

      const homeStaff = buildGameStaff(homeData.rotation, homeData.bullpen, homeData.closer, game, homeLog, isElim);
      const awayStaff = buildGameStaff(awayData.rotation, awayData.bullpen, awayData.closer, game, awayLog, isElim);

      const gameData = simulateFullGame(
        awayData.lineup, homeData.lineup,
        awayStaff, homeStaff,
        actualHome === 'player1' ? 'player2' : 'player1',
        actualHome,
        awayData.bench, homeData.bench,
      );

      // Update pitcher logs
      updateSeriesPitcherLog(homeLog, gameData.boxScore.home.pitchers, game);
      updateSeriesPitcherLog(awayLog, gameData.boxScore.away.pitchers, game);

      if (gameData.winner === 'player1') p1Wins++;
      else p2Wins++;

      results.push({ score: gameData.score, winner: gameData.winner });

      const matchRef = doc(firestore, 'matches', match.id);
      await updateDoc(matchRef, {
        'phase_data.seriesScore': { player1: p1Wins, player2: p2Wins },
        'phase_data.gameResults': results,
      });
    }

    // Complete match
    const winnerId = p1Wins > p2Wins ? match.player1_id : match.player2_id;
    const winnerElo = p1Wins > p2Wins ? match.player1_elo_at_start : match.player2_elo_at_start;
    const loserElo = p1Wins > p2Wins ? match.player2_elo_at_start : match.player1_elo_at_start;
    const eloChange = calculateEloChange(winnerElo, loserElo, profile.games_played);

    const matchRef = doc(firestore, 'matches', match.id);
    await updateDoc(matchRef, {
      status: 'completed',
      winner_id: winnerId,
      completed_at: serverTimestamp(),
      'phase_data.eloChange': eloChange,
      'phase_data.seriesScore': { player1: p1Wins, player2: p2Wins },
      'phase_data.gameResults': results,
    });

    const isP1Winner = winnerId === match.player1_id;
    const myNewElo = isP1Winner
      ? match.player1_elo_at_start + eloChange
      : Math.max(100, match.player1_elo_at_start - eloChange);

    await updateDoc(doc(firestore, 'profiles', user.uid), {
      elo_rating: myNewElo,
      games_played: profile.games_played + 1,
      wins: profile.wins + (isP1Winner ? 1 : 0),
      losses: profile.losses + (isP1Winner ? 0 : 1),
      peak_elo: isP1Winner ? Math.max(profile.peak_elo, myNewElo) : profile.peak_elo,
    });

    await addDoc(collection(firestore, 'match_history'), {
      match_id: match.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      player1_username: match.player1_username,
      player2_username: match.player2_username,
      winner_id: winnerId,
      player1_elo_before: match.player1_elo_at_start,
      player2_elo_before: match.player2_elo_at_start,
      elo_change: eloChange,
      series_score: `${p1Wins}-${p2Wins}`,
      completed_at: serverTimestamp(),
    });

    setIsSimulating(false);
  }, [match, user, profile, myRole, phaseData]);

  // ── Watch Mode Series ──────────────────────────────────────────────────

  const runWatchSeries = useCallback(async () => {
    if (!db || !match || !user || !profile || myRole !== 'player1') return;
    if (simStartedRef.current) return;
    simStartedRef.current = true;

    const firestore = db;
    setIsSimulating(true);

    const p1Setup = phaseData.player1Setup as Record<string, unknown>;
    const p2Setup = phaseData.player2Setup as Record<string, unknown>;
    if (!p1Setup || !p2Setup) return;

    const team1 = buildTeamFromSetup(p1Setup);
    const team2 = buildTeamFromSetup(p2Setup);
    const homeTeam = (Math.random() < 0.5 ? 'player1' : 'player2') as 'player1' | 'player2';

    let p1Wins = 0;
    let p2Wins = 0;

    const p1SeriesLog: SeriesPitcherLog = {};
    const p2SeriesLog: SeriesPitcherLog = {};

    const matchRef = doc(firestore, 'matches', match.id);

    // Signal watch mode to Player 2
    await updateDoc(matchRef, {
      'phase_data.watchMode': true,
      'phase_data.homeTeam': homeTeam,
      'phase_data.seriesScore': { player1: 0, player2: 0 },
    });

    for (let game = 1; game <= 7 && p1Wins < 4 && p2Wins < 4; game++) {
      const isHomeGame = [1, 2, 6, 7].includes(game);
      const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');
      const actualAway = actualHome === 'player1' ? 'player2' : 'player1';

      const homeData = actualHome === 'player1' ? team1 : team2;
      const awayData = actualHome === 'player1' ? team2 : team1;
      const homeLog = actualHome === 'player1' ? p1SeriesLog : p2SeriesLog;
      const awayLog = actualHome === 'player1' ? p2SeriesLog : p1SeriesLog;

      const isElim = (p1Wins === 3 || p2Wins === 3);

      const homeStaff = buildGameStaff(homeData.rotation, homeData.bullpen, homeData.closer, game, homeLog, isElim);
      const awayStaff = buildGameStaff(awayData.rotation, awayData.bullpen, awayData.closer, game, awayLog, isElim);

      // Simulate full game
      const gameData = simulateFullGame(
        awayData.lineup, homeData.lineup,
        awayStaff, homeStaff,
        actualAway, actualHome,
        awayData.bench, homeData.bench,
      );

      // Update pitcher logs
      updateSeriesPitcherLog(homeLog, gameData.boxScore.home.pitchers, game);
      updateSeriesPitcherLog(awayLog, gameData.boxScore.away.pitchers, game);

      if (gameData.winner === 'player1') p1Wins++;
      else p2Wins++;

      const awayName = actualAway === 'player1' ? (match.player1_username || 'Team 1') : (match.player2_username || 'Team 2');
      const homeName = actualHome === 'player1' ? (match.player1_username || 'Team 1') : (match.player2_username || 'Team 2');

      // Write game data to Firestore for Player 2
      await updateDoc(matchRef, {
        'phase_data.currentGameNumber': game,
        'phase_data.currentGameData': {
          gameNumber: game,
          awayTeam: actualAway,
          homeTeam: actualHome,
          plays: gameData.plays,
          boxScore: gameData.boxScore,
          lineScore: gameData.lineScore,
          score: gameData.score,
          winner: gameData.winner,
          isWalkoff: gameData.isWalkoff,
          innings: gameData.innings,
        },
        'phase_data.seriesScore': { player1: p1Wins, player2: p2Wins },
      });

      // Set local state for Player 1's replay
      setWatchGameData(gameData);
      setWatchGameMeta({
        gameNumber: game,
        awayTeam: actualAway,
        homeTeam: actualHome,
        awayName,
        homeName,
      });

      // Wait for replay to finish
      await new Promise<void>((resolve) => {
        gameCompleteResolverRef.current = resolve;
      });

      // Clear game data before next game
      setWatchGameData(null);
      setWatchGameMeta(null);
    }

    // Series complete — show celebration
    const winnerId = p1Wins > p2Wins ? match.player1_id : match.player2_id;
    const winnerName = p1Wins > p2Wins
      ? (match.player1_username || 'Team 1')
      : (match.player2_username || 'Team 2');

    setCelebrationData({
      winner: winnerId === user.uid ? 'You' : winnerName,
      seriesScore: `${p1Wins} - ${p2Wins}`,
    });
    setShowCelebration(true);

    // Write completion
    const winnerElo = p1Wins > p2Wins ? match.player1_elo_at_start : match.player2_elo_at_start;
    const loserElo = p1Wins > p2Wins ? match.player2_elo_at_start : match.player1_elo_at_start;
    const eloChange = calculateEloChange(winnerElo, loserElo, profile.games_played);

    await updateDoc(matchRef, {
      status: 'completed',
      winner_id: winnerId,
      completed_at: serverTimestamp(),
      'phase_data.eloChange': eloChange,
      'phase_data.currentGameData': null,
    });

    const isP1Winner = winnerId === match.player1_id;
    const myNewElo = isP1Winner
      ? match.player1_elo_at_start + eloChange
      : Math.max(100, match.player1_elo_at_start - eloChange);

    await updateDoc(doc(firestore, 'profiles', user.uid), {
      elo_rating: myNewElo,
      games_played: profile.games_played + 1,
      wins: profile.wins + (isP1Winner ? 1 : 0),
      losses: profile.losses + (isP1Winner ? 0 : 1),
      peak_elo: isP1Winner ? Math.max(profile.peak_elo, myNewElo) : profile.peak_elo,
    });

    await addDoc(collection(firestore, 'match_history'), {
      match_id: match.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      player1_username: match.player1_username,
      player2_username: match.player2_username,
      winner_id: winnerId,
      player1_elo_before: match.player1_elo_at_start,
      player2_elo_before: match.player2_elo_at_start,
      elo_change: eloChange,
      series_score: `${p1Wins}-${p2Wins}`,
      completed_at: serverTimestamp(),
    });

    setIsSimulating(false);
  }, [match, user, profile, myRole, phaseData, updatePhaseData]);

  // Player 2 updates their own ELO when match completes
  useEffect(() => {
    if (match?.status !== 'completed' || myRole !== 'player2' || !user || !profile || !db) return;

    const eloChange = phaseData.eloChange as number;
    if (eloChange === undefined || eloChange === null) return;

    const firestore = db;
    const isWinner = match.winner_id === user.uid;
    const myNewElo = isWinner
      ? match.player2_elo_at_start + eloChange
      : Math.max(100, match.player2_elo_at_start - eloChange);

    updateDoc(doc(firestore, 'profiles', user.uid), {
      elo_rating: myNewElo,
      games_played: profile.games_played + 1,
      wins: profile.wins + (isWinner ? 1 : 0),
      losses: profile.losses + (isWinner ? 0 : 1),
      peak_elo: isWinner ? Math.max(profile.peak_elo, myNewElo) : profile.peak_elo,
    });

    // Show celebration for Player 2 too
    if (!showCelebration) {
      const winnerName = isWinner ? 'You' : (
        match.winner_id === match.player1_id ? match.player1_username : match.player2_username
      );
      const ss = phaseData.seriesScore as { player1: number; player2: number };
      if (ss) {
        setCelebrationData({
          winner: winnerName,
          seriesScore: `${ss.player1} - ${ss.player2}`,
        });
        setShowCelebration(true);
      }
    }
  }, [match?.status, myRole]);

  const handleSimulate = useCallback(async (mode: 'watch' | 'quick') => {
    setSimMode(mode);
    if (myRole === 'player1') {
      if (mode === 'watch') {
        await runWatchSeries();
      } else {
        await runQuickSeries();
      }
    }
  }, [myRole, runQuickSeries, runWatchSeries]);

  // Handle game replay complete
  const handleGameReplayComplete = useCallback(() => {
    if (gameCompleteResolverRef.current) {
      gameCompleteResolverRef.current();
      gameCompleteResolverRef.current = null;
    }
    // Player 2: just clear the game data
    if (myRole === 'player2') {
      setWatchGameData(null);
      setWatchGameMeta(null);
    }
  }, [myRole]);

  // Check for match completion (quick sim + non-watch fallback)
  useEffect(() => {
    if (match?.status === 'completed' && !showCelebration && simMode === 'quick') {
      const t = setTimeout(onComplete, 3000);
      return () => clearTimeout(t);
    }
  }, [match?.status, onComplete, showCelebration, simMode]);

  const isComplete = match?.status === 'completed';
  const winnerId = match?.winner_id;
  const isWinner = winnerId === user?.uid;

  // Build set of my player IDs for highlighting in play log
  const myPlayerIds = new Set<string>();
  if (myRole) {
    const setupKey = myRole === 'player1' ? 'player1Setup' : 'player2Setup';
    const setup = phaseData[setupKey] as Record<string, unknown> | undefined;
    if (setup) {
      const battingOrder = (setup.battingOrder as string[]) || [];
      const rotation = (setup.rotation as string[]) || [];
      const bullpen = (setup.bullpen as string[]) || [];
      const closer = setup.closer as string | null;
      [...battingOrder, ...rotation, ...bullpen].forEach(id => myPlayerIds.add(id));
      if (closer) myPlayerIds.add(closer);
    }
  }

  // ── Render: Watch Mode Replay ────────────────────────────────────────

  if (showCelebration && celebrationData) {
    return (
      <div className="online-simulation">
        <SeriesCelebration
          winner={celebrationData.winner}
          seriesScore={celebrationData.seriesScore}
          onContinue={onComplete}
        />
      </div>
    );
  }

  if (watchGameData && watchGameMeta) {
    return (
      <div className="online-simulation">
        {seriesScore && (
          <div className="series-score-display watch-mode">
            <div className={`score-side ${watchGameMeta.awayTeam === myRole ? 'my-side' : ''}`}>
              <span className="score-label">{watchGameMeta.awayName}</span>
              <span className="score-value">
                {watchGameMeta.awayTeam === 'player1' ? seriesScore.player1 : seriesScore.player2}
              </span>
            </div>
            <div className="score-divider">-</div>
            <div className={`score-side ${watchGameMeta.homeTeam === myRole ? 'my-side' : ''}`}>
              <span className="score-label">{watchGameMeta.homeName}</span>
              <span className="score-value">
                {watchGameMeta.homeTeam === 'player1' ? seriesScore.player1 : seriesScore.player2}
              </span>
            </div>
          </div>
        )}
        <OnlineGameReplay
          gameNumber={watchGameMeta.gameNumber}
          plays={watchGameData.plays}
          boxScore={watchGameData.boxScore}
          lineScore={watchGameData.lineScore}
          isWalkoff={watchGameData.isWalkoff}
          awayTeamName={watchGameMeta.awayName}
          homeTeamName={watchGameMeta.homeName}
          myPlayerIds={myPlayerIds}
          allPlayers={allPlayersMap}
          gameResult={{
            score: watchGameData.score,
            winner: watchGameData.winner,
            innings: watchGameData.innings,
            boxScore: watchGameData.boxScore,
          }}
          onComplete={handleGameReplayComplete}
        />
      </div>
    );
  }

  // ── Render: Default UI ─────────────────────────────────────────────────

  return (
    <div className="online-simulation">
      <h2>World Series</h2>

      {seriesScore && (
        <div className="series-score-display">
          <div className={`score-side ${myRole === 'player1' ? 'my-side' : ''}`}>
            <span className="score-label">You</span>
            <span className="score-value">
              {myRole === 'player1' ? seriesScore.player1 : seriesScore.player2}
            </span>
          </div>
          <div className="score-divider">-</div>
          <div className={`score-side ${myRole === 'player2' ? 'my-side' : ''}`}>
            <span className="score-label">Opponent</span>
            <span className="score-value">
              {myRole === 'player1' ? seriesScore.player2 : seriesScore.player1}
            </span>
          </div>
        </div>
      )}

      {gameResults.length > 0 && !isComplete && simMode === 'quick' && (
        <div className="game-results-list">
          {gameResults.map((g, i) => (
            <div key={i} className="game-result-row">
              Game {i + 1}: {g.score[0]} - {g.score[1]}
            </div>
          ))}
        </div>
      )}

      {isComplete && simMode === 'quick' ? (
        <div className="match-result">
          <h3>{isWinner ? 'You Win!' : 'Defeat'}</h3>
          {phaseData.eloChange != null && (
            <p className="elo-change">
              ELO: {isWinner ? '+' : '-'}{String(phaseData.eloChange)}
            </p>
          )}
          <Button variant="primary" size="lg" onClick={onComplete}>
            Back to Menu
          </Button>
        </div>
      ) : !simMode ? (
        <div className="sim-mode-select">
          <p>Choose how to experience the series</p>
          <div className="sim-mode-buttons">
            <Button variant="primary" size="lg" onClick={() => handleSimulate('watch')}>
              Watch Series
            </Button>
            <Button variant="secondary" size="lg" onClick={() => handleSimulate('quick')}>
              Quick Sim
            </Button>
          </div>
          {myRole === 'player2' && (
            <p className="waiting-note">Waiting for host to start...</p>
          )}
        </div>
      ) : simMode === 'quick' ? (
        <div className="sim-progress">
          {isSimulating && <div className="matchmaking-spinner" />}
          {isSimulating && <p>Simulating World Series...</p>}
          {myRole === 'player2' && !isComplete && (
            <p>Waiting for simulation results...</p>
          )}
        </div>
      ) : (
        <div className="sim-progress">
          <div className="matchmaking-spinner" />
          <p>Preparing game...</p>
        </div>
      )}
    </div>
  );
}

export function OnlineSimulationScreen({ matchId, onComplete }: OnlineSimulationScreenProps) {
  return (
    <OnlineGameProvider matchId={matchId}>
      <OnlineSimulationInner onComplete={onComplete} />
    </OnlineGameProvider>
  );
}
