/* eslint-disable */
// ============================================================================
// Lore Player Generator — manufactures TONS of characterful cards spanning all
// roles and all quality tiers (fact-flavored, fiction, lore & legend) to fill
// every (role x tier) gap so the spin-draft always has >4 candidates per cell.
//
// Run: node gauntlet/scripts/generate-lore-players.cjs
// Writes: gauntlet/src/data/lore-players.json
// ============================================================================
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'src', 'data');
const OUT = path.join(DATA, 'lore-players.json');
const TARGET_PER_CELL = 14; // ensure >4 (comfortably) per (role,tier)

// --- deterministic RNG so regenerating is stable ---
let seed = 0xc0ffee;
function rng() { seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) >>> 0; return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296; }
const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const ROLES = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','CL','SU','MRP','LRP','LOOGY','BC','PH','PR','IFD','OFD'];
const PITCHERS = new Set(['SP','CL','SU','MRP','LRP','LOOGY']);
const TIERS = [
  { name: 'diamond', lo: 92, hi: 99 },
  { name: 'gold',    lo: 84, hi: 91 },
  { name: 'silver',  lo: 75, hi: 83 },
  { name: 'bronze',  lo: 65, hi: 74 },
  { name: 'common',  lo: 48, hi: 64 },
];
function tierOf(ovr) { return ovr >= 92 ? 'diamond' : ovr >= 84 ? 'gold' : ovr >= 75 ? 'silver' : ovr >= 65 ? 'bronze' : 'common'; }
function canPlay(p, pos) {
  if (p.positions.includes(pos)) return true;
  if (['1B','2B','3B','SS'].includes(pos) && p.positions.includes('IFD')) return true;
  if (['LF','CF','RF'].includes(pos) && p.positions.includes('OFD')) return true;
  if (pos === 'C' && p.positions.includes('BC')) return true;
  return false;
}

// ---- name banks: fact-flavored, fiction, lore & legend ----
const FIRST = ['Cyclone','Mordecai','Dizzy','Cool Papa','Smoky','Gabby','Pee Wee','Goose','Catfish','Sliding','Shoeless','Cannonball','Boomer','Rube','Schoolboy','Slim','Tug','Vinegar','Sandlot','Whitey','Ducky','Pinky','Buck','Hoot','Spider','Babe','Lefty','Dazzy','Rabbit','Pretzel','Sparky','Pumpsie','Footsie','Bingo','Choo','Gates','Cozy','Flint','Boog','Coco','Razor','Skeeter','Yogi','Moose','Jigger','Rip','Dummy','Three Finger','Grover','Heinie','Wahoo','Zeke','Ziggy','Mookie','Bumpus','Cletus','Tanner','Kelly','Ham','Engelberg','Ogilvie','Lupus','Ahmad','Henry','Chet','Lloyd','Roger','Jack','Clu','Ricky','Willie Mays','Jake','Crash','Ebby','Nuke','Billy','Benny','Squints','Ham','Yeah-Yeah','Repeat','Timmy','Tommy','Scotty','Hamilton','Kit','Dottie','Mae','Marla','Doris'];
const LAST = ['Hazen','Mortimer','Coombs','Quigley','Throop','Vanderhook','Pennyworth','Halloran','Cobb','Stargell','Killefer','Mathewson','Kowalczyk','Dilworth','Brubaker','Cravath','Tannehill','Galvin','Radbourn','Bresnahan','Heilmann','Combs','Roush','Maranville','Waddell','Joss','Bender','Plank','Mullin','Donlin','Tinker','Evers','Chance','Hooper','Speaker','Klem','Buckner','Wagner','Appling','Aparicio','Sewell','Trammell','Concepcion','Whitaker','Grich','Randolph','Doerr','Lazzeri','Gordon','Fox','Mazeroski','Schoendienst','Frisch','Herman','Lopes','Morgan','Sandberg','Biggio','Alomar','Rowengarner','Engelberg','Leak','Agilar','Whitewood','McGill','Sturgess','Brickma','Bowers','Heywood','Nebbercracker','Sandlot','Smalls','Rodriguez','Timmons','McClennan',' Portnoy','Sheffield','Vaughn','LaLoosh','Davis','Robbins','Mordecai','Stilwell','Cerrano','Dorn','Haywood','Taylor','Phelps','Hriniak','Garvey'];
const NICK = ['The Cyclone','Old Hoss','The Grey Ghost','Sudden Death','The Wild Thing','Mr. Automatic','The Vacuum','The Iceman','Hammer','The Octopus','Doctor K','The Sandman','The Crime Dog','Sweet Swingin\'','The Toy Cannon','Big Train','The Mechanical Man','Death to Flying Things','The Tabasco Kid','The Human Rain Delay','Two-Bag','The Gnat','Wheels','The Heater','Spaceman','The Bird','Stretch','The Barber','Catfish','The Gamer','Cooperstown Bound','The Natural','The Sandlot Kid','Wonderboy','The Whiff King','Glove First','The Mendoza Avenger'];
const TEAMS = ['MUD','SAN','LOR','OLD','FIC','LEG','RKL','BNB','9ER','PEN','VAL','DUG','SLT','HVN','MYT','BUS','INT','STR','PLY','ODD'];
const ERAS = ['Lore & Legend','Dead Ball Days','The Sandlot','Cinematic Classic','Cooperstown Dreams','Backlot Heroes','Cup of Coffee','Bush League Tale','Beer League Saga','Roadside Legend','Winter Ball Myth','Forgotten Phenom'];

