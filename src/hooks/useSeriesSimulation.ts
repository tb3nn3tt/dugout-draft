import { useCallback } from 'react';
import { useGame } from '../context/GameContext';
import {
  simulateAtBat, advanceRunners, shouldSubstitutePitcher,
  selectReliever, selectEmergencyPitcher,
  getBenchPlayers, findPinchHitter, findPinchRunner,
} from '../utils/simulation';
import { Player, GameBoxScore, GameResult, GameState } from '../types';
import { getActiveSynergies, calculateStatBoosts, getCoachBoosts, getStadiumEffect, NEUTRAL_PARK } from '../utils/synergy';
import {
  MomentumState, BatterStreakMap,
  createInitialMomentum, updateMomentum, resetHalfInningMomentum,
  updateBatterStreak, getStreakModifier, getClutchBoost,
} from '../utils/momentumEngine';

// Fast simulation for the entire series
export function useSeriesSimulation() {
  const { state, dispatch } = useGame();

  // Simulate a single game instantly
  const simulateGame = useCallback((
    gameNumber: number,
    team1: typeof state.team1,
    team2: typeof state.team2,
    homeTeam: 'player1' | 'player2'
  ): GameResult => {
    // Determine home/away for this game
    const isHomeGame = [1, 2, 6, 7].includes(gameNumber);
    const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');

    const awayTeam = actualHome === 'player1' ? team2 : team1;
    const homeTeamData = actualHome === 'player1' ? team1 : team2;

    // Initialize game state
    let score: [number, number] = [0, 0]; // [away, home]
    let inning = 1;
    const lineScore: number[][] = [[], []];

    // Initialize boxscore
    const boxScore: GameBoxScore = {
      away: {
        batters: awayTeam.battingOrder.map(p => ({
          playerId: p.id,
          name: p.name,
          position: p.positions[0],
          ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0
        })),
        pitchers: [],
        totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 }
      },
      home: {
        batters: homeTeamData.battingOrder.map(p => ({
          playerId: p.id,
          name: p.name,
          position: p.positions[0],
          ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0
        })),
        pitchers: [],
        totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 }
      },
      lineScore: [[], []]
    };

    // Starting pitchers (rotate through)
    const rotationIndex = (gameNumber - 1) % 4;
    let awayPitcher = awayTeam.rotation[rotationIndex] || awayTeam.rotation[0];
    let homePitcher = homeTeamData.rotation[rotationIndex] || homeTeamData.rotation[0];

    // Add starting pitchers to boxscore (each team's pitcher in their own box)
    boxScore.away.pitchers.push({
      playerId: awayPitcher.id,
      name: awayPitcher.name,
      ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0
    });
    boxScore.home.pitchers.push({
      playerId: homePitcher.id,
      name: homePitcher.name,
      ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0
    });

    let awayBatterIndex = 0;
    let homeBatterIndex = 0;
    let awayPitchCount = 0;
    let homePitchCount = 0;

    // Track used pitchers and bench per team per game
    const awayUsedPitchers = new Set<string>();
    const homeUsedPitchers = new Set<string>();
    const awayUsedBench = new Set<string>();
    const homeUsedBench = new Set<string>();

    // Momentum and streak tracking for this game
    let momentum: MomentumState = createInitialMomentum();
    let batterStreaks: BatterStreakMap = {};

    // Calculate synergies
    const awayCatcher = awayTeam.battingOrder.find(p => p.positions.includes('C')) || null;
    const homeCatcher = homeTeamData.battingOrder.find(p => p.positions.includes('C')) || null;
    const awaySynergies = getActiveSynergies(awayTeam, awayPitcher, awayCatcher);
    const homeSynergies = getActiveSynergies(homeTeamData, homePitcher, homeCatcher);

    // Coach effects
    const awayCoach = getCoachBoosts(awayTeam.roster);
    const homeCoach = getCoachBoosts(homeTeamData.roster);

    // Active park = home team's stadium
    const homeStadiumEffect = getStadiumEffect(homeTeamData.roster);
    const activePark = homeStadiumEffect ?? NEUTRAL_PARK;

    // Helper to simulate a half inning
    const simulateHalfInning = (
      battingTeam: typeof team1,
      pitchingTeam: typeof team1,
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

        // Pinch hitter check (7th+ inning, close game, same-hand disadvantage)
        const battingScoreDiff = isTop
          ? (currentScore[0] + runs) - currentScore[1]
          : (currentScore[1] + runs) - currentScore[0];
        const ph = findPinchHitter(bench, batter, currentPitcher.throws, inning, battingScoreDiff, usedBenchIds);
        if (ph) {
          usedBenchIds.add(ph.id);
          // Add PH to boxscore if not already there
          const phBox = isTop ? boxScore.away : boxScore.home;
          if (!phBox.batters.find(b => b.playerId === ph.id)) {
            phBox.batters.push({
              playerId: ph.id, name: ph.name, position: 'PH',
              ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0,
            });
          }
          batter = ph;
        }

        const statBoost = calculateStatBoosts(
          { teamSynergies: [...batterSynergies.teamSynergies, ...pitcherSynergies.teamSynergies], batteryBonus: pitcherSynergies.batteryBonus },
          batter,
          currentPitcher,
          batterCoachEff
        );

        // Build a minimal game state for clutch calculation
        const gameStateForClutch: Pick<GameState, 'inning' | 'halfInning' | 'outs' | 'runners' | 'score'> = {
          inning,
          halfInning: isTop ? 'top' : 'bottom',
          outs,
          runners,
          score: currentScore,
        };

        const teamMomentum = isTop ? momentum.away : momentum.home;
        const clutchBoostVal = getClutchBoost(batter, gameStateForClutch as GameState);
        const streakMod = getStreakModifier(batterStreaks, batter.id);

        const result = simulateAtBat(batter, currentPitcher, statBoost, {
          momentum: teamMomentum,
          clutchBoost: clutchBoostVal,
          streakModifier: streakMod,
        }, batterCoachEff, pitcherCoachEff, activePark);
        const pitchesThrown = Math.floor(Math.random() * 4) + 2;
        currentPitchCount += pitchesThrown;

        // Update momentum and streaks
        const { newMomentum } = updateMomentum(momentum, result, isTop);
        momentum = newMomentum;
        batterStreaks = updateBatterStreak(batterStreaks, batter.id, result);

        // Update boxscore
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

        // Advance runners
        const { runsScored, newRunners, newOuts } = advanceRunners(result, runners, batter, outs);
        runs += runsScored;

        if (batterRecord) batterRecord.rbi += runsScored;
        if (pitcherRecord) {
          pitcherRecord.r += runsScored;
          pitcherRecord.er += runsScored;
        }

        // Update team totals
        const teamTotals = isTop ? boxScore.away.totals : boxScore.home.totals;
        if (!isWalk) teamTotals.ab++;
        if (isHit) teamTotals.h++;
        if (isWalk) teamTotals.bb++;
        if (isStrikeout) teamTotals.so++;
        teamTotals.rbi += runsScored;

        // Track outs for IP
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

        // Pinch runner check (8th+ inning, slow runner reaches base)
        if ((result === 'walk' || result === 'single') && newRunners[0] && inning >= 8) {
          const pr = findPinchRunner(bench, batter, inning, usedBenchIds);
          if (pr) {
            usedBenchIds.add(pr.id);
          }
        }

        // Check for pitcher substitution with role-based selection
        if (shouldSubstitutePitcher(currentPitcher, currentPitchCount, inning, outs, pitcherCoachEff?.staminaBonus) && outs < 3) {
          const nextBatter = battingTeam.battingOrder[(currentBatterIndex) % 9];
          const scoreDiff = isTop
            ? currentScore[1] - (currentScore[0] + runs)  // home pitcher's perspective
            : currentScore[0] - (currentScore[1] + runs); // away pitcher's perspective
          let newPitcher = selectReliever(
            pitchingTeam.bullpen, pitchingTeam.closer, currentPitcher.id,
            inning, scoreDiff, nextBatter?.bats ?? 'R', usedPitcherIds
          );
          // Emergency fallback: re-enter best available reliever
          if (!newPitcher) {
            newPitcher = selectEmergencyPitcher(pitchingTeam.bullpen, pitchingTeam.closer, currentPitcher.id);
          }
          if (newPitcher) {
            usedPitcherIds.add(newPitcher.id);
            currentPitcher = newPitcher;
            currentPitchCount = 0;

            // Add new pitcher to boxscore if not already there
            if (!pitcherBox.pitchers.find(p => p.playerId === newPitcher.id)) {
              pitcherBox.pitchers.push({
                playerId: newPitcher.id,
                name: newPitcher.name,
                ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0
              });
            }
          }
        }
      }

      return { runs, newBatterIndex: currentBatterIndex, newPitcher: currentPitcher, newPitchCount: currentPitchCount };
    };

    // Simulate the game
    while (true) {
      // Top of inning (away team bats, home team pitches)
      const topResult = simulateHalfInning(
        awayTeam, homeTeamData, true,
        awayBatterIndex, homePitcher, homePitchCount,
        awaySynergies, homeSynergies,
        score, homeUsedPitchers, awayUsedBench,
        awayCoach, homeCoach
      );
      score[0] += topResult.runs;
      lineScore[0].push(topResult.runs);
      awayBatterIndex = topResult.newBatterIndex;
      homePitcher = topResult.newPitcher;
      homePitchCount = topResult.newPitchCount;
      momentum = resetHalfInningMomentum(momentum);

      // Check if home team already won (they don't need to bat)
      if (inning >= 9 && score[1] > score[0]) {
        lineScore[1].push(0); // X
        break;
      }

      // Bottom of inning (home team bats, away team pitches)
      const bottomResult = simulateHalfInning(
        homeTeamData, awayTeam, false,
        homeBatterIndex, awayPitcher, awayPitchCount,
        homeSynergies, awaySynergies,
        score, awayUsedPitchers, homeUsedBench,
        homeCoach, awayCoach
      );
      score[1] += bottomResult.runs;
      lineScore[1].push(bottomResult.runs);
      homeBatterIndex = bottomResult.newBatterIndex;
      awayPitcher = bottomResult.newPitcher;
      awayPitchCount = bottomResult.newPitchCount;
      momentum = resetHalfInningMomentum(momentum);

      // Check for walk-off
      if (inning >= 9 && score[1] > score[0]) {
        break;
      }

      // Check for game end after 9 innings
      if (inning >= 9 && score[0] !== score[1]) {
        break;
      }

      inning++;

      // Safety: cap at 15 innings
      if (inning > 15) {
        if (score[0] === score[1]) score[1]++; // Force a winner
        break;
      }
    }

    // Update totals
    boxScore.away.totals.r = score[0];
    boxScore.home.totals.r = score[1];

    // Assign W/L/S decisions
    const winningTeamPitchers = score[1] > score[0] ? boxScore.home.pitchers : boxScore.away.pitchers;
    const losingTeamPitchers = score[1] > score[0] ? boxScore.away.pitchers : boxScore.home.pitchers;

    // Winner goes to the pitcher with most IP at the time of lead change (simplified: first pitcher)
    if (winningTeamPitchers.length > 0) {
      winningTeamPitchers[0].decision = 'W';
    }

    // Save goes to the last pitcher if they pitched with a lead
    if (winningTeamPitchers.length > 1) {
      const lastPitcher = winningTeamPitchers[winningTeamPitchers.length - 1];
      if (lastPitcher.ip >= 0.3) {
        lastPitcher.decision = 'S';
      }
    }

    // Loss goes to first pitcher (simplified)
    if (losingTeamPitchers.length > 0) {
      losingTeamPitchers[0].decision = 'L';
    }

    boxScore.lineScore = lineScore;

    return {
      score,
      winner: score[1] > score[0]
        ? (actualHome === 'player1' ? 'player1' : 'player2')
        : (actualHome === 'player1' ? 'player2' : 'player1'),
      innings: lineScore[0].map((away, i) => ({
        away,
        home: lineScore[1][i] ?? 0
      })),
      boxScore
    };
  }, []);

  // Simulate the entire series
  const simulateFullSeries = useCallback(() => {
    const winsNeeded = state.gameMode === 'quick' ? 1 : 4;
    const maxGames = state.gameMode === 'quick' ? 1 : 7;
    const homeTeam = Math.random() < 0.5 ? 'player1' : 'player2';
    const games: GameResult[] = [];

    let player1Wins = 0;
    let player2Wins = 0;
    let gameNumber = 1;

    while (player1Wins < winsNeeded && player2Wins < winsNeeded && gameNumber <= maxGames) {
      const result = simulateGame(gameNumber, state.team1, state.team2, homeTeam);
      games.push(result);

      if (result.winner === 'player1') player1Wins++;
      else player2Wins++;

      gameNumber++;
    }

    // Dispatch the series results
    dispatch({ type: 'START_SERIES' });

    // Add all games to series
    games.forEach((game) => {
      dispatch({
        type: 'END_GAME',
        awayScore: game.score[0],
        homeScore: game.score[1],
        boxScore: game.boxScore!,
        lineScore: game.boxScore!.lineScore
      });
    });

    return {
      games,
      homeTeam,
      winner: player1Wins >= winsNeeded ? 'player1' : 'player2'
    };
  }, [state.team1, state.team2, state.gameMode, simulateGame, dispatch]);

  return {
    simulateFullSeries,
    simulateGame
  };
}
