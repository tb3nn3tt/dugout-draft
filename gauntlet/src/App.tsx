import { useEffect, useState } from 'react';
import { useGauntlet } from './state/useGauntlet';
import { GhostTeam } from './domain/types';
import { ensureAuth } from './firebase/firebase';
import { tickLadder, getGhostPool } from './firebase/ladder';
import {
  MenuScreen, DraftScreen, RosterReviewScreen, GauntletRunScreen, RunOverScreen,
} from './ui/Screens';

export default function App() {
  // Real submitted teams from the global ladder become mid-gauntlet opponents.
  const [ghostPool, setGhostPool] = useState<GhostTeam[]>([]);
  const g = useGauntlet(ghostPool);
  const { phase } = g.state;

  // On load: sign in, advance a few ladder matches (clients-as-workers), and pull
  // the ghost pool so the gauntlet can throw real teams at you.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureAuth();
        await tickLadder(3);
        const pool = await getGhostPool(50);
        if (alive) setGhostPool(pool);
      } catch { /* offline is fine — gauntlet falls back to famous/CPU teams */ }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="app-shell">
      {phase === 'menu' && <MenuScreen g={g} />}
      {phase === 'drafting' && <DraftScreen g={g} />}
      {phase === 'roster_review' && <RosterReviewScreen g={g} />}
      {phase === 'gauntlet' && <GauntletRunScreen g={g} />}
      {phase === 'run_over' && <RunOverScreen g={g} />}
    </div>
  );
}
