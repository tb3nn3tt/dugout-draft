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
import { seedRng } from '../src/domain/sim/rng';

(globalThis as any).localStorage ??= {
  _d: {} as Record<string, string>,
  getItem(k: string) { return this._d[k] ?? null; },
  setItem(k: string, v: string) { this._d[k] = v; },
};

const band = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? 'ok ' : '⚠  ');

// ---- 1. Calibration: all-50 vs all-50 -------------------------------------
function calibration() {
  seedRng(7);
  const avg = (pos: string) => ({
    id: pos, name: pos, team: 'AVG', positions: [pos], bats: 'R', throws: 'R',
    stats: { avg: .25, obp: .32, slg: .4, hr: 20, speed: 50 }, overall: 70,
    grades: { contact: 50, power: 50, speed: 50, eye: 50, fielding: 50, arm: 50, fastball: 50, breaking: 50, changeup: 50, control: 50, stamina: 50 },
  } as any);
  const b = avg('LF'), p = avg('SP');
  const N = 400000; const c: Record<string, number> = {};
  for (let i = 0; i < N; i++) { const r = simulateAtBat(b, p, undefined, undefined, undefined, undefined) as unknown as string; c[r] = (c[r] || 0) + 1; }
  const g = (k: string) => c[k] || 0;
  const K = g('strikeout') / N * 100, BB = g('walk') / N * 100, HR = g('homerun') / N * 100;
  const hits = g('single') + g('double') + g('triple') + g('homerun');
  const ab = N - g('walk') - g('hbp') - g('sacrifice') - g('sac_fly') - g('sacrifice_fly');
  const AVG = hits / ab;
  console.log('1) CALIBRATION (all-50 vs all-50):');
  console.log(`   ${band(K, 21, 24)}K   ${K.toFixed(1)}%  (target ~22.5)`);
  console.log(`   ${band(BB, 7.5, 9.5)}BB  ${BB.toFixed(1)}%  (target ~8.5)`);
  console.log(`   ${band(HR, 2.9, 3.7)}HR  ${HR.toFixed(2)}%  (target ~3.3)`);
  console.log(`   ${band(AVG, .240, .256)}AVG ${AVG.toFixed(3)}  (target ~.248)`);
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

calibration();
runEnvironment();
difficultyCurve();
smoke();
console.log('\nDone. ⚠ = out of target band (see header for targets).');
