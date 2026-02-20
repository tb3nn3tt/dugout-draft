import { useCallback, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import {
  simulateAtBat, advanceRunners, shouldSubstitutePitcher,
  selectReliever as sharedSelectReliever, selectEmergencyPitcher,
  getBenchPlayers, findPinchHitter as sharedFindPinchHitter,
  findPinchRunner as sharedFindPinchRunner, findDefensiveSub, findBackupCatcher,
} from '../utils/simulation';
import { AtBatResult, GameBoxScore, ActiveSynergies, PlayLogEntry, CurrentMatchup, Player, DraftedTeam } from '../types';
import { getActiveSynergies, calculateStatBoosts, getCoachBoosts, getStadiumEffect, NEUTRAL_PARK } from '../utils/synergy';
import { getPlayType } from '../utils/gameNarrative';
import {
  MomentumState, BatterStreakMap,
  createInitialMomentum, updateMomentum, resetHalfInningMomentum,
  updateBatterStreak, getStreakModifier, getClutchBoost,
  getMomentumDescription, getClutchDescription,
} from '../utils/momentumEngine';

// Assign W/L/S decisions to pitchers in the boxScore
function assignPitcherDecisions(boxScore: GameBoxScore, awayScore: number, homeScore: number): void {
  const winningTeamPitchers = homeScore > awayScore ? boxScore.home.pitchers : boxScore.away.pitchers;
  const losingTeamPitchers = homeScore > awayScore ? boxScore.away.pitchers : boxScore.home.pitchers;

  // Winner goes to the first pitcher on winning team (simplified)
  if (winningTeamPitchers.length > 0) {
    winningTeamPitchers[0].decision = 'W';
  }

  // Save goes to last pitcher if they pitched with lead and it's not the winner
  if (winningTeamPitchers.length > 1) {
    const lastPitcher = winningTeamPitchers[winningTeamPitchers.length - 1];
    if (lastPitcher.ip >= 0.3) {
      lastPitcher.decision = 'S';
    }
  }

  // Loss goes to first pitcher on losing team
  if (losingTeamPitchers.length > 0) {
    losingTeamPitchers[0].decision = 'L';
  }
}

let playLogCounter = 0;
function createPlayLogEntry(
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

// --- Smart Bullpen & Bench Role Helpers ---

function getTeamBench(team: DraftedTeam): Player[] {
  return getBenchPlayers(team.roster, team.battingOrder, team.rotation, team.closer, team.bullpen);
}

function selectReliever(
  pitchingTeam: DraftedTeam,
  currentPitcherId: string,
  inning: number,
  scoreDiff: number,
  nextBatterBats: string,
  usedPitcherIds: Set<string>
): Player | null {
  return sharedSelectReliever(
    pitchingTeam.bullpen, pitchingTeam.closer, currentPitcherId,
    inning, scoreDiff, nextBatterBats, usedPitcherIds
  );
}

export function useSimulation() {
  const { state, dispatch } = useGame();

  // Momentum and streak tracking (persists across half-innings within a game)
  const momentumRef = useRef<MomentumState>(createInitialMomentum());
  const streaksRef = useRef<BatterStreakMap>({});
  const usedPitchersRef = useRef<Set<string>>(new Set());
  const usedBenchRef = useRef<Set<string>>(new Set());

  // Calculate synergies for both teams
  const team1Synergies = useMemo((): ActiveSynergies => {
    if (!state.currentGame) {
      return { teamSynergies: [], batteryBonus: null };
    }
    const catcher = state.team1.battingOrder.find(p => p.positions.includes('C')) || null;
    return getActiveSynergies(state.team1, state.currentGame.currentPitcher, catcher);
  }, [state.team1, state.currentGame]);

  const team2Synergies = useMemo((): ActiveSynergies => {
    if (!state.currentGame) {
      return { teamSynergies: [], batteryBonus: null };
    }
    const catcher = state.team2.battingOrder.find(p => p.positions.includes('C')) || null;
    return getActiveSynergies(state.team2, state.currentGame.currentPitcher, catcher);
  }, [state.team2, state.currentGame]);

  // Coach effects for both teams
  const team1Coach = useMemo(() => getCoachBoosts(state.team1.roster), [state.team1.roster]);
  const team2Coach = useMemo(() => getCoachBoosts(state.team2.roster), [state.team2.roster]);

  // Stadium effects for both teams
  const team1Stadium = useMemo(() => getStadiumEffect(state.team1.roster), [state.team1.roster]);
  const team2Stadium = useMemo(() => getStadiumEffect(state.team2.roster), [state.team2.roster]);

  const startSeries = useCallback(() => {
    dispatch({ type: 'START_SERIES' });
  }, [dispatch]);

  const startGame = useCallback((gameNumber: number) => {
    // Reset momentum, streaks, and bench tracking for new game
    momentumRef.current = createInitialMomentum();
    streaksRef.current = {};
    usedPitchersRef.current = new Set();
    usedBenchRef.current = new Set();
    dispatch({ type: 'START_GAME', gameNumber });
  }, [dispatch]);

  const getTeamForHalf = useCallback((halfInning: 'top' | 'bottom') => {
    if (!state.series) return null;

    const gameNum = state.series.games.length + 1;
    const isHomeGame = [1, 2, 6, 7].includes(gameNum);
    const homeTeam = isHomeGame ? state.series.homeTeam : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');

    if (halfInning === 'top') {
      return homeTeam === 'player1' ? state.team2 : state.team1;
    } else {
      return homeTeam === 'player1' ? state.team1 : state.team2;
    }
  }, [state.series, state.team1, state.team2]);

  const getPitchingTeamForHalf = useCallback((halfInning: 'top' | 'bottom') => {
    if (!state.series) return null;

    const gameNum = state.series.games.length + 1;
    const isHomeGame = [1, 2, 6, 7].includes(gameNum);
    const homeTeam = isHomeGame ? state.series.homeTeam : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');

    if (halfInning === 'top') {
      return homeTeam === 'player1' ? state.team1 : state.team2;
    } else {
      return homeTeam === 'player1' ? state.team2 : state.team1;
    }
  }, [state.series, state.team1, state.team2]);

  // Update boxscore for a batter
  const updateBatterStats = (
    boxScore: GameBoxScore,
    isAway: boolean,
    batterId: string,
    result: AtBatResult,
    _runsScored: number,
    rbiCount: number
  ): GameBoxScore => {
    const teamBox = isAway ? boxScore.away : boxScore.home;
    const batter = teamBox.batters.find(b => b.playerId === batterId);
    if (!batter) return boxScore;

    // Update batter stats
    const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
    const isWalk = result === 'walk';
    const isStrikeout = result === 'strikeout';
    const isAtBat = !isWalk; // Walks don't count as AB

    if (isAtBat) batter.ab++;
    if (isHit) batter.h++;
    if (result === 'homerun') batter.hr++;
    if (result === 'double') batter.doubles = (batter.doubles ?? 0) + 1;
    if (result === 'triple') batter.triples = (batter.triples ?? 0) + 1;
    if (isWalk) batter.bb++;
    if (isStrikeout) batter.so++;
    batter.rbi += rbiCount;

    // Update team totals
    if (isAtBat) teamBox.totals.ab++;
    if (isHit) teamBox.totals.h++;
    if (isWalk) teamBox.totals.bb++;
    if (isStrikeout) teamBox.totals.so++;
    teamBox.totals.rbi += rbiCount;

    return boxScore;
  };

  // Update boxscore for pitcher
  const updatePitcherStats = (
    boxScore: GameBoxScore,
    isAwayPitching: boolean,
    pitcherId: string,
    result: AtBatResult,
    runsScored: number,
    pitchesThrown: number
  ): GameBoxScore => {
    const teamBox = isAwayPitching ? boxScore.away : boxScore.home;
    let pitcher = teamBox.pitchers.find(p => p.playerId === pitcherId);

    if (!pitcher) {
      // Add new pitcher to boxscore
      pitcher = {
        playerId: pitcherId,
        name: '',
        ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0,
      };
      teamBox.pitchers.push(pitcher);
    }

    const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
    const isWalk = result === 'walk';
    const isStrikeout = result === 'strikeout';

    if (isHit) pitcher.h++;
    if (isWalk) pitcher.bb++;
    if (isStrikeout) pitcher.so++;
    pitcher.r += runsScored;
    pitcher.er += runsScored; // Simplified: all runs are earned
    pitcher.pitches += pitchesThrown;

    return boxScore;
  };

  // Add outs to pitcher's IP
  const addOutsToIP = (
    boxScore: GameBoxScore,
    isAwayPitching: boolean,
    pitcherId: string,
    outs: number
  ): GameBoxScore => {
    const teamBox = isAwayPitching ? boxScore.away : boxScore.home;
    const pitcher = teamBox.pitchers.find(p => p.playerId === pitcherId);
    if (pitcher) {
      // IP is stored as decimal where .1 = 1/3, .2 = 2/3
      const currentOuts = Math.round((pitcher.ip % 1) * 3) + outs;
      const fullInnings = Math.floor(pitcher.ip) + Math.floor(currentOuts / 3);
      const remainingOuts = currentOuts % 3;
      pitcher.ip = fullInnings + (remainingOuts / 10) * 3.33; // Convert to .1, .2 format
      pitcher.ip = Math.round(pitcher.ip * 10) / 10;
    }
    return boxScore;
  };

  const simulateHalfInning = useCallback(() => {
    if (!state.currentGame || !state.series) return;

    const battingTeam = getTeamForHalf(state.currentGame.halfInning);
    const pitchingTeam = getPitchingTeamForHalf(state.currentGame.halfInning);
    if (!battingTeam || !pitchingTeam) return;

    const isAwayBatting = state.currentGame.halfInning === 'top';
    // Compute actual home team for this game (home field alternates)
    const simGameNum = state.series.games.length + 1;
    const simIsHomeGame = [1, 2, 6, 7].includes(simGameNum);
    const simActualHome = simIsHomeGame
      ? state.series.homeTeam
      : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');
    // Active park = home team's stadium
    const activePark = simActualHome === 'player1'
      ? (team1Stadium ?? NEUTRAL_PARK)
      : (team2Stadium ?? NEUTRAL_PARK);
    const battingTeamOwner = isAwayBatting
      ? (simActualHome === 'player1' ? 'player2' : 'player1')
      : simActualHome;
    const isUserBatting = battingTeamOwner === 'player1'; // Player 1 is the user
    let gameState = { ...state.currentGame };
    let boxScore: GameBoxScore = structuredClone(gameState.boxScore);
    let lineScore = [...gameState.lineScore.map(arr => [...arr])];

    let outs = 0;
    let runs = 0;
    let batterIndex = gameState.currentBatterIndex;
    let pitcher = gameState.currentPitcher || pitchingTeam.rotation[0];
    let pitchCount = gameState.pitchCount;
    const halfLabel = gameState.halfInning === 'top' ? 'Top' : 'Bottom';

    // Add inning header
    dispatch({
      type: 'ADD_PLAY_LOG',
      entry: createPlayLogEntry(
        `--- ${halfLabel} of Inning ${gameState.inning} ---`,
        'inning',
        '',
        '',
        gameState.inning,
        gameState.halfInning
      ),
    });

    while (outs < 3) {
      let batter = battingTeam.battingOrder[batterIndex];
      if (!batter) break;

      // Pinch hit check (7th+ inning, close game, same-hand disadvantage)
      const battingScoreDiff = isAwayBatting
        ? (gameState.score[0] + runs) - gameState.score[1]
        : (gameState.score[1] + runs) - gameState.score[0];
      const bench = getTeamBench(battingTeam);
      const ph = sharedFindPinchHitter(bench, batter, pitcher.throws, gameState.inning, battingScoreDiff, usedBenchRef.current);
      if (ph) {
        usedBenchRef.current.add(ph.id);
        // Add PH to boxscore
        const phTeamBox = isAwayBatting ? boxScore.away : boxScore.home;
        if (!phTeamBox.batters.find(b => b.playerId === ph.id)) {
          phTeamBox.batters.push({
            playerId: ph.id, name: ph.name, position: 'PH',
            ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0, hr: 0,
          });
        }
        dispatch({
          type: 'ADD_PLAY_LOG',
          entry: createPlayLogEntry(
            `Pinch hitter: ${ph.name} batting for ${batter.name}`,
            'normal', ph.id, ph.name, gameState.inning, gameState.halfInning, isUserBatting
          ),
        });
        batter = ph;
      }

      // Get synergies for current at-bat
      const battingSynergies = isAwayBatting ? team2Synergies : team1Synergies;
      const pitchingSynergies = isAwayBatting ? team1Synergies : team2Synergies;

      // Calculate stat boosts from synergies
      const allSynergies: ActiveSynergies = {
        teamSynergies: [...battingSynergies.teamSynergies, ...pitchingSynergies.teamSynergies],
        batteryBonus: pitchingSynergies.batteryBonus,
      };
      // Determine coach effects for batting/pitching teams
      const batterCoachEffect = isAwayBatting ? team2Coach : team1Coach;
      const pitcherCoachEffect = isAwayBatting ? team1Coach : team2Coach;

      const statBoost = calculateStatBoosts(allSynergies, batter, pitcher, batterCoachEffect);

      // Calculate momentum, clutch, and streak modifiers
      const teamMomentum = isAwayBatting ? momentumRef.current.away : momentumRef.current.home;
      const clutchBoostVal = getClutchBoost(batter, gameState);
      const streakMod = getStreakModifier(streaksRef.current, batter.id);
      const isClutchSituation = Math.abs(clutchBoostVal) > 1.5;

      const result = simulateAtBat(batter, pitcher, statBoost, {
        momentum: teamMomentum,
        clutchBoost: clutchBoostVal,
        streakModifier: streakMod,
      }, batterCoachEffect, pitcherCoachEffect, activePark);
      const pitchesThrown = Math.floor(Math.random() * 4) + 2;
      pitchCount += pitchesThrown;

      // Update momentum and streaks
      const { newMomentum, event: momentumEvent } = updateMomentum(momentumRef.current, result, isAwayBatting);
      momentumRef.current = newMomentum;
      streaksRef.current = updateBatterStreak(streaksRef.current, batter.id, result);

      const prevOuts = outs;
      const { runsScored, newRunners, newOuts, description } = advanceRunners(
        result,
        gameState.runners,
        batter,
        outs
      );

      // Calculate running score for score context
      let playDescription = `${batter.name}: ${description}`;
      if (runsScored > 0) {
        const runningAway = gameState.halfInning === 'top' ? gameState.score[0] + runs + runsScored : gameState.score[0];
        const runningHome = gameState.halfInning === 'bottom' ? gameState.score[1] + runs + runsScored : gameState.score[1];
        playDescription += ` Now ${runningAway}-${runningHome}`;
      }

      // Create play log entry with proper type
      const playType = getPlayType(result);
      const isHit = ['single', 'double', 'triple', 'homerun'].includes(result);
      const logEntry = createPlayLogEntry(
        playDescription,
        playType,
        batter.id,
        batter.name,
        gameState.inning,
        gameState.halfInning,
        isUserBatting
      );
      logEntry.momentumEvent = momentumEvent ?? undefined;
      logEntry.isClutch = isClutchSituation && isHit;
      logEntry.runsScored = runsScored > 0 ? runsScored : undefined;
      dispatch({ type: 'ADD_PLAY_LOG', entry: logEntry });

      // Add momentum narrative entry
      if (momentumEvent) {
        dispatch({
          type: 'ADD_PLAY_LOG',
          entry: createPlayLogEntry(
            getMomentumDescription(momentumEvent),
            'momentum',
            '',
            '',
            gameState.inning,
            gameState.halfInning
          ),
        });
      }

      // Add clutch narrative
      if (isClutchSituation && isHit) {
        const clutchDesc = getClutchDescription(batter.name, result);
        if (clutchDesc) {
          dispatch({
            type: 'ADD_PLAY_LOG',
            entry: {
              ...createPlayLogEntry(
                clutchDesc,
                'normal',
                batter.id,
                batter.name,
                gameState.inning,
                gameState.halfInning,
                isUserBatting
              ),
              isClutch: true,
            },
          });
        }
      }

      // Update boxscore
      boxScore = updateBatterStats(boxScore, isAwayBatting, batter.id, result, runsScored, runsScored);
      boxScore = updatePitcherStats(boxScore, !isAwayBatting, pitcher.id, result, runsScored, pitchesThrown);

      // Track runs scored by runners
      if (runsScored > 0) {
        const teamBox = isAwayBatting ? boxScore.away : boxScore.home;
        // Add runs to batters who scored (simplified: just add to totals)
        teamBox.totals.r += runsScored;
      }

      const outsRecorded = newOuts - prevOuts;
      if (outsRecorded > 0) {
        boxScore = addOutsToIP(boxScore, !isAwayBatting, pitcher.id, outsRecorded);
      }

      runs += runsScored;
      outs = newOuts;
      gameState.runners = newRunners;
      batterIndex = (batterIndex + 1) % 9;

      // Pinch runner check (8th+ inning, slow runner reaches base)
      if ((result === 'walk' || result === 'single') && newRunners[0] && gameState.inning >= 8) {
        const prBench = getTeamBench(battingTeam);
        const pr = sharedFindPinchRunner(prBench, batter, gameState.inning, usedBenchRef.current);
        if (pr) {
          usedBenchRef.current.add(pr.id);
          dispatch({
            type: 'ADD_PLAY_LOG',
            entry: createPlayLogEntry(
              `Pinch runner: ${pr.name} running for ${batter.name}`,
              'normal', pr.id, pr.name, gameState.inning, gameState.halfInning, isUserBatting
            ),
          });
        }
      }

      // Smart pitcher substitution with role-based selection
      if (shouldSubstitutePitcher(pitcher, pitchCount, gameState.inning, outs, pitcherCoachEffect?.staminaBonus)) {
        const nextBatter = battingTeam.battingOrder[batterIndex % 9];
        const pitchingScoreDiff = isAwayBatting
          ? gameState.score[1] - (gameState.score[0] + runs)
          : gameState.score[0] - (gameState.score[1] + runs);

        let newPitcher = selectReliever(
          pitchingTeam, pitcher.id, gameState.inning,
          pitchingScoreDiff, nextBatter?.bats ?? 'R',
          usedPitchersRef.current
        );
        // Emergency fallback: re-enter best available reliever
        if (!newPitcher) {
          newPitcher = selectEmergencyPitcher(pitchingTeam.bullpen, pitchingTeam.closer, pitcher.id);
        }
        if (newPitcher) {
          usedPitchersRef.current.add(newPitcher.id);
          pitcher = newPitcher;
          pitchCount = 0;
          dispatch({
            type: 'ADD_PLAY_LOG',
            entry: createPlayLogEntry(
              `Pitching change: ${newPitcher.name} enters the game`,
              'normal',
              newPitcher.id,
              newPitcher.name,
              gameState.inning,
              gameState.halfInning
            ),
          });

          // Add new pitcher to boxscore
          const pitcherTeamBox = !isAwayBatting ? boxScore.away : boxScore.home;
          if (!pitcherTeamBox.pitchers.find(p => p.playerId === newPitcher.id)) {
            pitcherTeamBox.pitchers.push({
              playerId: newPitcher.id,
              name: newPitcher.name,
              ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, pitches: 0,
            });
          }
        }
      }
    }

    // Between half-innings: check defensive subs (8th+ with 2+ lead)
    const defBench = getTeamBench(battingTeam);
    const currentScoreDiff = isAwayBatting
      ? (gameState.score[0] + runs) - gameState.score[1]
      : (gameState.score[1] + runs) - gameState.score[0];
    const defSub = findDefensiveSub(defBench, battingTeam.battingOrder, gameState.inning, currentScoreDiff, usedBenchRef.current);
    if (defSub) {
      usedBenchRef.current.add(defSub.sub.id);
      const replaced = battingTeam.battingOrder.find(p => p.id === defSub.replacedId);
      dispatch({
        type: 'ADD_PLAY_LOG',
        entry: createPlayLogEntry(
          `Defensive sub: ${defSub.sub.name} (${defSub.position}) replaces ${replaced?.name ?? 'unknown'}`,
          'normal', defSub.sub.id, defSub.sub.name, gameState.inning, gameState.halfInning, isUserBatting
        ),
      });
    }

    // Between half-innings: check backup catcher (blowout or extras)
    const bcSub = findBackupCatcher(defBench, battingTeam.battingOrder, gameState.inning, currentScoreDiff, usedBenchRef.current);
    if (bcSub) {
      usedBenchRef.current.add(bcSub.sub.id);
      const replacedC = battingTeam.battingOrder.find(p => p.id === bcSub.replacedId);
      dispatch({
        type: 'ADD_PLAY_LOG',
        entry: createPlayLogEntry(
          `Backup catcher: ${bcSub.sub.name} replaces ${replacedC?.name ?? 'unknown'}`,
          'normal', bcSub.sub.id, bcSub.sub.name, gameState.inning, gameState.halfInning, isUserBatting
        ),
      });
    }

    // Decay momentum between half-innings
    momentumRef.current = resetHalfInningMomentum(momentumRef.current);

    // Update line score
    if (isAwayBatting) {
      lineScore[0].push(runs);
    } else {
      lineScore[1].push(runs);
    }

    // Update score
    const newScore: [number, number] = [...gameState.score] as [number, number];
    if (gameState.halfInning === 'top') {
      newScore[0] += runs;
    } else {
      newScore[1] += runs;
    }

    // Move to next half inning
    let nextHalf: 'top' | 'bottom' = gameState.halfInning === 'top' ? 'bottom' : 'top';
    let nextInning = gameState.inning;

    if (nextHalf === 'top') {
      nextInning++;
    }

    // Check for walk-off
    if (gameState.halfInning === 'bottom' && gameState.inning >= 9 && newScore[1] > newScore[0]) {
      dispatch({
        type: 'ADD_PLAY_LOG',
        entry: createPlayLogEntry(
          `WALK-OFF! Final: ${newScore[0]} - ${newScore[1]}`,
          'walkoff',
          '',
          '',
          gameState.inning,
          gameState.halfInning
        ),
      });
      assignPitcherDecisions(boxScore, newScore[0], newScore[1]);
      dispatch({ type: 'END_GAME', awayScore: newScore[0], homeScore: newScore[1], boxScore, lineScore });
      return;
    }

    // Check for game end (9th inning complete, not tied)
    if (nextInning > 9 && nextHalf === 'top' && newScore[0] !== newScore[1]) {
      dispatch({
        type: 'ADD_PLAY_LOG',
        entry: createPlayLogEntry(
          `Final: ${newScore[0]} - ${newScore[1]}`,
          'normal',
          '',
          '',
          gameState.inning,
          gameState.halfInning
        ),
      });
      assignPitcherDecisions(boxScore, newScore[0], newScore[1]);
      dispatch({ type: 'END_GAME', awayScore: newScore[0], homeScore: newScore[1], boxScore, lineScore });
      return;
    }

    // Home team winning after top of 9th
    if (nextHalf === 'bottom' && nextInning === 9 && newScore[1] > newScore[0]) {
      dispatch({
        type: 'ADD_PLAY_LOG',
        entry: createPlayLogEntry(
          `Final: ${newScore[0]} - ${newScore[1]}`,
          'normal',
          '',
          '',
          gameState.inning,
          gameState.halfInning
        ),
      });
      assignPitcherDecisions(boxScore, newScore[0], newScore[1]);
      dispatch({ type: 'END_GAME', awayScore: newScore[0], homeScore: newScore[1], boxScore, lineScore });
      return;
    }

    // Continue game
    dispatch({
      type: 'UPDATE_GAME_STATE',
      state: {
        inning: nextInning,
        halfInning: nextHalf,
        outs: 0,
        runners: [false, false, false],
        score: newScore,
        currentBatterIndex: batterIndex,
        currentPitcher: pitcher,
        pitchCount,
        boxScore,
        lineScore,
      },
    });
  }, [state.currentGame, state.series, getTeamForHalf, getPitchingTeamForHalf, dispatch, team1Synergies, team2Synergies, team1Coach, team2Coach, team1Stadium, team2Stadium]);

  const simulateFullGame = useCallback(() => {
    if (!state.series) return;

    const gameNumber = state.series.games.length + 1;
    startGame(gameNumber);
  }, [state.series, startGame]);

  const simulateRemainingInnings = useCallback(async () => {
    if (!state.currentGame) return;
    simulateHalfInning();
  }, [state.currentGame, simulateHalfInning]);

  const getSeriesScore = useCallback(() => {
    if (!state.series) return { player1: 0, player2: 0 };

    return {
      player1: state.series.games.filter(g => g.winner === 'player1').length,
      player2: state.series.games.filter(g => g.winner === 'player2').length,
    };
  }, [state.series]);

  const winsNeeded = state.gameMode === 'quick' ? 1 : 4;

  const isSeriesOver = useCallback(() => {
    const score = getSeriesScore();
    return score.player1 >= winsNeeded || score.player2 >= winsNeeded;
  }, [getSeriesScore, winsNeeded]);

  const getSeriesWinner = useCallback(() => {
    const score = getSeriesScore();
    if (score.player1 >= winsNeeded) return 'player1';
    if (score.player2 >= winsNeeded) return 'player2';
    return null;
  }, [getSeriesScore, winsNeeded]);

  // Get current matchup for display
  const currentMatchup = useMemo((): CurrentMatchup | null => {
    if (!state.currentGame || !state.series) return null;

    const battingTeam = getTeamForHalf(state.currentGame.halfInning);
    const pitchingTeam = getPitchingTeamForHalf(state.currentGame.halfInning);
    if (!battingTeam || !pitchingTeam) return null;

    const isAwayBatting = state.currentGame.halfInning === 'top';
    // Compute actual home team for this game (home field alternates)
    const matchupGameNum = state.series.games.length + 1;
    const matchupIsHome = [1, 2, 6, 7].includes(matchupGameNum);
    const matchupActualHome = matchupIsHome
      ? state.series.homeTeam
      : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');
    const batterTeam = isAwayBatting
      ? (matchupActualHome === 'player1' ? 'player2' : 'player1')
      : matchupActualHome;
    const pitcherTeam = isAwayBatting
      ? matchupActualHome
      : (matchupActualHome === 'player1' ? 'player2' : 'player1');

    const batter = battingTeam.battingOrder[state.currentGame.currentBatterIndex];
    const pitcher = state.currentGame.currentPitcher || pitchingTeam.rotation[0];

    if (!batter || !pitcher) return null;

    return {
      batter,
      pitcher,
      batterTeam,
      pitcherTeam,
    };
  }, [state.currentGame, state.series, getTeamForHalf, getPitchingTeamForHalf]);

  // Get user's player IDs for highlighting
  const userPlayerIds = useMemo((): Set<string> => {
    const ids = new Set<string>();
    state.team1.roster.forEach(p => ids.add(p.id));
    return ids;
  }, [state.team1.roster]);

  // Active stadium name for scoreboard display
  const activeStadiumName = useMemo(() => {
    if (!state.series) return team1Stadium?.name ?? null;
    const gameNum = state.series.games.length + 1;
    const isHomeGame = [1, 2, 6, 7].includes(gameNum);
    const actualHome = isHomeGame
      ? state.series.homeTeam
      : (state.series.homeTeam === 'player1' ? 'player2' : 'player1');
    const park = actualHome === 'player1' ? team1Stadium : team2Stadium;
    return park?.name ?? null;
  }, [state.series, team1Stadium, team2Stadium]);

  return {
    startSeries,
    startGame,
    simulateHalfInning,
    simulateFullGame,
    simulateRemainingInnings,
    getSeriesScore,
    isSeriesOver,
    getSeriesWinner,
    currentGame: state.currentGame,
    series: state.series,
    playLog: state.playLog,
    team1Synergies,
    team2Synergies,
    currentMatchup,
    userPlayerIds,
    activeStadiumName,
    team1: state.team1,
    team2: state.team2,
  };
}
