import { Player } from './types';
import { inferGradesFromStats } from './sim/simulation';

// ============================================================================
// Detailed, platoon-aware ratings (20-80) — the "true sim" rating set.
// Derived from the stored scouting grades + handedness so we don't have to
// rewrite every card; cached per player id.
//
//   Hitters:  contact vL/vR, power vL/vR, eye, running, fielding, bunting
//   Pitchers: stamina, stuff (K), control (BB), command (limit contact),
//             vsL / vsR (effectiveness by batter hand)
// ============================================================================

export interface HitterRatings {
  kind: 'hitter';
  conVL: number; conVR: number;   // contact vs LHP / RHP
  hrVL: number; hrVR: number;     // home-run power vs LHP / RHP
  gapVL: number; gapVR: number;   // gap/extra-base power vs LHP / RHP
  eye: number;
  run: number;
  field: number;
  bunt: number;
}

export interface PitcherRatings {
  kind: 'pitcher';
  stuffVL: number; stuffVR: number;   // strikeout stuff vs LH / RH batters
  control: number;                     // walk (+HBP) avoidance
  cmdVL: number; cmdVR: number;        // contact suppression vs LH / RH batters
  stamina: number;                     // grade behind IP/G
  ipg: number;                         // innings per appearance (display)
  gb: number;                          // ground-ball %
}

export type Ratings = HitterRatings | PitcherRatings;

const PITCHER_POS = ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
const clamp = (x: number) => Math.max(20, Math.min(80, Math.round(x)));

const cache = new Map<string, Ratings>();

function deriveHitter(p: Player): HitterRatings {
  const g = p.grades ?? inferGradesFromStats(p);
  const c = g.contact ?? 50, pw = g.power ?? 50, sp = g.speed ?? 50;
  // HR power = raw power. Gap power blends raw power with line-drive contact +
  // a little speed (doubles/triples), so a slugger and a gap hitter diverge.
  const hr = pw;
  const gap = pw * 0.5 + c * 0.4 + sp * 0.1;
  const bats = p.bats;
  // Generic platoon: batters hit opposite-handed pitchers better.
  const cAdv = 4, cDis = 3, pAdv = 5, pDis = 4;
  const sign = bats === 'R' ? 1 : bats === 'L' ? -1 : 0; // +1 → bonus vL, -1 → bonus vR
  const split = (base: number, adv: number, dis: number) => sign === 0
    ? [base + 1, base + 1] as const
    : sign === 1
      ? [base + adv, base - dis] as const   // RHB: vL bonus, vR penalty
      : [base - dis, base + adv] as const;  // LHB: vR bonus, vL penalty
  const [conVL, conVR] = split(c, cAdv, cDis);
  const [hrVL, hrVR] = split(hr, pAdv, pDis);
  const [gapVL, gapVR] = split(gap, pAdv - 1, pDis - 1);
  const bunt = 42 + (c - 50) * 0.35 + (sp - 50) * 0.35 - (pw - 50) * 0.25;
  return {
    kind: 'hitter',
    conVL: clamp(conVL), conVR: clamp(conVR),
    hrVL: clamp(hrVL), hrVR: clamp(hrVR), gapVL: clamp(gapVL), gapVR: clamp(gapVR),
    eye: clamp(g.eye ?? 50), run: clamp(sp), field: clamp(g.fielding ?? 50), bunt: clamp(bunt),
  };
}

function derivePitcher(p: Player): PitcherRatings {
  const g = p.grades ?? inferGradesFromStats(p);
  const fb = g.fastball ?? 50, br = g.breaking ?? 50, ch = g.changeup ?? 50, ct = g.control ?? 50;
  const stuff = fb * 0.55 + br * 0.45;
  const command = ch * 0.35 + ct * 0.30 + br * 0.35;
  const stamina = g.stamina ?? (p.positions.includes('SP') ? 70 : 45);

  // Same-handed pitchers are tougher; LOOGYs extreme on LHB, exposed to RHB.
  const isLoogy = p.positions.includes('LOOGY');
  const sS = isLoogy ? 12 : 4;     // stuff swing
  const sC = isLoogy ? 10 : 3;     // command swing
  const lefty = p.throws === 'L';
  // sign +1 means "tougher vs LHB" (lefty arms); -1 means tougher vs RHB.
  const sign = lefty ? 1 : -1;
  const stuffVL = stuff + sign * sS, stuffVR = stuff - sign * sS;
  const cmdVL = command + sign * sC, cmdVR = command - sign * sC;

  // IP per appearance from stamina + role.
  const isSP = p.positions.includes('SP');
  const ipg = isSP
    ? Math.round((4.6 + (stamina - 60) / 20 * 2.3) * 10) / 10   // ~4.5-6.9
    : p.positions.includes('LRP') ? 2.4
    : isLoogy ? 0.7
    : Math.round((1.0 + (stamina - 45) / 20 * 0.6) * 10) / 10;  // ~0.9-1.6

  // Ground-ball %: movement/command produce grounders; pure velo → flyballs.
  const gb = Math.max(30, Math.min(58, Math.round(44 + (br - 50) * 0.35 + (ct - 50) * 0.12 - (fb - 50) * 0.12)));

  return {
    kind: 'pitcher',
    stuffVL: clamp(stuffVL), stuffVR: clamp(stuffVR),
    control: clamp(ct),
    cmdVL: clamp(cmdVL), cmdVR: clamp(cmdVR),
    stamina: clamp(stamina), ipg, gb,
  };
}

export function isPitcherCard(p: Player): boolean {
  const hasP = p.positions.some(x => PITCHER_POS.includes(x));
  const hasBat = p.positions.some(x => !PITCHER_POS.includes(x) && x !== 'HC' && x !== 'ST');
  return hasP && !hasBat; // two-way counts as hitter
}

export function getRatings(p: Player): Ratings {
  const hit = cache.get(p.id);
  if (hit) return hit;
  const r = isPitcherCard(p) ? derivePitcher(p) : deriveHitter(p);
  cache.set(p.id, r);
  return r;
}
