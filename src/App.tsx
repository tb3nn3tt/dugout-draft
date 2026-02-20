import { useState, useEffect, useCallback, useRef } from 'react';
import { useGame } from './context/GameContext';
import { Player, GameBoxScore, SimulationSpeed } from './types';
import { AllTimeRecords } from './components/Game/AllTimeRecords';
import { CardPool } from './components/Draft/CardPool';
import { TeamLineup } from './components/Draft/TeamLineup';
import { LineupConfirm } from './components/TeamSetup/LineupConfirm';
import { Scoreboard } from './components/Game/Scoreboard';
import { SeriesTracker } from './components/Game/SeriesTracker';
import { Boxscore } from './components/Game/Boxscore';
import { MatchupDisplay } from './components/Game/MatchupDisplay';
import { GameSituationBanner } from './components/Game/GameSituationBanner';
import { SpeedControls } from './components/Game/SpeedControls';
import { EnhancedPlayLog } from './components/Game/EnhancedPlayLog';
import { SeriesRecap } from './components/Game/SeriesRecap';
import { GameHighlight } from './components/Game/GameHighlight';
import { GameSummary } from './components/Game/GameSummary';
import { SeriesCelebration } from './components/Game/SeriesCelebration';
import { SeriesStatsSidebar } from './components/Game/SeriesStatsSidebar';
import { Button } from './components/shared/Button';
import { ProfileButton } from './components/Auth/ProfileButton';
import { useAuth } from './contexts/AuthContext';
import { useSimulation } from './hooks/useSimulation';
import { useSeriesSimulation } from './hooks/useSeriesSimulation';
import { getSpeedDelay } from './utils/gameNarrative';
import { generateOptimalLineup, generateOptimalRotation, generateOptimalBullpen } from './utils/lineupBuilder';
import { recordCpuGameResult } from './utils/cpuSkill';
import { useCollection } from './contexts/CollectionContext';
import { useSound } from './contexts/SoundContext';
import { CollectionScreen } from './components/Collection/CollectionScreen';
import { PackShop } from './components/Collection/PackShop';
import { RewardModal } from './components/Collection/RewardModal';
import { InstallPrompt } from './components/shared/InstallPrompt';
import { OnboardingTutorial, hasSeenTutorial } from './components/Onboarding/OnboardingTutorial';
import './styles/global.css';

// Online components (lazy-loaded when needed)
import { MatchmakingScreen } from './components/Matchmaking/MatchmakingScreen';
import { LocalMultiplayerFlow } from './components/LocalMultiplayer/LocalMultiplayerFlow';
import { OnlineDraftScreen } from './components/OnlineDraft/OnlineDraftScreen';
import { OnlineTeamSetupScreen } from './components/OnlineDraft/OnlineTeamSetupScreen';
import { OnlineSimulationScreen } from './components/OnlineGame/OnlineSimulationScreen';
import { LeaderboardScreen } from './components/Leaderboard/LeaderboardScreen';
import { ProfilePage } from './components/Profile/ProfilePage';

export type AppMode = 'menu' | 'local' | 'local-multiplayer' | 'matchmaking' | 'online_draft' | 'online_team_setup' | 'online_simulation' | 'leaderboard' | 'profile' | 'collection' | 'shop';

const TEAM_NAME_KEY = 'dugout-draft-team-name';