const ROLE_FLAVOR = {
  C: ['Calls a masterful game from behind the dish.', 'Frames pitches like a sculptor.', 'A wall at the plate; nobody runs on him.'],
  '1B': ['Scoops everything in the dirt.', 'Mashes from the cleanup spot.', 'A gentle giant with thunder in his bat.'],
  '2B': ['Turns two in his sleep.', 'A pesky table-setter who never gives an at-bat away.', 'Glue guy who does the little things.'],
  '3B': ['Guards the hot corner like a bouncer.', 'Bare-hands the slow roller every time.', 'Corner power, cannon arm.'],
  SS: ['Ranges into the hole and throws across his body.', 'A human highlight reel up the middle.', 'Slick leather, sneaky pop.'],
  LF: ['Plays the carom off the wall perfectly.', 'A professional hitter, gap to gap.', 'Old-school grinder in left.'],
  CF: ['Runs everything down in the gaps.', 'Patrols center like he owns the deed.', 'Five-tool dreamer with wheels.'],
  RF: ['Has a howitzer for an arm.', 'Right-field power, nobody takes the extra base.', 'Rifle arm, rocket bat.'],
  DH: ['Born to do one thing: rake.', 'A designated masher in every sense.', 'Sits all game, then crushes one.'],
  SP: ['Eats innings and breaks hearts.', 'Paints the black with surgical command.', 'A bulldog who finishes what he starts.'],
  CL: ['Slams the door in the ninth, no sweat.', 'Enters to chaos, leaves to silence.', 'A flamethrower with ice in his veins.'],
  SU: ['The bridge to the closer, lights out in the eighth.', 'Sets the table for the save.', 'Power arm out of the pen.'],
  MRP: ['A fireman who escapes any jam.', 'Mid-game stopper with a rubber arm.', 'Comes in with ducks on the pond and freezes them.'],
  LRP: ['Can give you four quiet innings in a pinch.', 'The unsung mop-up artist and spot starter.', 'Saves the bullpen on a long night.'],
  LOOGY: ['One job: retire the big lefty bat.', 'A crafty southpaw with a frisbee slider.', 'Comes in for one hitter and walks off a hero.'],
  BC: ['The veteran backstop who steadies the staff.', 'A backup who handles the knuckleballer.', 'Spells the starter and never misses a beat.'],
  PH: ['The best bat off the bench, ice-cold clutch.', 'Lives for the ninth-inning pinch-hit spot.', 'One swing, game over.'],
  PR: ['Pure jet fuel on the basepaths.', 'Steals you a run in the late innings.', 'Ninety feet is all he needs.'],
  IFD: ['Defensive wizard, late-inning lockdown.', 'Slick-fielding utility glove.', 'Protects a lead with his leather.'],
  OFD: ['A defensive replacement who robs home runs.', 'Wheels and a cannon off the bench.', 'Late-game outfield insurance.'],
};

