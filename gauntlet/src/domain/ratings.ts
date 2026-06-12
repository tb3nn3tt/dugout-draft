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
  powVL: number; powVR: number;   // power vs LHP / RHP
  eye: number;
  run: number;
  field: number;
  bunt: number;
}

export interface PitcherRatings {
  kind: 'pitcher';
  stamina: number;
  stuff: number;     // strikeout stuff
  control: number;   // walk avoidance
  command: number;   // limit hard contact / quality of contact
  vsL: number;       // effectiveness vs LH batters
  vsR: number;       // effectiveness vs RH batters
}

export type Ratings = HitterRatings | PitcherRatings;

const PITCHER_POS = ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
const clamp = (x: number) => Math.max(20, Math.min(80, Math.round(x)));

const cache = new Map<string, Ratings>();

function deriveHitter(p: Player): HitterRatings {
  const g = p.grades ?? inferGradesFromStats(p);
  const c = g.contact ?? 50, pw = g.power ?? 50, sp = g.speed ?? 50;
  const bats = p.bats;
  // Generic platoon: batters hit opposite-handed pitchers better.
  const cAdv = 4, cDis = 3, pAdv = 5, pDis = 4;
  let conVL: number, conVR: number, powVL: number, powVR: number;
  if (bats === 'R') {            // RHB: better vs LHP
    conVL = c + cAdv; conVR = c - cDis; powVL = pw + pAdv; powVR = pw - pDis;
  } else if (bats === 'L') {     // LHB: better vs RHP
    conVL = c - cDis; conVR = c + cAdv; powVL = pw - pDis; powVR = pw + pAdv;
  } else {                       // switch: neutral, slight edge
    conVL = c + 1; conVR = c + 1; powVL = pw; powVR = pw;
  }
  const bunt = 42 + (c - 50) * 0.35 + (sp - 50) * 0.35 - (pw - 50) * 0.25;
  return {
    kind: 'hitter',
    conVL: clamp(conVL), conVR: clamp(conVR), powVL: clamp(powVL), powVR: clamp(powVR),
    eye: clamp(g.eye ?? 50), run: clamp(sp), field: clamp(g.fielding ?? 50), bunt: clamp(bunt),
  };
}

function derivePitcher(p: Player): PitcherRatings {
  const g = p.grades ?? inferGradesFromStats(p);
  const fb = g.fastball ?? 50, br = g.breaking ?? 50, ch = g.changeup ?? 50, ct = g.control ?? 50;
  const stuff = fb * 0.55 + br * 0.45;
  const command = ch * 0.35 + ct * 0.30 + br * 0.35;
  const q = (stuff + command + ct) / 3;
  const isLoogy = p.positions.includes('LOOGY');
  let vsL: number, vsR: number;
  if (isLoogy) { vsL = q + 13; vsR = q - 12; }       // specialist lefty: death on LHB
  else if (p.throws === 'L') { vsL = q + 4; vsR = q - 4; }
  else { vsR = q + 4; vsL = q - 4; }
  return {
    kind: 'pitcher',
    stamina: clamp(g.stamina ?? (p.positions.includes('SP') ? 70 : 45)),
    stuff: clamp(stuff), control: clamp(ct), command: clamp(command),
    vsL: clamp(vsL), vsR: clamp(vsR),
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
