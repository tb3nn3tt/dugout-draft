import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Player, PlayLogEntry, GameBoxScore, GameState, GameResult,
  SimulationSpeed,
} from '../../types';
import { Scoreboard } from '../Game/Scoreboard';
import { EnhancedPlayLog } from '../Game/EnhancedPlayLog';
import { GameHighlight } from '../Game/GameHighlight';
import { SpeedControls } from '../Game/SpeedControls';
import { GameSummary } from '../Game/GameSummary';
import { Boxscore } from '../Game/Boxscore';
import './OnlineGameReplay.css';

interface OnlineGameReplayProps {
  gameNumber: number;
  plays: PlayLogEntry[];
  boxScore: GameBoxScore;
  lineScore: number[][];
  isWalkoff: boolean;
  awayTeamName: string;
  homeTeamName: string;
  myPlayerIds: Set<string>;
  allPlayers: Map<string, Player>;
  gameResult: GameResult;
  onComplete: () => void;
}

const SPEED_DELAYS: Record<SimulationSpeed, number> = {
  slow: 1800,
  normal: 800,
  fast: 300,
  instant: 30,
};

function makeInitialGameState(): GameState {
  return {
    inning: 1,
    halfInning: 'top',
    outs: 0,
    runners: [false, false, false],
    score: [0, 0],
    currentBatterIndex: 0,
    currentPitcher: null,
    pitchCount: 0,
    boxScore: {
      away: { batters: [], pitchers: [], totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 } },
      home: { batters: [], pitchers: [], totals: { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 } },
      lineScore: [[], []],
    },
    lineScore: [[], []],
  };
}

function isOutPlay(type: PlayLogEntry['type']): boolean {
  return type === 'out' || type === 'strikeout';
}

