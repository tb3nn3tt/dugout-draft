import { DraftedTeam, GameBoxScore, GameResult, GameState, Player } from '../types';
import {
  simulateAtBat, advanceRunners, shouldSubstitutePitcher,
  selectReliever, selectEmergencyPitcher,
  getBenchPlayers, findPinchHitter, findPinchRunner,
} from './simulation';
import {
  getActiveSynergies, calculateStatBoosts, getCoachBoosts,
  getStadiumEffect, NEUTRAL_PARK,
} from './synergy';
import { ParkEffect } from '../types';
import { combinePark } from '../mutators';
import {
  MomentumState, BatterStreakMap,
  createInitialMomentum, updateMomentum, resetHalfInningMomentum,
  updateBatterStreak, getStreakModifier, getClutchBoost,
} from './momentumEngine';
import { rand } from './rng';

// ============================================================================
// Headless series simulation. Pure functions — no React, no dispatch. Ported
// from useSeriesSimulation.simulateGame, parameterized on two DraftedTeams.
// ============================================================================

/** Simulate one full game. `homeTeam` is which owner starts the series at home. */
export function playGame(
  gameNumber: number,
  team1: DraftedTeam,
  team2: DraftedTeam,
  homeTeam: 'player1' | 'player2',
  envPark?: Partial<ParkEffect>
): GameResult {
  // Home/away alternates by game (1,2,6,7 = original home team hosts).
  const isHomeGame = [1, 2, 6, 7].includes(gameNumber);
  const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');

  const awayTeam = actualHome === 'player1' ? team2 : team1;
  const homeTeamData = actualHome === 'player1' ? team1 : team2;

  let score: [number, number] = [0, 0]; // [away, home]
  let inning = 1;
  const lineScore: number[][] = [[], []];

  const boxScore: GameBoxScore = {
    away: {
      batters: awayTeam.battingOrder.map(p => ({
        playerId: p.id, name: p.name, position: p.positions[0],
        ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0,
      })),
      pitchers: [],
      totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
    },
    home: {
      batters: homeTeamData.battingOrder.map(p => ({
        playerId: p.id, name: p.name, position: p.positions[0],
        ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0,
      })),
      pitchers: [],
      totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 },
    },
    lineScore: [[], []],
  };

  // Starting pitchers rotate through the 4-man rotation across the series.
  const rotationIndex = (gameNumber - 1) % 4;
  let awayPitcher = awayTeam.rotation[rotationIndex] || awayTeam.rotation[0];
  let homePitcher = homeTeamData.rotation[rotationIndex] || homeTeamData.rotation[0];

  boxScore.away.pitchers.push({ playerId: awayPitcher.id, name: awayPitcher.name, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0 });
  boxScore.home.pitchers.push({ playerId: homePitcher.id, name: homePitcher.name, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0 });

  let awayBatterIndex = 0;
  let homeBatterIndex = 0;
  let awayPitchCount = 0;
  let homePitchCount = 0;

  const awayUsedPitchers = new Set<string>();
  const homeUsedPitchers = new Set<string>();
  const awayUsedBench = new Set<string>();
  const homeUsedBench = new Set<string>();

  let momentum: MomentumState = createInitialMomentum();
  let batterStreaks: BatterStreakMap = {};

  const awayCatcher = awayTeam.battingOrder.find(p => p.positions.includes('C')) || null;
  const homeCatcher = homeTeamData.battingOrder.find(p => p.positions.includes('C')) || null;
  const awaySynergies = getActiveSynergies(awayTeam, awayPitcher, awayCatcher);
  const homeSynergies = getActiveSynergies(homeTeamData, homePitcher, homeCatcher);

  const awayCoach = getCoachBoosts(awayTeam.roster);
  const homeCoach = getCoachBoosts(homeTeamData.roster);

  const homeStadiumEffect = getStadiumEffect(homeTeamData.roster);
  const activePark = combinePark(homeStadiumEffect ?? NEUTRAL_PARK, envPark);

  const simulateHalfInning = (
    battingTeam: DraftedTeam,
    pitchingTeam: DraftedTeam,
    isTop: boolean,
    batterIndex: number,
    pitcher: Player,
    pitchCount: number,
    batterSynergies: ReturnType<typeof getActiveSynergies>,
    pitcherSynergies: ReturnType<typeof getActiveSynergies>,
    currentScore: [number, number],
    usedPitcherIds: Set<string>,
    usedBenchIds: Set<string>,
    batterCoachEff: typeof awayCoach,
    pitcherCoachEff: typeof homeCoach
  ): { runs: number; newBatterIndex: number; newPitcher: Player; newPitchCount: number } => {
    const bench = getBenchPlayers(battingTeam.roster, battingTeam.battingOrder, battingTeam.rotation, battingTeam.closer, battingTeam.bullpen);
    let runs = 0;
    let outs = 0;
    let runners: [boolean, boolean, boolean] = [false, false, false];
    let currentBatterIndex = batterIndex;
    let currentPitcher = pitcher;
    let currentPitchCount = pitchCount;

    while (outs < 3) {
      let batter = battingTeam.battingOrder[currentBatterIndex];

      const battingScoreDiff = isTop
        ? (currentScore[0] + runs) - currentScore[1]
        : (currentScore[1] + runs) - currentScore[0];
      const ph = findPinchHitter(bench, batter, currentPitcher.throws, inning, battingScoreDiff, usedBenchIds);
      if (ph) {
        usedBenchIds.add(ph.id);
        const phBox = isTop ? boxScore.away : boxScore.home;
        if (!phBox.batters.find(b => b.playerId === ph.id)) {
          phBox.batters.push({ playerId: ph.id, name: ph.name, position: 'PH', ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0 });
        }
        batter = ph;
      }

      const statBoost = calculateStatBoosts(
        { teamSynergies: [...batterSynergies.teamSynergies, ...pitcherSynergies.teamSynergies], batteryBonus: pitcherSynergies.batteryBonus },
        batter,
        currentPitcher,
        batterCoachEff
      );

      const gameStateForClutch: Pick<GameState, 'inning' | 'halfInning' | 'outs' | 'runners' | 'score'> = {
        inning, halfInning: isTop ? 'top' : 'bottom', outs, runners, score: currentScore,
      };

      const teamMomentum = isTop ? momentum.away : momentum.home;
      const clutchBoostVal = getClutchBoost(batter, gameStateForClutch as GameState);
      const streakMod = getStreakModifier(batterStreaks, batter.id);

      const result = simulateAtBat(batter, currentPitcher, statBoost, {
        momentum: teamMomentum, clutchBoost: clutchBoostVal, streakModifier: streakMod,
      }, batterCoachEff, pitcherCoachEff, activePark);
      const pitchesThrown = Math.floor(rand() * 4) + 2;
      currentPitchCount += pitchesThrown;

      const { newMomentum } = updateMomentum(momentum, result, isTop);
      momentum = newMomentum;
      batterStreaks = updateBatterStreak(batterStreaks, batter.id, result);

      const batterBox = isTop ? boxScore.away : boxScore.home;
      const pitcherBox = isTop ? boxScore.home : boxScore.away;
      const batterRecord = batterBox.batters.find(b => b.playerId === batter.id);
      const pitcherRecord = pitcherBox.pitchers.find(p => p.playerId === currentPitcher.id);

      const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
      const isWalk = result === 'walk';
      const isStrikeout = result === 'strikeout';

      if (batterRecord) {
        if (!isWalk) batterRecord.ab++;
        if (isHit) batterRecord.h++;
        if (result === 'homerun') batterRecord.hr++;
        if (result === 'double') batterRecord.doubles = (batterRecord.doubles ?? 0) + 1;
        if (result === 'triple') batterRecord.triples = (batterRecord.triples ?? 0) + 1;
        if (isWalk) batterRecord.bb++;
        if (isStrikeout) batterRecord.so++;
      }

      if (pitcherRecord) {
        if (isHit) pitcherRecord.h++;
        if (isWalk) pitcherRecord.bb++;
        if (isStrikeout) pitcherRecord.so++;
        pitcherRecord.pitches += pitchesThrown;
      }

      const { runsScored, newRunners, newOuts } = advanceRunners(result, runners, batter, outs);
      runs += runsScored;

      if (batterRecord) batterRecord.rbi += runsScored;
      if (pitcherRecord) { pitcherRecord.r += runsScored; pitcherRecord.er += runsScored; }

      const teamTotals = isTop ? boxScore.away.totals : boxScore.home.totals;
      if (!isWalk) teamTotals.ab++;
      if (isHit) teamTotals.h++;
      if (isWalk) teamTotals.bb++;
      if (isStrikeout) teamTotals.so++;
      teamTotals.rbi += runsScored;

      const outsRecorded = newOuts - outs;
      if (outsRecorded > 0 && pitcherRecord) {
        const currentOuts = Math.round((pitcherRecord.ip % 1) * 3) + outsRecorded;
        const fullInnings = Math.floor(pitcherRecord.ip) + Math.floor(currentOuts / 3);
        const remainingOuts = currentOuts % 3;
        pitcherRecord.ip = fullInnings + (remainingOuts / 10) * 3.33;
        pitcherRecord.ip = Math.round(pitcherRecord.ip * 10) / 10;
      }

      outs = newOuts;
      runners = newRunners;
      currentBatterIndex = (currentBatterIndex + 1) % 9;

      if ((result === 'walk' || result === 'single') && newRunners[0] && inning >= 8) {
        const pr = findPinchRunner(bench, batter, inning, usedBenchIds);
        if (pr) usedBenchIds.add(pr.id);
      }

      if (shouldSubstitutePitcher(currentPitcher, currentPitchCount, inning, outs, pitcherCoachEff?.staminaBonus) && outs < 3) {
        const nextBatter = battingTeam.battingOrder[currentBatterIndex % 9];
        const scoreDiff = isTop
          ? currentScore[1] - (currentScore[0] + runs)
          : currentScore[0] - (currentScore[1] + runs);
        let newPitcher = selectReliever(
          pitchingTeam.bullpen, pitchingTeam.closer, currentPitcher.id,
          inning, scoreDiff, nextBatter?.bats ?? 'R', usedPitcherIds
        );
        if (!newPitcher) newPitcher = selectEmergencyPitcher(pitchingTeam.bullpen, pitchingTeam.closer, currentPitcher.id);
        if (newPitcher) {
          usedPitcherIds.add(newPitcher.id);
          currentPitcher = newPitcher;
          currentPitchCount = 0;
          if (!pitcherBox.pitchers.find(p => p.playerId === newPitcher.id)) {
            pitcherBox.pitchers.push({ playerId: newPitcher.id, name: newPitcher.name, ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0 });
          }
        }
      }
    }

    return { runs, newBatterIndex: currentBatterIndex, newPitcher: currentPitcher, newPitchCount: currentPitchCount };
  };

  while (true) {
    const topResult = simulateHalfInning(
      awayTeam, homeTeamData, true, awayBatterIndex, homePitcher, homePitchCount,
      awaySynergies, homeSynergies, score, homeUsedPitchers, awayUsedBench, awayCoach, homeCoach
    );
    score[0] += topResult.runs;
    lineScore[0].push(topResult.runs);
    awayBatterIndex = topResult.newBatterIndex;
    homePitcher = topResult.newPitcher;
    homePitchCount = topResult.newPitchCount;
    momentum = resetHalfInningMomentum(momentum);

    if (inning >= 9 && score[1] > score[0]) { lineScore[1].push(0); break; }

    const bottomResult = simulateHalfInning(
      homeTeamData, awayTeam, false, homeBatterIndex, awayPitcher, awayPitchCount,
      homeSynergies, awaySynergies, score, awayUsedPitchers, homeUsedBench, homeCoach, awayCoach
    );
    score[1] += bottomResult.runs;
    lineScore[1].push(bottomResult.runs);
    homeBatterIndex = bottomResult.newBatterIndex;
    awayPitcher = bottomResult.newPitcher;
    awayPitchCount = bottomResult.newPitchCount;
    momentum = resetHalfInningMomentum(momentum);

    if (inning >= 9 && score[1] > score[0]) break;
    if (inning >= 9 && score[0] !== score[1]) break;

    inning++;
    if (inning > 15) { if (score[0] === score[1]) score[1]++; break; }
  }

  boxScore.away.totals.r = score[0];
  boxScore.home.totals.r = score[1];

  const winningTeamPitchers = score[1] > score[0] ? boxScore.home.pitchers : boxScore.away.pitchers;
  const losingTeamPitchers = score[1] > score[0] ? boxScore.away.pitchers : boxScore.home.pitchers;
  if (winningTeamPitchers.length > 0) winningTeamPitchers[0].decision = 'W';
  if (winningTeamPitchers.length > 1) {
    const last = winningTeamPitchers[winningTeamPitchers.length - 1];
    if (last.ip >= 0.3) last.decision = 'S';
  }
  if (losingTeamPitchers.length > 0) losingTeamPitchers[0].decision = 'L';

  boxScore.lineScore = lineScore;

  return {
    score,
    winner: score[1] > score[0]
      ? (actualHome === 'player1' ? 'player1' : 'player2')
      : (actualHome === 'player1' ? 'player2' : 'player1'),
    innings: lineScore[0].map((away, i) => ({ away, home: lineScore[1][i] ?? 0 })),
    boxScore,
  };
}

