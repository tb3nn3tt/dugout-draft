/**
 * Dugout Gauntlet — headless balance + calibration harness.
 *
 *   npm run balance        (from gauntlet/)
 *
 * Codifies the overnight verification so any sim / draft / matchmaking / famous-
 * team change can be re-checked in one command. NOT part of the app build
 * (lives outside src/). Prints four things and flags anything out of band:
 *   1. Sim calibration — all-50 vs all-50 per-PA rates vs MLB anchors.
 *   2. Run environment — combined runs/game across the famous ladder.
 *   3. Difficulty curve — streak distribution for best/mid/worst drafters.
 *   4. Smoke — every run mode drafts a legal team + plays valid series.
 *
 * Targets (edit if you intentionally move the design):
 *   K ~22.5%  BB ~8.5%  HR ~3.3%  AVG ~.248   (MLB league anchors)
 *   combined runs/game ~8-9 (MLB)  — currently runs hot, see overnight-todo
 *   streak: best-drafter median ~5, worst ~3, in the ~4-12 band
 */
import { simulateAtBat } from '../src/domain/sim/simulation';
import { playSeries } from '../src/domain/sim/series';
import { buildSimTeam } from '../src/domain/sim/buildTeam';
import { findOpponent } from '../src/domain/matchmaking';
import { FAMOUS_TEAMS, buildFamousTeam } from '../src/domain/famousTeams';
import { gauntletReducer, initialState, GauntletState } from '../src/state/gauntletReducer';
import { MUTATORS, getMutator } from '../src/domain/mutators';
import { playersPool, managersPool, stadiumsPool } from '../src/domain/players';
import { getRatings } from '../src/domain/ratings';
import { seedRng } from '../src/domain/sim/rng';

(globalThis as any).localStorage ??= {
  _d: {} as Record<string, string>,
  getItem(k: string) { return this._d[k] ?? null; },
  setItem(k: string, v: string) { this._d[k] = v; },
};

const band = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? 'ok ' : '⚠  ');

// ---- 1. Calibration: all-50, HAND-BALANCED --------------------------------
// IMPORTANT: sample over batter-hand × pitcher-hand evenly. The platoon split in
// deriveHitter makes a grades-50 hitter below-average vs same-hand and above vs
// opposite-hand; sampling only RHBvRHP measures the disadvantaged side and falsely
// reads "drifted" (K 25.8 / AVG .225). Balanced, the engine hits MLB by identity.
// Also note the 'walk' outcome folds in HBP, so its target is ~9.6 (BB+HBP), not 8.5.
function calibration() {
  seedRng(7);
  let uid = 0;
  const avg = (pos: string, bats: string, throws: string) => ({
    id: 'cal' + (uid++), name: pos, team: 'AVG', positions: [pos], bats, throws,
    stats: { avg: .25, obp: .32, slg: .4, hr: 20, speed: 50 }, overall: 70,
    grades: { contact: 50, power: 50, speed: 50, eye: 50, fielding: 50, arm: 50, fastball: 50, breaking: 50, changeup: 50, control: 50, stamina: 50 },
  } as any);
  const c: Record<string, number> = {}; const per = 150000; let N = 0;
  for (const [bh, ph] of [['R', 'R'], ['R', 'L'], ['L', 'R'], ['L', 'L']] as [string, string][]) {
    const b = avg('LF', bh, 'R'), p = avg('SP', 'R', ph);
    for (let i = 0; i < per; i++) { const r = simulateAtBat(b, p, undefined, undefined, undefined, undefined) as unknown as string; c[r] = (c[r] || 0) + 1; N++; }
  }
  const g = (k: string) => c[k] || 0;
  const K = g('strikeout') / N * 100, BB = g('walk') / N * 100, HR = g('homerun') / N * 100;
  const hits = g('single') + g('double') + g('triple') + g('homerun');
  const ab = N - g('walk') - g('hbp') - g('sacrifice') - g('sac_fly') - g('sacrifice_fly');
  const AVG = hits / ab;
  console.log('1) CALIBRATION (all-50, hand-balanced):');
  console.log(`   ${band(K, 21, 24)}K       ${K.toFixed(1)}%  (target ~22.5)`);
  console.log(`   ${band(BB, 8.5, 10.7)}BB+HBP  ${BB.toFixed(1)}%  (target ~9.6)`);
  console.log(`   ${band(HR, 2.9, 3.7)}HR      ${HR.toFixed(2)}%  (target ~3.3)`);
  console.log(`   ${band(AVG, .242, .260)}AVG     ${AVG.toFixed(3)}  (target ~.248)`);
}

// ---- draft helpers ---------------------------------------------------------
function draft(seed: number, mode: 'best' | 'mid' | 'worst', mutatorId = 'standard'): GauntletState {
  seedRng(seed);
  let s = gauntletReducer(initialState, { type: 'START_RUN', teamName: 'T', seed, mutatorId });
  let g = 0;
  while (s.phase === 'drafting' && g++ < 40) {
    const o = [...s.offered].sort((a, b) => b.overall - a.overall);
    const pick = mode === 'best' ? o[0] : mode === 'worst' ? o[o.length - 1] : o[o.length >> 1];
    s = gauntletReducer(s, { type: 'PICK', player: pick });
  }
  // Draft now ends at the roster editor — lock it in to build the team + start.
  if (s.phase === 'roster_review') s = gauntletReducer(s, { type: 'SUBMIT_ROSTER' });
  return s;
}
function runGauntlet(team: GauntletState['team']): number {
  const you = buildSimTeam(team!, 'player1'); const ex = new Set<string>(); let st = 0, g = 0;
  while (g++ < 60) {
    const o = findOpponent(st, [], ex); if (o.id) ex.add(o.id);
    const r = playSeries(you, buildSimTeam(o.team, 'player2'));
    if (r.winner === 'you') st++; else break;
  }
  return st;
}
const stat = (a: number[]) => { a.sort((x, y) => x - y); const n = a.length; return { mean: a.reduce((x, y) => x + y, 0) / n, med: a[n >> 1], p90: a[Math.floor(n * .9)], max: a[n - 1], dieEarly: a.filter(x => x <= 2).length / n * 100 }; };

