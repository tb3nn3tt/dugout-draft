import { GameResult } from './types';
import { SeriesResult } from './sim/series';
import { getDisplayName } from './sim/helpers';

// ============================================================================
// Series awards — mine the box scores for the standout performances that make a
// result worth sharing ("Trout went .520 with 5 bombs this series").
// ============================================================================

export interface BatterLine {
  name: string; ab: number; h: number; hr: number; rbi: number; bb: number; r: number;
}
export interface PitcherLine {
  name: string; ip: number; so: number; er: number; h: number; w: number; s: number;
}

export interface SeriesAwards {
  mvp: (BatterLine & { avg: number; ops: number }) | null;
  ace: (PitcherLine & { era: number }) | null;
}

function aggregate(games: GameResult[], yourIds: Set<string>) {
  const bat = new Map<string, BatterLine>();
  const pit = new Map<string, PitcherLine>();

  for (const g of games) {
    if (!g.boxScore) continue;
    for (const side of [g.boxScore.away, g.boxScore.home]) {
      for (const b of side.batters) {
        if (!yourIds.has(b.playerId)) continue;
        const cur = bat.get(b.playerId) ?? { name: b.name, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, r: 0 };
        cur.ab += b.ab; cur.h += b.h; cur.hr += b.hr; cur.rbi += b.rbi; cur.bb += b.bb; cur.r += b.r;
        bat.set(b.playerId, cur);
      }
      for (const p of side.pitchers) {
        if (!yourIds.has(p.playerId)) continue;
        const cur = pit.get(p.playerId) ?? { name: p.name, ip: 0, so: 0, er: 0, h: 0, w: 0, s: 0 };
        cur.ip += p.ip; cur.so += p.so; cur.er += p.er; cur.h += p.h;
        if (p.decision === 'W') cur.w++;
        if (p.decision === 'S') cur.s++;
        pit.set(p.playerId, cur);
      }
    }
  }
  return { bat: [...bat.values()], pit: [...pit.values()] };
}

/** Choose the MVP hitter + ace pitcher from aggregated lines. */
function pickAwards(bat: BatterLine[], pit: PitcherLine[], minAb: number, minIp: number): SeriesAwards {
  let mvp: SeriesAwards['mvp'] = null;
  let bestScore = -1;
  for (const b of bat) {
    if (b.ab < minAb) continue;
    const score = b.hr * 4 + b.rbi * 1.5 + b.h + b.r * 0.5 + b.bb * 0.5;
    if (score > bestScore) {
      bestScore = score;
      const avg = b.ab > 0 ? b.h / b.ab : 0;
      const ops = avg + (b.ab > 0 ? (b.h + b.bb) / (b.ab + b.bb) + (b.h + b.hr * 3) / b.ab : 0);
      mvp = { ...b, name: getDisplayName(b.name), avg, ops };
    }
  }
  let ace: SeriesAwards['ace'] = null;
  let bestArm = -1;
  for (const p of pit) {
    if (p.ip < minIp) continue;
    const era = p.ip > 0 ? (p.er * 9) / p.ip : 99;
    const score = p.so * 1.2 + p.ip - era * 1.5 + p.w * 3 + p.s * 2;
    if (score > bestArm) { bestArm = score; ace = { ...p, name: getDisplayName(p.name), era }; }
  }
  return { mvp, ace };
}

export function computeAwards(result: SeriesResult, yourIds: Set<string>): SeriesAwards {
  const { bat, pit } = aggregate(result.games, yourIds);
  return pickAwards(bat, pit, 4, 3);
}

// --- Run-wide tally (accumulated across every series of a run) ---
export interface RunTally { bat: Record<string, BatterLine>; pit: Record<string, PitcherLine>; }
export function emptyRunTally(): RunTally { return { bat: {}, pit: {} }; }

export function accumulateSeries(t: RunTally, result: SeriesResult, yourIds: Set<string>): RunTally {
  const bat = { ...t.bat }, pit = { ...t.pit };
  for (const g of result.games) {
    if (!g.boxScore) continue;
    for (const side of [g.boxScore.away, g.boxScore.home]) {
      for (const b of side.batters) {
        if (!yourIds.has(b.playerId)) continue;
        const c = bat[b.playerId] ?? { name: b.name, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, r: 0 };
        bat[b.playerId] = { name: c.name, ab: c.ab + b.ab, h: c.h + b.h, hr: c.hr + b.hr, rbi: c.rbi + b.rbi, bb: c.bb + b.bb, r: c.r + b.r };
      }
      for (const p of side.pitchers) {
        if (!yourIds.has(p.playerId)) continue;
        const c = pit[p.playerId] ?? { name: p.name, ip: 0, so: 0, er: 0, h: 0, w: 0, s: 0 };
        pit[p.playerId] = { name: c.name, ip: Math.round((c.ip + p.ip) * 10) / 10, so: c.so + p.so, er: c.er + p.er, h: c.h + p.h, w: c.w + (p.decision === 'W' ? 1 : 0), s: c.s + (p.decision === 'S' ? 1 : 0) };
      }
    }
  }
  return { bat, pit };
}

/** The run's overall MVP + ace, from the accumulated tally (higher thresholds). */
export function runAwards(t: RunTally): SeriesAwards {
  return pickAwards(Object.values(t.bat), Object.values(t.pit), 10, 6);
}

export function fmtAvg(avg: number): string {
  return (avg >= 1 ? '1.000' : '.' + Math.round(avg * 1000).toString().padStart(3, '0'));
}