export interface GameLine {
  you: number;   // your runs that game
  opp: number;   // opponent runs that game
  won: boolean;  // did you win it
}

export interface SeriesResult {
  /** 'you' = team1 (the human), 'opp' = team2 (the opponent ghost). */
  winner: 'you' | 'opp';
  youWins: number;
  oppWins: number;
  youRuns: number;
  oppRuns: number;
  games: GameResult[];
  gameLines: GameLine[]; // per-game you/opp scores in order
}

/**
 * Simulate a best-of-7 series. team1 is always the human; team2 the opponent.
 * Home field for the series is decided by a coin flip (matches the original).
 */
export function playSeries(
  team1: DraftedTeam,
  team2: DraftedTeam,
  envPark?: Partial<ParkEffect>
): SeriesResult {
  const winsNeeded = 4;
  const maxGames = 7;
  const homeTeam: 'player1' | 'player2' = rand() < 0.5 ? 'player1' : 'player2';

  const games: GameResult[] = [];
  const gameLines: GameLine[] = [];
  let p1Wins = 0;
  let p2Wins = 0;
  let youRuns = 0;
  let oppRuns = 0;
  let gameNumber = 1;

  while (p1Wins < winsNeeded && p2Wins < winsNeeded && gameNumber <= maxGames) {
    const result = playGame(gameNumber, team1, team2, homeTeam, envPark);
    games.push(result);

    // Map away/home score back to team1 (you) vs team2 (opp) for this game.
    const isHomeGame = [1, 2, 6, 7].includes(gameNumber);
    const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');
    const [awayScore, homeScore] = result.score;
    const you = actualHome === 'player1' ? homeScore : awayScore;
    const opp = actualHome === 'player1' ? awayScore : homeScore;
    youRuns += you; oppRuns += opp;
    const won = result.winner === 'player1';
    gameLines.push({ you, opp, won });

    if (won) p1Wins++;
    else p2Wins++;
    gameNumber++;
  }

  return {
    winner: p1Wins >= winsNeeded ? 'you' : 'opp',
    youWins: p1Wins,
    oppWins: p2Wins,
    youRuns,
    oppRuns,
    games,
    gameLines,
  };
}
