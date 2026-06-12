import { useGauntlet } from './state/useGauntlet';
import { GhostTeam } from './domain/types';
import {
  MenuScreen, DraftScreen, MatchupScreen, SeriesResultScreen, RunOverScreen,
} from './ui/Screens';

// Phase 1: no ghost pool yet → matchmaking uses CPU fallback (cold-start).
// Stable reference so the matchmaking effect doesn't re-fire every render.
const EMPTY_POOL: GhostTeam[] = [];

export default function App() {
  const g = useGauntlet(EMPTY_POOL);
  const { phase } = g.state;

  return (
    <div className="app-shell">
      {phase === 'menu' && <MenuScreen g={g} />}
      {phase === 'drafting' && <DraftScreen g={g} />}
      {phase === 'matchmaking' && <MatchupScreen g={g} />}
      {phase === 'series' && <MatchupScreen g={g} />}
      {phase === 'series_result' && <SeriesResultScreen g={g} />}
      {phase === 'run_over' && <RunOverScreen g={g} />}
    </div>
  );
}