export function OnlineGameReplay({
  gameNumber,
  plays,
  boxScore,
  lineScore,
  isWalkoff,
  awayTeamName,
  homeTeamName,
  myPlayerIds,
  allPlayers,
  gameResult,
  onComplete,
}: OnlineGameReplayProps) {
  const [playIndex, setPlayIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>(makeInitialGameState());
  const [visiblePlays, setVisiblePlays] = useState<PlayLogEntry[]>([]);
  const [speed, setSpeed] = useState<SimulationSpeed>('normal');
  const [isPaused, setIsPaused] = useState(false);
  const [highlight, setHighlight] = useState<{ message: string; type: 'homerun' | 'walkoff' | 'triple' } | null>(null);
  const [phase, setPhase] = useState<'playing' | 'summary' | 'boxscore'>('playing');
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Process a play and update the game state
  const applyPlay = useCallback((play: PlayLogEntry, prevState: GameState): GameState => {
    const newState = { ...prevState };

    if (play.type === 'inning') {
      // Inning marker — update inning/half, reset outs/runners
      newState.inning = play.inning;
      newState.halfInning = play.half;
      newState.outs = 0;
      newState.runners = [false, false, false];

      // Update line score arrays to match current inning
      while (newState.lineScore[0].length < play.inning - 1) {
        newState.lineScore[0].push(0);
      }
      while (newState.lineScore[1].length < play.inning - 1) {
        newState.lineScore[1].push(0);
      }
      // Initialize current half-inning score slot
      const scoreIdx = play.half === 'top' ? 0 : 1;
      if (newState.lineScore[scoreIdx].length < play.inning) {
        newState.lineScore[scoreIdx].push(0);
      }

      return newState;
    }

    if (play.type === 'normal') {
      // Pitching change or other non-at-bat events
      return newState;
    }

    // At-bat plays
    if (isOutPlay(play.type)) {
      newState.outs = Math.min(3, newState.outs + 1);
      // Double play outs
      if (play.description.toLowerCase().includes('double play')) {
        newState.outs = Math.min(3, newState.outs + 1);
        newState.runners = [false, newState.runners[1], newState.runners[2]];
      }
    }

    if (play.type === 'walk') {
      // Force runners
      if (newState.runners[0]) {
        if (newState.runners[1]) {
          newState.runners = [true, true, true];
        } else {
          newState.runners = [true, true, newState.runners[2]];
        }
      } else {
        newState.runners = [true, newState.runners[1], newState.runners[2]];
      }
    }

    if (play.type === 'single') {
      newState.runners = [true, newState.runners[0], newState.runners[1] && !(play.runsScored && play.runsScored > 0)];
    }
    if (play.type === 'double') {
      newState.runners = [false, true, newState.runners[0]];
    }
    if (play.type === 'triple') {
      newState.runners = [false, false, true];
    }
    if (play.type === 'homerun') {
      newState.runners = [false, false, false];
    }

    // Apply runs scored
    if (play.runsScored && play.runsScored > 0) {
      const scoreIdx = play.half === 'top' ? 0 : 1;
      newState.score = [...newState.score] as [number, number];
      newState.score[scoreIdx] += play.runsScored;

      // Update line score for current inning
      const inningIdx = play.inning - 1;
      newState.lineScore = [
        [...newState.lineScore[0]],
        [...newState.lineScore[1]],
      ];
      while (newState.lineScore[scoreIdx].length <= inningIdx) {
        newState.lineScore[scoreIdx].push(0);
      }
      newState.lineScore[scoreIdx][inningIdx] += play.runsScored;
    }

    // Groundout/flyout with run scored
    if ((play.type === 'out') && play.runsScored && play.runsScored > 0) {
      newState.runners[2] = false;
    }

    return newState;
  }, []);

  // Main timer — steps through plays
  useEffect(() => {
    if (phase !== 'playing' || isPaused || playIndex >= plays.length) return;
    if (highlight) return; // pause during highlights

    const play = plays[playIndex];
    const baseDelay = SPEED_DELAYS[speed];
    const delay = play.type === 'inning' ? baseDelay * 1.5 : baseDelay;

    const timer = setTimeout(() => {
      // Apply the play to game state
      setGameState(prev => applyPlay(play, prev));
      setVisiblePlays(prev => [...prev, play]);

      // Trigger highlights for big plays
      if (play.type === 'homerun') {
        setHighlight({ message: play.description, type: 'homerun' });
      } else if (play.type === 'triple') {
        setHighlight({ message: play.description, type: 'triple' });
      } else if (playIndex === plays.length - 1 && isWalkoff) {
        setHighlight({ message: play.description, type: 'walkoff' });
      }

      setPlayIndex(i => i + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [playIndex, speed, isPaused, phase, highlight, plays, isWalkoff, applyPlay]);

  // When all plays consumed, transition to summary
  useEffect(() => {
    if (phase === 'playing' && playIndex >= plays.length && plays.length > 0 && !highlight) {
      const timer = setTimeout(() => {
        setPhase('summary');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [playIndex, plays.length, phase, highlight]);

  // Skip inning: fast-forward to the next inning marker
  const handleSkipInning = useCallback(() => {
    if (playIndex >= plays.length) return;

    const currentPlay = plays[playIndex - 1] || plays[0];
    const currentInning = currentPlay?.inning || 1;
    const currentHalf = currentPlay?.half || 'top';

    let newState = gameStateRef.current;
    let newVisiblePlays = [...visiblePlays];
    let nextIdx = playIndex;

    // Apply plays until we hit a different inning/half
    while (nextIdx < plays.length) {
      const play = plays[nextIdx];
      if (
        play.type === 'inning' &&
        (play.inning !== currentInning || play.half !== currentHalf)
      ) {
        break;
      }
      newState = applyPlay(play, newState);
      newVisiblePlays.push(play);
      nextIdx++;
    }

    setGameState(newState);
    setVisiblePlays(newVisiblePlays);
    setPlayIndex(nextIdx);
  }, [playIndex, plays, visiblePlays, applyPlay]);

  // Filter visible plays to exclude inning markers for EnhancedPlayLog
  const logPlays = visiblePlays.filter(p => p.type !== 'inning' && p.type !== 'normal');

  return (
    <div className="online-game-replay">
      <div className="replay-game-header">
        Game {gameNumber}
      </div>

      <div className="replay-content">
        <div className="replay-left">
          <Scoreboard
            gameState={gameState}
            awayTeamName={awayTeamName}
            homeTeamName={homeTeamName}
          />

          <SpeedControls
            speed={speed}
            onSpeedChange={setSpeed}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused(p => !p)}
            onSkipInning={handleSkipInning}
          />
        </div>

        <div className="replay-right">
          <EnhancedPlayLog
            plays={logPlays}
            userPlayerIds={myPlayerIds}
            players={allPlayers}
          />
        </div>
      </div>

      {highlight && (
        <GameHighlight
          message={highlight.message}
          type={highlight.type}
          onDone={() => setHighlight(null)}
        />
      )}

      {phase === 'summary' && (
        <GameSummary
          game={gameResult}
          gameNumber={gameNumber}
          awayName={awayTeamName}
          homeName={homeTeamName}
          onContinue={() => setPhase('boxscore')}
        />
      )}

      {phase === 'boxscore' && (
        <Boxscore
          boxScore={boxScore}
          awayTeamName={awayTeamName}
          homeTeamName={homeTeamName}
          lineScore={lineScore}
          onClose={onComplete}
        />
      )}
    </div>
  );
}
