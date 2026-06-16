import { collection, addDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db, ensureAuth } from './firebase';

// ============================================================================
// Daily Challenge leaderboard. Stored in the existing `match_history` collection
// (deployed rules already allow authed-create + public-read), tagged with a
// `dailyDate` field so a single equality query fetches just that day's scores —
// no composite index, no rules redeploy. Sorted client-side (streak, then diff).
// ============================================================================

const COL = 'match_history';

export interface DailyScore {
  id: string;
  dailyDate: string;
  handle: string;
  teamName: string;
  streak: number;
  runDiff: number;
  mutatorId: string;
  createdAt: number;
}

/** Post a finished daily-challenge result. One device may post several. */
export async function submitDailyScore(
  dailyDate: string, handle: string, teamName: string, streak: number, runDiff: number, mutatorId: string,
): Promise<void> {
  const uid = await ensureAuth();
  await addDoc(collection(db, COL), {
    dailyDate, handle, teamName, streak, runDiff, mutatorId,
    ownerUid: uid, createdAt: Date.now(),
  });
}

/** Today's leaderboard, best first (streak, then run differential). */
export async function getDailyScores(dailyDate: string, n = 100): Promise<DailyScore[]> {
  const qs = await getDocs(query(collection(db, COL), where('dailyDate', '==', dailyDate), limit(400)));
  return qs.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<DailyScore, 'id'>) }))
    .sort((a, b) => b.streak - a.streak || b.runDiff - a.runDiff)
    .slice(0, n);
}