// ---- 2. Run environment ----------------------------------------------------
function runEnvironment() {
  const s = draft(55, 'best'); const you = buildSimTeam(s.team!, 'player1');
  const combined: number[] = [];
  for (const ft of FAMOUS_TEAMS) {
    const opp = buildSimTeam(buildFamousTeam(ft), 'player2');
    for (let i = 0; i < 25; i++) { const r = playSeries(you, opp); const gp = r.youWins + r.oppWins; combined.push((r.youRuns + r.oppRuns) / gp); }
  }
  const m = combined.reduce((a, b) => a + b, 0) / combined.length;
  console.log('\n2) RUN ENVIRONMENT (combined runs/game across the ladder):');
  console.log(`   ${band(m, 7, 10)}mean ${m.toFixed(1)}  (MLB ~8.5; currently runs hot — see overnight-todo)`);
}

// ---- 3. Difficulty curve ---------------------------------------------------
function difficultyCurve() {
  console.log('\n3) DIFFICULTY CURVE (streak distribution, 150 runs each):');
  const N = 150;
  for (const mode of ['best', 'mid', 'worst'] as const) {
    const ss: number[] = [];
    for (let i = 0; i < N; i++) ss.push(runGauntlet(draft(3000 + i, mode).team));
    const st = stat(ss);
    console.log(`   [${mode.padEnd(5)}] mean ${st.mean.toFixed(2)} | median ${st.med} | p90 ${st.p90} | max ${st.max} | %die≤2 ${st.dieEarly.toFixed(0)}%`);
  }
}

// ---- 4. Smoke across run modes --------------------------------------------
function smoke() {
  console.log('\n4) SMOKE (all run modes draft + play valid series):');
  let ok = 0, fail = 0;
  for (const mut of MUTATORS) {
    const s = draft(900 + mut.id.length, 'best', mut.id);
    const legal = s.phase === 'gauntlet' && !!s.team && s.team.roster.length >= 20 && !!s.team.manager && !!s.team.stadium;
    const you = buildSimTeam(s.team!, 'player1'); const env = getMutator(mut.id).env;
    const r = playSeries(you, buildSimTeam(findOpponent(0, [], new Set()).team, 'player2'), env);
    const valid = isFinite(r.youRuns) && isFinite(r.oppRuns) && (r.youWins + r.oppWins) >= 4;
    if (legal && valid) ok++; else { fail++; console.log(`   FAIL ${mut.id}: legal=${legal} valid=${valid}`); }
  }
  console.log(`   ${fail === 0 ? 'ok ' : '⚠  '}${ok}/${MUTATORS.length} run modes pass`);
}

// ---- 5. Data integrity ----------------------------------------------------
function integrity() {
  const VALID_POS = new Set(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY', 'BC', 'PH', 'PR', 'IFD', 'OFD', 'HC', 'ST']);
  let issues = 0; const ex: string[] = [];
  const flag = (id: string, m: string) => { issues++; if (ex.length < 8) ex.push(`${id}: ${m}`); };
  const seen = new Map<string, number>();
  for (const p of [...playersPool, ...managersPool, ...stadiumsPool]) seen.set(p.id, (seen.get(p.id) || 0) + 1);
  for (const [id, c] of seen) if (c > 1) flag(id, `duplicate id (${c}x)`);
  for (const p of playersPool) {
    if (!Array.isArray(p.positions) || !p.positions.length) flag(p.id, 'no positions');
    else for (const pos of p.positions) if (!VALID_POS.has(pos)) flag(p.id, `bad position '${pos}'`);
    if (!['L', 'R', 'S'].includes(p.bats as string)) flag(p.id, `bad bats '${p.bats}'`);
    if (!['L', 'R'].includes(p.throws as string)) flag(p.id, `bad throws '${p.throws}'`);
    if (typeof p.overall !== 'number' || p.overall < 0 || p.overall > 99) flag(p.id, `overall ${p.overall}`);
    try { const r: Record<string, unknown> = getRatings(p) as never; for (const v of Object.values(r)) if (typeof v === 'number' && !isFinite(v)) flag(p.id, 'NaN rating'); }
    catch (e) { flag(p.id, `getRatings threw: ${(e as Error).message}`); }
  }
  console.log('\n5) DATA INTEGRITY:');
  console.log(`   ${issues === 0 ? 'ok ' : '⚠  '}${issues === 0 ? 'clean' : issues + ' issue(s)'} across ${playersPool.length} players (bats must be L/R/S, positions/overall valid, ratings finite)`);
  for (const e of ex) console.log(`      ${e}`);
}

calibration();
runEnvironment();
difficultyCurve();
smoke();
integrity();
console.log('\nDone. ⚠ = out of target band (see header for targets).');
