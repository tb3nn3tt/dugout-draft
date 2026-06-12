import {
  collection, addDoc, getDocs, query, orderBy, limit,
  doc, runTransaction,
} from 'firebase/firestore';
import { db, ensureAuth } from './firebase';
import { GauntletTeam } from '../domain/types';
import { hydrateIds, getCard } from '../domain/players';
import { buildSimTeam } from '../domain/sim/buildTeam';
import { playSeries } from '../domain/sim/series';
import { resetRng } from '../domain/sim/rng';

// ============================================================================
// Async elimination ladder. Submitted teams sit in a shared pool and get paired
// against others on the SAME number of ladder wins; the loser of each best-of-7
// is retired (logged forever), the winner climbs and re-queues. The global champ
// is the still-alive team with the most series won. Matches are simulated by
// whichever player's browser is open (clients-as-workers) — no server needed.
// ============================================================================

const COL = 'ladder_teams';

export interface LadderTeam {
  id: string;
  teamName: string;
  ownerName: string;
  ownerUid: string;
  playerIds: string[];
  managerId: string | null;
  stadiumId: string | null;
  gauntletStreak: number;     // famous-team streak achieved before submitting
  wins: number;               // ladder series won
  status: 'queued' | 'retired';
  runsFor: number;
  runsAgainst: number;
  createdAt: number;
  updatedAt: number;
}

export interface MatchSummary { winner: string; loser: string; score: string; atWins: number; }

function hydrate(t: { teamName: string; playerIds: string[]; managerId: string | null; stadiumId: string | null }): GauntletTeam {
  return {
    name: t.teamName,
    roster: hydrateIds(t.playerIds),
    manager: t.managerId ? getCard(t.managerId) ?? null : null,
    stadium: t.stadiumId ? getCard(t.stadiumId) ?? null : null,
  };
}

const MY_KEY = 'dugout-gauntlet-my-ladder';
/** Doc ids of teams this device has submitted (for highlighting on the ladder). */
export function getMyTeamIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MY_KEY) || '[]') as string[]); }
  catch { return new Set(); }
}
function recordMyTeam(id: string): void {
  try {
    const a = JSON.parse(localStorage.getItem(MY_KEY) || '[]') as string[];
    if (!a.includes(id)) { a.push(id); localStorage.setItem(MY_KEY, JSON.stringify(a)); }
  } catch { /* ignore */ }
}

/** Submit a finished gauntlet team into the ladder at 0 wins. Returns the doc id. */
export async function submitTeam(team: GauntletTeam, gauntletStreak: number, ownerName: string): Promise<string> {
  const uid = await ensureAuth();
  const ref = await addDoc(collection(db, COL), {
    teamName: team.name,
    ownerName,
    ownerUid: uid,
    playerIds: team.roster.map(p => p.id),
    managerId: team.manager?.id ?? null,
    stadiumId: team.stadium?.id ?? null,
    gauntletStreak,
    wins: 0,
    status: 'queued',
    runsFor: 0,
    runsAgainst: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  recordMyTeam(ref.id);
  return ref.id;
}

/** Top teams by wins (queued + retired) for the global leaderboard. */
export async function getLadder(n = 50): Promise<LadderTeam[]> {
  const qs = await getDocs(query(collection(db, COL), orderBy('wins', 'desc'), limit(n)));
  return qs.docs.map(d => ({ id: d.id, ...(d.data() as Omit<LadderTeam, 'id'>) }));
}

/** The reigning champ: the still-alive team with the most wins. */
export async function getChamp(): Promise<LadderTeam | null> {
  const top = await getLadder(60);
  return top.find(t => t.status === 'queued') ?? null;
}

/**
 * Process one ladder match (clients-as-workers). Pairs two queued teams on equal
 * (or nearest) wins, sims the series in a transaction so two browsers can't
 * double-process the same teams, retires the loser, advances the winner.
 */
export async function processOneMatch(): Promise<MatchSummary | null> {
  // Pull a window of teams by wins; filter to queued client-side (no composite index).
  const qs = await getDocs(query(collection(db, COL), orderBy('wins', 'desc'), limit(80)));
  const queued = qs.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<LadderTeam, 'id'>) }))
    .filter(t => t.status === 'queued');
  if (queued.length < 2) return null;

  // Pick an adjacent pair with equal wins (different owners preferred), else nearest.
  let a: LadderTeam | null = null, b: LadderTeam | null = null;
  for (let i = 0; i < queued.length - 1; i++) {
    if (queued[i].wins === queued[i + 1].wins && queued[i].ownerUid !== queued[i + 1].ownerUid) {
      a = queued[i]; b = queued[i + 1]; break;
    }
  }
  if (!a) { a = queued[0]; b = queued[1]; }

  return runTransaction(db, async (tx) => {
    const aRef = doc(db, COL, a!.id), bRef = doc(db, COL, b!.id);
    const [aS, bS] = [await tx.get(aRef), await tx.get(bRef)];
    if (!aS.exists() || !bS.exists()) return null;
    const ad = aS.data() as LadderTeam, bd = bS.data() as LadderTeam;
    if (ad.status !== 'queued' || bd.status !== 'queued') return null; // already taken

    resetRng(); // ladder matches use real randomness, not a run seed
    const r = playSeries(buildSimTeam(hydrate(ad), 'player1'), buildSimTeam(hydrate(bd), 'player2'));
    const aWon = r.winner === 'you';
    const now = Date.now();

    tx.update(aRef, aWon
      ? { wins: ad.wins + 1, runsFor: ad.runsFor + r.youRuns, runsAgainst: ad.runsAgainst + r.oppRuns, updatedAt: now }
      : { status: 'retired', runsFor: ad.runsFor + r.youRuns, runsAgainst: ad.runsAgainst + r.oppRuns, updatedAt: now });
    tx.update(bRef, !aWon
      ? { wins: bd.wins + 1, runsFor: bd.runsFor + r.oppRuns, runsAgainst: bd.runsAgainst + r.youRuns, updatedAt: now }
      : { status: 'retired', runsFor: bd.runsFor + r.oppRuns, runsAgainst: bd.runsAgainst + r.youRuns, updatedAt: now });

    return {
      winner: aWon ? ad.teamName : bd.teamName,
      loser: aWon ? bd.teamName : ad.teamName,
      score: `${Math.max(r.youWins, r.oppWins)}-${Math.min(r.youWins, r.oppWins)}`,
      atWins: ad.wins,
    };
  });
}

/** Run up to n matches — called when a player has the app open. */
export async function tickLadder(n = 4): Promise<number> {
  let played = 0;
  for (let i = 0; i < n; i++) {
    try {
      const r = await processOneMatch();
      if (r) played++; else break;
    } catch { break; }
  }
  return played;
}