function gradeCenter(ovr) { return clamp(Math.round((ovr - 50) / 49 * 50 + 28), 20, 80); }
function g(center, skew = 0) { return clamp(Math.round(center + skew + (rng() * 14 - 7)), 20, 80); }

function makeHitterGrades(ovr, role) {
  const c = gradeCenter(ovr);
  const sk = { contact:0,power:0,speed:0,fielding:0,arm:0,eye:0 };
  if (role === 'PR') { sk.speed += 18; sk.power -= 14; sk.contact -= 4; }
  if (role === 'IFD') { sk.fielding += 16; sk.arm += 10; sk.power -= 12; }
  if (role === 'OFD') { sk.fielding += 14; sk.arm += 14; sk.speed += 8; sk.power -= 10; }
  if (role === 'PH') { sk.power += 12; sk.contact += 6; sk.speed -= 8; }
  if (role === 'BC' || role === 'C') { sk.fielding += 12; sk.arm += 12; sk.speed -= 10; }
  if (role === 'DH') { sk.power += 14; sk.fielding -= 14; sk.speed -= 8; }
  if (role === '1B' || role === '3B' || role === 'RF') { sk.power += 8; sk.arm += 4; }
  if (role === 'SS' || role === '2B') { sk.fielding += 10; sk.speed += 6; sk.power -= 6; }
  if (role === 'CF') { sk.speed += 12; sk.fielding += 8; }
  return { contact:g(c,sk.contact), power:g(c,sk.power), speed:g(c,sk.speed), fielding:g(c,sk.fielding), arm:g(c,sk.arm), eye:g(c,sk.eye), clutch:g(c) };
}
function makePitcherGrades(ovr, role) {
  const c = gradeCenter(ovr);
  let stamina;
  if (role === 'SP') stamina = ri(64, 78);
  else if (role === 'LRP') stamina = ri(52, 62);
  else stamina = ri(34, 50);
  const sk = { fastball:0,breaking:0,changeup:0,control:0 };
  if (role === 'CL' || role === 'SU') { sk.fastball += 12; sk.breaking += 6; sk.changeup -= 8; }
  if (role === 'LOOGY') { sk.breaking += 16; sk.changeup -= 12; sk.control += 4; }
  if (role === 'MRP') { sk.fastball += 6; }
  if (role === 'LRP') { sk.control += 8; sk.changeup += 6; sk.fastball -= 6; }
  if (role === 'SP') { sk.changeup += 6; sk.control += 4; }
  return { fastball:g(c,sk.fastball), breaking:g(c,sk.breaking), changeup:g(c,sk.changeup), control:g(c,sk.control), stamina, clutch:g(c) };
}
function hitterStats(gr) {
  const avg = clamp(0.205 + (gr.contact - 50) / 100 * 0.22 + (rng()*0.02-0.01), 0.185, 0.355);
  const obp = clamp(avg + 0.035 + (gr.eye - 50) / 100 * 0.16, avg + 0.02, avg + 0.16);
  const slg = clamp(avg + 0.085 + (gr.power - 50) / 100 * 0.42, avg + 0.05, avg + 0.46);
  return { avg:+avg.toFixed(3), obp:+obp.toFixed(3), slg:+slg.toFixed(3), hr: Math.round(gr.power/80*42), speed: Math.round(gr.speed/80*100) };
}
function pitcherStats(gr, ovr) {
  const era = clamp(5.4 - (ovr - 50)/49*3.1 + (rng()*0.5-0.25), 1.75, 6.6);
  const whip = clamp(1.55 - (gr.control - 50)/100*0.55 - (ovr-50)/49*0.15, 0.88, 1.7);
  const k9 = clamp(5.2 + (gr.fastball - 50)/10*1.1 + (gr.breaking-50)/10*0.6, 4.5, 14.5);
  const bb9 = clamp(5.2 - (gr.control - 50)/10*1.3, 1.0, 6.2);
  return { era:+era.toFixed(2), whip:+whip.toFixed(2), k9:+k9.toFixed(1), bb9:+bb9.toFixed(1) };
}