function StartScreen({ onModeChange, onStartPassPlay }: { onModeChange: (mode: AppMode) => void; onStartPassPlay?: (names: { player1: string; player2: string }) => void }) {
  const { dispatch } = useGame();
  const { user, profile, isOnline, updateTeamName: saveTeamNameToFirestore } = useAuth();
  const { collectionPercent, totalPacks, hasPacksToOpen, isNewUser, openStarterPack, markNotNew, xpLevel } = useCollection();
  const [showRecords, setShowRecords] = useState(false);
  const [showStarterPack, setShowStarterPack] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPassPlaySetup, setShowPassPlaySetup] = useState(false);
  const [ppName1, setPpName1] = useState('');
  const [ppName2, setPpName2] = useState('');

  // Team naming
  const [myTeamName, setMyTeamName] = useState(() => {
    return profile?.team_name || localStorage.getItem(TEAM_NAME_KEY) || '';
  });
  const [showTeamNameModal, setShowTeamNameModal] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [showEditName, setShowEditName] = useState(false);
  // Track pending action after naming
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Sync team name from profile when it loads
  useEffect(() => {
    if (profile?.team_name && !myTeamName) {
      setMyTeamName(profile.team_name);
      localStorage.setItem(TEAM_NAME_KEY, profile.team_name);
    }
  }, [profile?.team_name]);

  const saveTeamName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMyTeamName(trimmed);
    localStorage.setItem(TEAM_NAME_KEY, trimmed);
    if (user) {
      saveTeamNameToFirestore(trimmed);
    }
  }, [user, saveTeamNameToFirestore]);

  // Require team name before starting a game
  const requireTeamName = useCallback((action: () => void) => {
    if (myTeamName) {
      action();
    } else {
      pendingActionRef.current = action;
      setTeamNameInput('');
      setShowTeamNameModal(true);
    }
  }, [myTeamName]);

  const handleTeamNameSubmit = useCallback(() => {
    const trimmed = teamNameInput.trim();
    if (!trimmed) return;
    saveTeamName(trimmed);
    setShowTeamNameModal(false);
    if (pendingActionRef.current) {
      // Use timeout so state update (myTeamName) propagates first
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      setTimeout(action, 0);
    }
  }, [teamNameInput, saveTeamName]);

  // Pre-fill Pass & Play player 1 with stored name
  useEffect(() => {
    if (showPassPlaySetup && myTeamName && !ppName1) {
      setPpName1(myTeamName);
    }
  }, [showPassPlaySetup]);

  // First launch: open starter pack
  useEffect(() => {
    if (isNewUser) {
      openStarterPack();
      markNotNew();
      setShowStarterPack(true);
    }
  }, [isNewUser, openStarterPack, markNotNew]);

  return (
    <div className="start-screen">
      <div className="start-content">
        <img className="start-hero" src="/hero-baseball.png" alt="Dugout Draft" />
        <h1>Dugout Draft</h1>
        <p>Every Legend. One Draft.</p>
        <div className="start-features">
          <div className="feature">
            <span className="feature-icon">🎴</span>
            <span>Draft from 4-card pools</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚡</span>
            <span>Quick Play in 3 minutes</span>
          </div>
          <div className="feature">
            <span className="feature-icon">⚾</span>
            <span>Simulate real baseball</span>
          </div>
        </div>

        {myTeamName && (
          <div className="start-team-name">
            <span className="start-team-label">Your Team:</span>
            <span className="start-team-value">{myTeamName}</span>
            <button className="start-team-edit" onClick={() => { setTeamNameInput(myTeamName); setShowEditName(true); }}>edit</button>
          </div>
        )}

        <div className="mode-buttons">
          <Button
            variant="success"
            size="lg"
            onClick={() => requireTeamName(() => {
              const name = localStorage.getItem(TEAM_NAME_KEY) || myTeamName;
              dispatch({ type: 'START_QUICK_PLAY', team1Name: name });
              onModeChange('local');
            })}
          >
            Quick Play
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => requireTeamName(() => {
              const name = localStorage.getItem(TEAM_NAME_KEY) || myTeamName;
              dispatch({ type: 'START_DRAFT_VS_CPU', team1Name: name });
              onModeChange('local');
            })}
          >
            Play vs CPU
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowPassPlaySetup(true)}
          >
            Pass &amp; Play
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onModeChange('local-multiplayer')}
          >
            Local Multiplayer
          </Button>
          {isOnline && (
            <Button
              variant="success"
              size="lg"
              onClick={() => {
                if (!user) {
                  // Will be handled by AuthModal trigger
                  onModeChange('matchmaking');
                } else {
                  onModeChange('matchmaking');
                }
              }}
              disabled={!user}
            >
              {user ? 'Play Online' : 'Sign In to Play Online'}
            </Button>
          )}
        </div>

        <div className="start-collection-row">
          <Button
            variant="secondary"
            size="md"
            onClick={() => onModeChange('collection')}
          >
            My Collection ({collectionPercent}%)
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onModeChange('shop')}
          >
            {hasPacksToOpen ? `Packs (${totalPacks})` : 'Pack Shop'}
          </Button>
          <span className="start-xp-badge">Lv.{xpLevel}</span>
        </div>

        <div className="start-secondary-buttons">
          {isOnline && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onModeChange('leaderboard')}
            >
              Leaderboard
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowRecords(true)}
          >
            All-Time Records
          </Button>
          {isOnline && user && profile && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onModeChange('profile')}
            >
              My Profile
            </Button>
          )}
        </div>
      </div>
      {showRecords && (
        <AllTimeRecords onClose={() => setShowRecords(false)} />
      )}
      {showTutorial && (
        <OnboardingTutorial
          onComplete={() => {
            setShowTutorial(false);
            dispatch({ type: 'START_QUICK_PLAY', team1Name: myTeamName || undefined });
            onModeChange('local');
          }}
        />
      )}
      {showStarterPack && (
        <div className="starter-pack-overlay">
          <div className="starter-pack-modal">
            <h2>Welcome to Dugout Draft!</h2>
            <p>You've received a starter collection of 86 players to get you going. Play games to earn packs and unlock more!</p>
            <Button variant="primary" size="lg" onClick={() => {
              setShowStarterPack(false);
              if (!hasSeenTutorial()) {
                setShowTutorial(true);
              }
            }}>
              Let's Draft!
            </Button>
          </div>
        </div>
      )}
      {showTeamNameModal && (
        <div className="starter-pack-overlay">
          <div className="team-name-modal">
            <h2>Name Your Team</h2>
            <p>Choose a name for your franchise!</p>
            <input
              type="text"
              className="team-name-input"
              placeholder="e.g. Bayport Sluggers"
              maxLength={20}
              value={teamNameInput}
              onChange={(e) => setTeamNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTeamNameSubmit(); }}
              autoFocus
            />
            <Button variant="primary" size="lg" onClick={handleTeamNameSubmit} disabled={!teamNameInput.trim()}>
              Let's Go!
            </Button>
          </div>
        </div>
      )}
      {showEditName && (
        <div className="starter-pack-overlay" onClick={() => setShowEditName(false)}>
          <div className="team-name-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Rename Your Team</h2>
            <input
              type="text"
              className="team-name-input"
              placeholder="e.g. Bayport Sluggers"
              maxLength={20}
              value={teamNameInput}
              onChange={(e) => setTeamNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && teamNameInput.trim()) {
                  saveTeamName(teamNameInput.trim());
                  setShowEditName(false);
                }
              }}
              autoFocus
            />
            <div className="team-name-actions">
              <Button variant="primary" size="md" onClick={() => { saveTeamName(teamNameInput.trim()); setShowEditName(false); }} disabled={!teamNameInput.trim()}>
                Save
              </Button>
              <button className="pass-play-close" onClick={() => setShowEditName(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showPassPlaySetup && (
        <div className="starter-pack-overlay" onClick={() => setShowPassPlaySetup(false)}>
          <div className="pass-play-setup" onClick={(e) => e.stopPropagation()}>
            <h2>Pass &amp; Play</h2>
            <p>Two players, one device. Take turns drafting!</p>
            <div className="pass-play-inputs">
              <input
                type="text"
                placeholder="Player 1"
                maxLength={12}
                value={ppName1}
                onChange={(e) => setPpName1(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                placeholder="Player 2"
                maxLength={12}
                value={ppName2}
                onChange={(e) => setPpName2(e.target.value)}
              />
            </div>
            <div className="pass-play-modes">
              <Button
                variant="success"
                size="lg"
                onClick={() => {
                  const n1 = ppName1.trim() || 'Player 1';
                  const n2 = ppName2.trim() || 'Player 2';
                  const names = { player1: n1, player2: n2 };
                  onStartPassPlay?.(names);
                  dispatch({ type: 'START_QUICK_PLAY', isCPU: false, team1Name: n1, team2Name: n2 });
                  setShowPassPlaySetup(false);
                  onModeChange('local');
                }}
              >
                Quick Game
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  const n1 = ppName1.trim() || 'Player 1';
                  const n2 = ppName2.trim() || 'Player 2';
                  const names = { player1: n1, player2: n2 };
                  onStartPassPlay?.(names);
                  dispatch({ type: 'START_DRAFT', isCPU: false, team1Name: n1, team2Name: n2 });
                  setShowPassPlaySetup(false);
                  onModeChange('local');
                }}
              >
                Full Draft
              </Button>
            </div>
            <button className="pass-play-close" onClick={() => setShowPassPlaySetup(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftScreen({ playerNames }: { playerNames?: { player1: string; player2: string } }) {
  const { state } = useGame();

  return (
    <div className="draft-screen">
      <div className="draft-roster">
        <TeamLineup
          team1Roster={state.team1.roster}
          team2Roster={state.team2.roster}
          currentPick={state.currentPick}
          team1Name={state.team1.name}
          team2Name={state.team2.name}
        />
      </div>
      <div className="draft-picks">
        <CardPool playerNames={playerNames} />
      </div>
    </div>
  );
}

function TeamSetupScreen() {
  const { state, dispatch } = useGame();
  const [setupPhase, setSetupPhase] = useState<'player1' | 'handoff' | 'player2' | 'ready'>('player1');

  const handleTeam1Confirm = (battingOrder: Player[], rotation: Player[], closer: Player, bullpen: Player[]) => {
    dispatch({ type: 'SET_BATTING_ORDER', team: 'player1', order: battingOrder });
    dispatch({ type: 'SET_ROTATION', team: 'player1', rotation });
    dispatch({ type: 'SET_CLOSER', team: 'player1', closer });
    dispatch({ type: 'SET_BULLPEN', team: 'player1', bullpen });

    if (state.isCPU) {
      // Auto-setup CPU team and skip handoff
      const cpuLineupEntries = generateOptimalLineup(state.team2.roster);
      const cpuLineup = cpuLineupEntries.map(e => e.player);
      const cpuRotation = generateOptimalRotation(state.team2.roster);
      const cpuBP = generateOptimalBullpen(state.team2.roster);
      dispatch({ type: 'SET_BATTING_ORDER', team: 'player2', order: cpuLineup });
      dispatch({ type: 'SET_ROTATION', team: 'player2', rotation: cpuRotation });
      if (cpuBP.closer) dispatch({ type: 'SET_CLOSER', team: 'player2', closer: cpuBP.closer });
      dispatch({ type: 'SET_BULLPEN', team: 'player2', bullpen: [...cpuBP.setup, ...cpuBP.middleRelief, ...cpuBP.longRelief] });
      setSetupPhase('ready');
    } else {
      setSetupPhase('handoff');
    }
  };

  const handleTeam2Confirm = (battingOrder: Player[], rotation: Player[], closer: Player, bullpen: Player[]) => {
    dispatch({ type: 'SET_BATTING_ORDER', team: 'player2', order: battingOrder });
    dispatch({ type: 'SET_ROTATION', team: 'player2', rotation });
    dispatch({ type: 'SET_CLOSER', team: 'player2', closer });
    dispatch({ type: 'SET_BULLPEN', team: 'player2', bullpen });
    setSetupPhase('ready');
  };

  if (setupPhase === 'handoff') {
    return (
      <div className="team-setup-screen">
        <div className="handoff-screen">
          <div className="handoff-icon">🔄</div>
          <h2>Hand it to {state.team2.name}</h2>
          <p>{state.team1.name}'s lineup is locked in. Pass the device.</p>
          <Button variant="primary" size="lg" onClick={() => setSetupPhase('player2')}>
            Ready
          </Button>
        </div>
      </div>
    );
  }

  if (setupPhase === 'ready') {
    return (
      <div className="team-setup-screen">
        <div className="handoff-screen">
          <div className="handoff-icon">⚾</div>
          <h2>{state.isCPU ? 'Your Lineup is Set!' : 'Both Lineups Set!'}</h2>
          <p>{state.isCPU ? 'The CPU has auto-configured its team. Time to play ball.' : 'Time to play ball.'}</p>
          <Button variant="success" size="lg" onClick={() => dispatch({ type: 'FINISH_TEAM_SETUP' })}>
            Start World Series
          </Button>
        </div>
      </div>
    );
  }

  const currentTeam = setupPhase === 'player1' ? state.team1 : state.team2;
  const currentName = setupPhase === 'player1' ? state.team1.name : state.team2.name;
  const handleConfirm = setupPhase === 'player1' ? handleTeam1Confirm : handleTeam2Confirm;

  return (
    <div className="team-setup-screen">
      <div className="setup-header">
        <h2>{currentName} - Set Your Lineup</h2>
        <p className="setup-subtitle">Review and confirm your lineup. Use arrows to reorder.</p>
      </div>

      <div className="setup-teams">
        <LineupConfirm
          team={currentTeam}
          teamName={currentName}
          onConfirm={handleConfirm}
          isConfirmed={false}
        />
      </div>
    </div>
  );
}

function SimulationScreen({ onOpenPacks }: { onOpenPacks: () => void }) {
  const { state, dispatch } = useGame();
  const { earnGameReward } = useCollection();
  const { playSound } = useSound();
  const [gameReward, setGameReward] = useState<{ packs: import('./types').PackReward[]; stubs: number; xp: number; milestones: import('./types').MilestoneReward[] } | null>(null);
  const {
    startSeries,
    startGame,
    simulateHalfInning,
    getSeriesScore,
    isSeriesOver,
    currentGame,
    series,
    playLog,
    team1Synergies,
    team2Synergies,
    currentMatchup,
    userPlayerIds,
    team1,
    team2,
  } = useSimulation();

  const { simulateFullSeries } = useSeriesSimulation();

  const seriesScore = getSeriesScore();
  const [showBoxscore, setShowBoxscore] = useState(false);
  const [showGameSummary, setShowGameSummary] = useState(false);
  const [lastGameIndex, setLastGameIndex] = useState(-1);
  const [speed, setSpeed] = useState<SimulationSpeed>('fast');
  const [isPaused, setIsPaused] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isQuickSeries, setIsQuickSeries] = useState(false);
  const quickAutoStarted = useRef(false);

  // Quick Play: auto-start quick series immediately
  useEffect(() => {
    if (state.gameMode === 'quick' && !series && !quickAutoStarted.current) {
      quickAutoStarted.current = true;
      setIsQuickSeries(true);
      simulateFullSeries();
    }
  }, [state.gameMode, series, simulateFullSeries]);

  // Highlight system
  const [highlight, setHighlight] = useState<{ message: string; type: 'homerun' | 'walkoff' | 'strikeout' | 'double' | 'triple' | 'save' | 'win' } | null>(null);
  const prevPlayLogLen = useRef(0);

  // Watch play log for highlight-worthy events
  useEffect(() => {
    if (playLog.length > prevPlayLogLen.current) {
      const newPlays = playLog.slice(prevPlayLogLen.current);
      for (const play of newPlays) {
        if (play.type === 'homerun') {
          setHighlight({ message: `${play.batterName} - HOME RUN!`, type: 'homerun' });
          playSound('homerun');
          break;
        }
        if (play.type === 'walkoff') {
          setHighlight({ message: 'WALK-OFF WIN!', type: 'walkoff' });
          playSound('walkoff');
          break;
        }
        if (play.type === 'triple') {
          setHighlight({ message: `${play.batterName} - TRIPLE!`, type: 'triple' });
          break;
        }
      }
    }
    prevPlayLogLen.current = playLog.length;
  }, [playLog]);

  // Track when a game ends to show game summary (skip if quick series)
  useEffect(() => {
    if (series && series.games.length > 0 && series.games.length > lastGameIndex + 1) {
      setLastGameIndex(series.games.length - 1);
      if (!isQuickSeries) {
        setShowGameSummary(true);
      }
    }
  }, [series?.games.length, lastGameIndex, isQuickSeries]);

  // Show celebration when series ends (game-by-game mode)
  useEffect(() => {
    if (!isQuickSeries && isSeriesOver() && !showCelebration && !showRecap && lastGameIndex >= 0) {
      // Delay slightly so game summary shows first
      const t = setTimeout(() => {
        setShowGameSummary(false);
        setShowCelebration(true);
        playSound('series_win');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isQuickSeries, isSeriesOver, showCelebration, showRecap, lastGameIndex, playSound]);

  // Show recap when quick series completes
  useEffect(() => {
    if (isQuickSeries && isSeriesOver()) {
      if (state.gameMode === 'quick') {
        // Skip celebration overlay in quick mode, go straight to recap
        setShowRecap(true);
        playSound('series_win');
      } else {
        setShowCelebration(true);
        playSound('series_win');
      }
    }
  }, [isQuickSeries, isSeriesOver, playSound, state.gameMode]);

  // Record CPU game result for adaptive difficulty
  const cpuResultRecorded = useRef(false);
  useEffect(() => {
    if (isSeriesOver() && state.isCPU && !cpuResultRecorded.current) {
      cpuResultRecorded.current = true;
      const score = getSeriesScore();
      const winsTarget = state.gameMode === 'quick' ? 1 : 4;
      const playerWon = score.player1 >= winsTarget;
      recordCpuGameResult(playerWon, [score.player1, score.player2]);
    }
  }, [isSeriesOver, state.isCPU, getSeriesScore]);

  // Earn collection rewards when series ends
  const rewardRecorded = useRef(false);
  useEffect(() => {
    if (isSeriesOver() && !rewardRecorded.current) {
      rewardRecorded.current = true;
      const score = getSeriesScore();
      const rewardWinsTarget = state.gameMode === 'quick' ? 1 : 4;
      const won = score.player1 >= rewardWinsTarget;
      const swept = won ? score.player2 === 0 : score.player1 === 0;
      const reward = earnGameReward(won, swept, false);
      setGameReward(reward);
    }
  }, [isSeriesOver, getSeriesScore, earnGameReward]);

  // Auto-start next game after summary dismissed
  const handleSummaryDismiss = useCallback(() => {
    setShowGameSummary(false);
    if (isSeriesOver()) {
      setShowCelebration(true);
    } else if (series) {
      // Auto-start next game
      startGame(series.games.length + 1);
    }
  }, [isSeriesOver, series, startGame]);

  // Handle quick series
  const handleQuickSeries = useCallback(() => {
    setIsQuickSeries(true);
    simulateFullSeries();
  }, [simulateFullSeries]);

  // Determine team names for a specific game based on home/away
  const getTeamNamesForGame = useCallback((gameNum: number) => {
    if (!series) return { away: state.team1.name, home: state.team2.name };

    const isHomeGame = [1, 2, 6, 7].includes(gameNum);
    const homeTeam = isHomeGame ? series.homeTeam : (series.homeTeam === 'player1' ? 'player2' : 'player1');

    return {
      away: homeTeam === 'player1' ? state.team2.name : state.team1.name,
      home: homeTeam === 'player1' ? state.team1.name : state.team2.name,
    };
  }, [series, state.team1.name, state.team2.name]);

  const teamNames = getTeamNamesForGame(series ? series.games.length + 1 : 1);
  const summaryTeamNames = getTeamNamesForGame(lastGameIndex + 1);

  // Get synergies for current matchup
  const getBatterSynergies = useCallback(() => {
    if (!currentMatchup) return { teamSynergies: [], batteryBonus: null };
    return currentMatchup.batterTeam === 'player1' ? team1Synergies : team2Synergies;
  }, [currentMatchup, team1Synergies, team2Synergies]);

  const getPitcherSynergies = useCallback(() => {
    if (!currentMatchup) return { teamSynergies: [], batteryBonus: null };
    return currentMatchup.pitcherTeam === 'player1' ? team1Synergies : team2Synergies;
  }, [currentMatchup, team1Synergies, team2Synergies]);

  // Skip to end of inning
  const handleSkipInning = useCallback(() => {
    if (!currentGame || isPaused) return;
    setSpeed('instant');
    simulateHalfInning();
    setTimeout(() => setSpeed('fast'), 100);
  }, [currentGame, isPaused, simulateHalfInning]);

  // Auto-continue simulation
  useEffect(() => {
    if (currentGame && !isSeriesOver() && !showBoxscore && !showGameSummary && !isPaused && !highlight) {
      const delay = getSpeedDelay(speed);
      const timer = setTimeout(() => {
        simulateHalfInning();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [currentGame, simulateHalfInning, isSeriesOver, showBoxscore, showGameSummary, isPaused, speed, highlight]);

  // Auto-start first game when series begins (game-by-game mode)
  useEffect(() => {
    if (series && !isQuickSeries && series.games.length === 0 && !currentGame) {
      startGame(1);
    }
  }, [series, isQuickSeries, currentGame, startGame]);

  // Create a map of players for the EnhancedPlayLog
  const playersMap = new Map<string, Player>();
  team1.roster.forEach(p => playersMap.set(p.id, p));
  team2.roster.forEach(p => playersMap.set(p.id, p));

  return (
    <div className="simulation-screen">
      <div className="sim-header">
        <h2>{state.gameMode === 'quick' ? 'Quick Game' : 'World Series'}</h2>
      </div>

      <div className="sim-content">
        <div className="sim-main">
          {series && <SeriesTracker series={series} team1Name={state.team1.name} team2Name={state.team2.name} />}

          {currentGame && (
            <>
              <div className="game-display">
                <Scoreboard
                  gameState={currentGame}
                  awayTeamName={teamNames.away}
                  homeTeamName={teamNames.home}
                />
              </div>

              <GameSituationBanner gameState={currentGame} />

              <MatchupDisplay
                batter={currentMatchup?.batter || null}
                pitcher={currentMatchup?.pitcher || null}
                batterSynergies={getBatterSynergies()}
                pitcherSynergies={getPitcherSynergies()}
                batterTeamName={currentMatchup?.batterTeam === 'player1' ? state.team1.name : state.team2.name}
                pitcherTeamName={currentMatchup?.pitcherTeam === 'player1' ? state.team1.name : state.team2.name}
              />

              <SpeedControls
                speed={speed}
                onSpeedChange={setSpeed}
                isPaused={isPaused}
                onTogglePause={() => setIsPaused(!isPaused)}
                onSkipInning={handleSkipInning}
              />
            </>
          )}

          <div className="sim-controls">
            {!series && state.gameMode !== 'quick' && (
              <div className="series-start-options">
                <Button variant="primary" size="lg" onClick={startSeries}>
                  Watch Game-by-Game
                </Button>
                <Button variant="success" size="lg" onClick={handleQuickSeries}>
                  Quick Sim + Recap
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="sim-sidebar">
          <EnhancedPlayLog
            plays={playLog}
            userPlayerIds={userPlayerIds}
            players={playersMap}
          />
        </div>
      </div>

      {/* Mid-Series Stats Sidebar */}
      {series && series.games.length > 0 && (
        <SeriesStatsSidebar
          series={series}
          team1Roster={team1.roster}
          team2Roster={team2.roster}
        />
      )}

      {/* In-game highlight banner */}
      {highlight && (
        <GameHighlight
          message={highlight.message}
          type={highlight.type}
          onDone={() => setHighlight(null)}
        />
      )}

      {/* Game Summary after each game */}
      {showGameSummary && series && series.games[lastGameIndex] && !showCelebration && (
        <GameSummary
          game={series.games[lastGameIndex]}
          gameNumber={lastGameIndex + 1}
          awayName={summaryTeamNames.away}
          homeName={summaryTeamNames.home}
          onContinue={handleSummaryDismiss}
        />
      )}

      {/* Boxscore Modal (accessible from recap) */}
      {showBoxscore && series && series.games[lastGameIndex]?.boxScore && (
        <Boxscore
          boxScore={series.games[lastGameIndex].boxScore as GameBoxScore}
          awayTeamName={summaryTeamNames.away}
          homeTeamName={summaryTeamNames.home}
          lineScore={series.games[lastGameIndex].boxScore?.lineScore || [[], []]}
          onClose={() => setShowBoxscore(false)}
        />
      )}

      {/* Game Rewards */}
      {gameReward && !showCelebration && !showRecap && (
        <RewardModal
          packs={gameReward.packs}
          stubs={gameReward.stubs}
          xp={gameReward.xp}
          milestones={gameReward.milestones}
          onOpenPacks={() => {
            setGameReward(null);
            onOpenPacks();
          }}
          onDismiss={() => setGameReward(null)}
        />
      )}

      {/* Series Celebration */}
      {showCelebration && !showRecap && !gameReward && (
        <SeriesCelebration
          winner={seriesScore.player1 >= (state.gameMode === 'quick' ? 1 : 4) ? state.team1.name : state.team2.name}
          seriesScore={`Series: ${seriesScore.player1} - ${seriesScore.player2}`}
          onContinue={() => { setShowCelebration(false); setShowRecap(true); }}
        />
      )}

      {/* Series Recap */}
      {showRecap && series && isSeriesOver() && (
        <div className="recap-modal-overlay">
          <SeriesRecap
            series={series}
            team1={team1}
            team2={team2}
            onViewFullStats={() => {
              setShowRecap(false);
              setShowBoxscore(true);
            }}
            onPlayAgain={() => dispatch({ type: 'RESET_GAME' })}
            onGoHome={() => dispatch({ type: 'RESET_GAME' })}
            team1Name={state.team1.name}
            team2Name={state.team2.name}
            isQuickGame={state.gameMode === 'quick'}
          />
        </div>
      )}
    </div>
  );
}

function ResultsScreen() {
  const { state, dispatch } = useGame();
  const { series } = state;

  if (!series) return null;

  const player1Wins = series.games.filter(g => g.winner === 'player1').length;
  const player2Wins = series.games.filter(g => g.winner === 'player2').length;
  const winner = player1Wins === 4 ? state.team1.name : state.team2.name;

  return (
    <div className="results-screen">
      <div className="results-content">
        <div className="trophy">🏆</div>
        <h1>{winner} Wins!</h1>
        <h2>World Series Champions</h2>

        <div className="final-series-score">
          <span className={player1Wins === 4 ? 'winner' : ''}>{state.team1.name}: {player1Wins}</span>
          <span className="divider">-</span>
          <span className={player2Wins === 4 ? 'winner' : ''}>{state.team2.name}: {player2Wins}</span>
        </div>

        <div className="game-results">
          {series.games.map((game, index) => (
            <div key={index} className="game-result-row">
              <span className="game-label">Game {index + 1}</span>
              <span className={`score ${game.winner === 'player1' ? 'p1-win' : 'p2-win'}`}>
                {game.score[0]} - {game.score[1]}
              </span>
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => dispatch({ type: 'RESET_GAME' })}
        >
          Play Again
        </Button>
      </div>
    </div>
  );
}

export function App() {
  const { state, dispatch: appDispatch } = useGame();
  const { isMuted, toggleMute } = useSound();
  const [appMode, setAppMode] = useState<AppMode>('menu');
  const [onlineMatchId, setOnlineMatchId] = useState<string | null>(null);
  const [playerNames, setPlayerNames] = useState<{ player1: string; player2: string } | undefined>(undefined);

  // Quick Play: auto-setup lineups and skip team-setup screen
  useEffect(() => {
    if (state.gameMode !== 'quick' || state.phase !== 'team-setup') return;

    // Auto-generate lineups for both teams
    const t1Lineup = generateOptimalLineup(state.team1.roster);
    const t1Rotation = generateOptimalRotation(state.team1.roster);
    const t1BP = generateOptimalBullpen(state.team1.roster);
    appDispatch({ type: 'SET_BATTING_ORDER', team: 'player1', order: t1Lineup.map(e => e.player) });
    appDispatch({ type: 'SET_ROTATION', team: 'player1', rotation: t1Rotation });
    if (t1BP.closer) appDispatch({ type: 'SET_CLOSER', team: 'player1', closer: t1BP.closer });
    appDispatch({ type: 'SET_BULLPEN', team: 'player1', bullpen: [...t1BP.setup, ...t1BP.middleRelief, ...t1BP.longRelief] });

    const t2Lineup = generateOptimalLineup(state.team2.roster);
    const t2Rotation = generateOptimalRotation(state.team2.roster);
    const t2BP = generateOptimalBullpen(state.team2.roster);
    appDispatch({ type: 'SET_BATTING_ORDER', team: 'player2', order: t2Lineup.map(e => e.player) });
    appDispatch({ type: 'SET_ROTATION', team: 'player2', rotation: t2Rotation });
    if (t2BP.closer) appDispatch({ type: 'SET_CLOSER', team: 'player2', closer: t2BP.closer });
    appDispatch({ type: 'SET_BULLPEN', team: 'player2', bullpen: [...t2BP.setup, ...t2BP.middleRelief, ...t2BP.longRelief] });

    appDispatch({ type: 'FINISH_TEAM_SETUP' });
  }, [state.gameMode, state.phase, state.team1.roster, state.team2.roster, appDispatch]);

  const handleModeChange = useCallback((mode: AppMode) => {
    setAppMode(mode);
  }, []);

  const handleMatchFound = useCallback((matchId: string) => {
    setOnlineMatchId(matchId);
    setAppMode('online_draft');
  }, []);

  const handleBackToMenu = useCallback(() => {
    setAppMode('menu');
    setOnlineMatchId(null);
    setPlayerNames(undefined);
  }, []);

  // Determine header subtitle
  const getSubtitle = () => {
    if (appMode === 'collection') return 'My Collection';
    if (appMode === 'shop') return 'Pack Shop';
    if (appMode === 'matchmaking') return 'Finding Opponent...';
    if (appMode === 'online_draft') return 'Online Draft';
    if (appMode === 'online_team_setup') return 'Online Team Setup';
    if (appMode === 'online_simulation') return 'Online World Series';
    if (appMode === 'leaderboard') return 'Leaderboard';
    if (appMode === 'profile') return 'Player Profile';
    if (state.phase === 'start') return 'Ready to Draft';
    if (state.phase === 'draft') return `Draft Phase - Pick ${state.pickNumber}/52`;
    if (state.phase === 'team-setup') return 'Team Setup Phase';
    if (state.phase === 'simulation') return 'World Series';
    if (state.phase === 'results') return 'Final Results';
    return '';
  };

  // Render online screens
  const renderOnlineScreen = () => {
    switch (appMode) {
      case 'matchmaking':
        return (
          <MatchmakingScreen
            onMatchFound={handleMatchFound}
            onCancel={handleBackToMenu}
          />
        );
      case 'online_draft':
        return (
          <OnlineDraftScreen
            matchId={onlineMatchId!}
            onPhaseComplete={() => setAppMode('online_team_setup')}
            onAbandon={handleBackToMenu}
          />
        );
      case 'online_team_setup':
        return (
          <OnlineTeamSetupScreen
            matchId={onlineMatchId!}
            onPhaseComplete={() => setAppMode('online_simulation')}
            onAbandon={handleBackToMenu}
          />
        );
      case 'online_simulation':
        return (
          <OnlineSimulationScreen
            matchId={onlineMatchId!}
            onComplete={handleBackToMenu}
          />
        );
      case 'leaderboard':
        return <LeaderboardScreen onBack={handleBackToMenu} />;
      case 'profile':
        return <ProfilePage onBack={handleBackToMenu} />;
      default:
        return null;
    }
  };

  const isOnlineMode = ['matchmaking', 'online_draft', 'online_team_setup', 'online_simulation', 'leaderboard', 'profile'].includes(appMode);
  const isCollectionMode = appMode === 'collection' || appMode === 'shop';
  const showBackButton = isOnlineMode || appMode === 'local-multiplayer' || isCollectionMode;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          {showBackButton && (
            <button className="header-back" onClick={handleBackToMenu}>
              Back
            </button>
          )}
          <h1><img src="/logo-icon.svg" alt="" className="logo-icon" />Dugout Draft</h1>
        </div>
        <p className="header-subtitle">{getSubtitle()}</p>
        <div className="header-right">
          <button
            className="mute-toggle"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Sound off' : 'Sound on'}
          >
            {isMuted ? '\u{1F507}' : '\u{1F50A}'}
          </button>
          <ProfileButton />
        </div>
      </header>

      <main className="container">
        {appMode === 'collection' ? (
          <CollectionScreen onBack={handleBackToMenu} />
        ) : appMode === 'shop' ? (
          <PackShop onBack={handleBackToMenu} />
        ) : appMode === 'local-multiplayer' ? (
          <LocalMultiplayerFlow onBack={handleBackToMenu} />
        ) : isOnlineMode ? (
          renderOnlineScreen()
        ) : (
          <>
            {state.phase === 'start' && <StartScreen onModeChange={handleModeChange} onStartPassPlay={setPlayerNames} />}
            {state.phase === 'draft' && <DraftScreen playerNames={playerNames} />}
            {state.phase === 'team-setup' && <TeamSetupScreen />}
            {state.phase === 'simulation' && <SimulationScreen onOpenPacks={() => setAppMode('shop')} />}
            {state.phase === 'results' && <ResultsScreen />}
          </>
        )}
      </main>
      <InstallPrompt />
    </div>
  );
}