// secondary position so the pool stays flexible for the optimal-lineup builder
function secondaryFor(role) {
  const map = { SS:'IFD', '2B':'IFD', '3B':'IFD', '1B':'IFD', CF:'OFD', LF:'OFD', RF:'OFD', BC:'PH', PR:'OFD', DH:'PH' };
  return map[role];
}

// ---- load existing data, count cells ----
const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json') && f !== 'coaches.json' && f !== 'stadiums.json' && f !== 'lore-players.json');
let existing = [];
for (const f of files) { try { existing = existing.concat(JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))); } catch {} }
const usedNames = new Set(existing.map(p => p.name));
function cellCount(role, tier) { return existing.filter(p => canPlay(p, role) && tierOf(p.overall) === tier).length; }

const out = [];
let counter = 1;
function uniqueName() {
  for (let t = 0; t < 40; t++) {
    let nm = `${pick(FIRST)} ${pick(LAST)}`.replace(/\s+/g, ' ').trim();
    if (!usedNames.has(nm)) { usedNames.add(nm); return nm; }
  }
  const nm = `${pick(FIRST)} ${pick(LAST)} ${counter}`; usedNames.add(nm); return nm;
}

for (const role of ROLES) {
  for (const tier of TIERS) {
    const have = cellCount(role, tier.name);
    const need = Math.max(0, TARGET_PER_CELL - have);
    for (let i = 0; i < need; i++) {
      const ovr = ri(tier.lo, tier.hi);
      const isP = PITCHERS.has(role);
      const throwsL = role === 'LOOGY' ? true : rng() < 0.28;
      const grades = isP ? makePitcherGrades(ovr, role) : makeHitterGrades(ovr, role);
      const positions = [role];
      const sec = secondaryFor(role);
      if (sec && rng() < 0.5) positions.push(sec);
      const name = uniqueName();
      out.push({
        id: `lore-${counter++}`,
        name,
        team: pick(TEAMS),
        positions,
        bats: isP ? (throwsL ? 'L' : 'R') : pick(['R','R','L','S']),
        throws: throwsL ? 'L' : 'R',
        stats: isP ? pitcherStats(grades, ovr) : hitterStats(grades),
        overall: ovr,
        category: pick(['fictional','oddity','legend']),
        era: pick(ERAS),
        nickname: rng() < 0.5 ? pick(NICK) : undefined,
        specialty: undefined,
        funFact: pick(ROLE_FLAVOR[role]),
        grades,
      });
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`Generated ${out.length} lore players -> ${path.relative(process.cwd(), OUT)}`);
// report resulting coverage
const merged = existing.concat(out);
let minCell = Infinity, minWhich = '';
for (const role of ROLES) for (const tier of TIERS) {
  const n = merged.filter(p => canPlay(p, role) && tierOf(p.overall) === tier.name).length;
  if (n < minCell) { minCell = n; minWhich = `${role}/${tier.name}`; }
}
console.log(`Pool now ${merged.length}. Weakest (role x tier) cell: ${minWhich} = ${minCell}`);
