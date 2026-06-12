/* eslint-disable */
// Build a small set of hand-authored "marquee" lore/fiction characters with
// real flavor (names, nicknames, blurbs); grades/stats are generated coherently
// from a target overall + role so they slot into the sim. Output: marquee-cards.json
const fs = require('fs');
const path = require('path');

let seed = 0x9e3779b1;
function rng() { seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) >>> 0; return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296; }
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const gc = (ovr) => clamp(Math.round((ovr - 50) / 49 * 50 + 28), 20, 80);
const g = (c, sk = 0) => clamp(Math.round(c + sk + (rng() * 12 - 6)), 20, 80);
const PITCH = new Set(['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY']);

// [name, nickname, primaryPos, overall, bats, throws, era, blurb]
const ROSTER = [
  ['Cyclone McGraw', 'The Cyclone', 'SP', 96, 'R', 'R', 'Dead Ball Days', 'They say his fastball whistled. Hitters swung at the sound and missed.'],
  ['Mordecai "Three Finger" Vance', 'Three Finger', 'SP', 90, 'R', 'R', 'Dead Ball Days', 'Lost two fingers in a thresher; gained the nastiest curve the leagues ever saw.'],
  ['Sliding Billy Calloway', 'The Comet', 'CF', 91, 'L', 'R', 'Lore & Legend', 'Stole second, third, and home on a single walk. Twice.'],
  ['Big Ed Stoneman', 'The Mountain', '1B', 93, 'R', 'R', 'Lore & Legend', 'Hit one so far they renamed the street it landed on.'],
  ['Rosie "Rocket" Delgado', 'The Rocket', 'RF', 89, 'R', 'R', 'Winter Ball Myth', 'A cannon in right. Runners simply stopped testing her.'],
  ['Gabby "The Wall" Pruett', 'The Wall', 'C', 90, 'R', 'R', 'Lore & Legend', 'Caught a doubleheader in a hailstorm and never dropped a pitch.'],
  ['Pee Wee Ferris', 'Pee Wee', 'SS', 88, 'S', 'R', 'The Sandlot', 'Five-foot-four of pure leather. Vacuumed up everything in the hole.'],
  ['Wahoo Sam Tully', 'Wahoo', 'LF', 87, 'L', 'L', '1990s', 'Played every inning like the house was on fire. Usually was.'],
  ['Dizzy Lou Marchetti', 'Dizzy Lou', 'SP', 88, 'L', 'L', 'Cinematic Classic', 'Talked through his whole no-hitter. Never stopped grinning.'],
  ['Schoolboy Kane', 'Schoolboy', 'SP', 85, 'R', 'R', 'Backlot Heroes', 'Came straight off the sandlot and struck out the side in his debut.'],
  ['Hammerin\' Hank Osei', 'Hammer', 'DH', 92, 'R', 'R', 'Steroid Era', 'Forearms like fence posts. The cheap seats feared him.'],
  ['Vinegar Bend Whitlow', 'Vinegar', 'CL', 89, 'R', 'R', 'Lore & Legend', 'Entered to dead silence, left to it too. Ice in the ninth.'],
  ['Cool Breeze Okafor', 'Cool Breeze', 'CL', 91, 'R', 'R', 'Modern Legends', 'Never broke a sweat, never blew a save. Slammed the door.'],
  ['Tug Halloran', 'Tug', 'SU', 84, 'L', 'L', '1980s', 'The bridge to the ninth. Eighth inning belonged to him.'],
  ['Skeeter Boudreau', 'Skeeter', '2B', 84, 'L', 'R', '1970s', 'Turned two in his sleep. Pesky bat, peskier glove.'],
  ['Doc Holloway', 'Doc', '3B', 86, 'R', 'R', 'Cooperstown Dreams', 'Bare-handed the slow roller every single time. Surgeon at the hot corner.'],
  ['Moonlight Graves', 'Moonlight', 'RF', 80, 'L', 'L', 'Cup of Coffee', 'One game in the bigs. Went 4-for-4 and walked into legend.'],
  ['Crash Mulligan', 'Crash', 'C', 82, 'R', 'R', 'Beer League Saga', 'Veteran backstop who could still steal a strike and a beer.'],
  ['Slim Pickens Jr.', 'Slim', 'LRP', 78, 'R', 'R', 'Bush League Tale', 'Could give you five quiet innings on a Tuesday with nothing left in the pen.'],
  ['Lefty Lazlo', 'Lefty', 'LOOGY', 83, 'L', 'L', 'Roadside Legend', 'One job: that big lefty bat in the ninth. Frisbee slider, lights out.'],
  ['Bo "Wheels" Ferreira', 'Wheels', 'PR', 82, 'L', 'R', 'Forgotten Phenom', 'Ninety feet of pure terror. Pinch-ran his way into folklore.'],
  ['Tank Brubaker', 'Tank', '1B', 85, 'R', 'R', 'Steroid Era', 'A gentle giant until there were ducks on the pond.'],
  ['Whitey Sandoval', 'Whitey', 'SS', 89, 'R', 'R', 'International'.length ? 'World Baseball' : '', 'Slick from both sides of the bag, sneaky pop to all fields.'],
  ['Catfish Boone', 'Catfish', 'SP', 91, 'R', 'R', 'Cooperstown Dreams', 'A bulldog who finished what he started. Complete games by the dozen.'],
  ['Boomer Yablonski', 'Boomer', 'PH', 84, 'L', 'R', 'Cinematic Classic', 'Best bat on the bench. Lived for the ninth-inning pinch swing.'],
  ['Ziggy Marsh', 'Ziggy', 'OFD', 80, 'R', 'R', 'Fan Favorites', 'Late-game outfield insurance who robbed three would-be homers in a week.'],
  ['Iron Mike Cassidy', 'Iron Mike', 'IFD', 81, 'R', 'R', '1980s', 'Defensive wizard. Protected a lead with nothing but his leather.'],
  ['Spaceman Dupree', 'Spaceman', 'MRP', 83, 'R', 'R', 'Beer League Saga', 'A fireman with a rubber arm and a thousand-yard stare.'],
  ['Honus Krall', 'The Flying Dutchman', 'SS', 95, 'R', 'R', 'Dead Ball Days', 'Bowlegged and unbeatable. The greatest shortstop nobody filmed.'],
  ['El Tigre Mendez', 'El Tigre', 'CF', 92, 'S', 'R', 'World Baseball', 'Winter-ball royalty. Hit .400 across three leagues in one calendar year.'],
  ['Smoky Joe Brennan', 'Smoky Joe', 'SP', 93, 'R', 'R', 'Lore & Legend', 'His heater smoked the catcher\'s mitt. Literally, once.'],
  ['Buck "Bull" Tatum', 'The Bull', '1B', 88, 'L', 'L', 'Negro Leagues', 'Cleanup hitter who made grown pitchers ask for a day off.'],
  ['Pinky Delacroix', 'Pinky', '2B', 79, 'L', 'R', '1960s', 'Scrappy keystone glue. Fouled off twelve pitches then bunted you to death.'],
  ['The Reverend Gaines', 'The Reverend', 'CL', 90, 'R', 'R', 'Modern Legends', 'Preached fire and brimstone in the ninth. Congregation: zero baserunners.'],
  ['Footsie Magoon', 'Footsie', 'PR', 80, 'L', 'L', 'Cinematic Classic', 'Forty stolen bases in a movie that was only two hours long.'],
  ['Duke Kahale', 'Duke', 'RF', 87, 'R', 'R', 'World Baseball', 'Island power, cannon arm. Surfed in the morning, mashed in the evening.'],
  ['Gunner Pavlik', 'Gunner', 'SU', 85, 'R', 'R', '1990s', 'Triple-digit heat out of the pen. The eighth inning was a no-fly zone.'],
  ['Old Hoss Tweed', 'Old Hoss', 'SP', 86, 'R', 'R', 'Dead Ball Days', 'Started both ends of a doubleheader and complained about the rest.'],
  ['Coco Vandenberg', 'Coco', '3B', 81, 'R', 'R', 'Fan Favorites', 'A magician at the hot corner with a flair for the walk-off.'],
  ['Mama Mae Robinson', 'Mama Mae', 'C', 89, 'R', 'R', 'Winter Ball Myth', 'Ran the whole defense from behind the plate. Pitchers called her boss.'],
  ['Razor Hopkins', 'Razor', 'LOOGY', 82, 'L', 'L', 'Roadside Legend', 'Sidearm sweep that left lefties muttering all the way back to the dugout.'],
  ['Tiny Toledo', 'Tiny', 'DH', 90, 'L', 'R', 'Steroid Era', 'Six-foot-eight of bad intentions. The upper deck was in play.'],
  ['Whisper Boudin', 'Whisper', 'LRP', 77, 'L', 'L', 'Bush League Tale', 'Never threw hard, never walked anybody. Soft-tossed his way to folk hero.'],
  ['Chief Two Rivers', 'Chief', 'CF', 88, 'S', 'R', 'Lore & Legend', 'Ran down everything in the gaps. They said the wind owed him favors.'],
];

const TEAMS = ['LOR', 'MYT', 'LEG', 'DUG', 'VAL', 'SLT', 'HVN', 'PEN'];
function hitterGrades(ovr, pos) {
  const c = gc(ovr); const sk = { contact:0,power:0,speed:0,fielding:0,arm:0,eye:0 };
  if (pos === 'PR') { sk.speed += 18; sk.power -= 12; }
  if (pos === 'IFD') { sk.fielding += 16; sk.arm += 8; sk.power -= 10; }
  if (pos === 'OFD') { sk.fielding += 14; sk.arm += 14; sk.speed += 6; sk.power -= 8; }
  if (pos === 'PH') { sk.power += 12; sk.contact += 6; }
  if (pos === 'C') { sk.fielding += 12; sk.arm += 12; sk.speed -= 10; }
  if (pos === 'DH') { sk.power += 14; sk.fielding -= 12; }
  if (pos === '1B' || pos === '3B' || pos === 'RF') { sk.power += 8; sk.arm += 4; }
  if (pos === 'SS' || pos === '2B') { sk.fielding += 10; sk.speed += 6; }
  if (pos === 'CF') { sk.speed += 12; sk.fielding += 8; }
  return { contact:g(c,sk.contact), power:g(c,sk.power), speed:g(c,sk.speed), fielding:g(c,sk.fielding), arm:g(c,sk.arm), eye:g(c,sk.eye), clutch:g(c) };
}
function pitcherGrades(ovr, pos) {
  const c = gc(ovr);
  let stamina = pos === 'SP' ? (60 + Math.round(rng()*16)) : pos === 'LRP' ? (52+Math.round(rng()*8)) : (36+Math.round(rng()*12));
  const sk = { fastball:0,breaking:0,changeup:0,control:0 };
  if (pos === 'CL' || pos === 'SU') { sk.fastball += 12; sk.breaking += 6; }
  if (pos === 'LOOGY') { sk.breaking += 16; sk.control += 4; sk.changeup -= 10; }
  if (pos === 'SP') { sk.changeup += 6; sk.control += 4; }
  if (pos === 'LRP') { sk.control += 8; sk.changeup += 6; }
  return { fastball:g(c,sk.fastball), breaking:g(c,sk.breaking), changeup:g(c,sk.changeup), control:g(c,sk.control), stamina, clutch:g(c) };
}
function hitterStats(gr) {
  const avg = clamp(0.225 + (gr.contact-50)/100*0.20, 0.21, 0.345);
  return { avg:+avg.toFixed(3), obp:+clamp(avg+0.04+(gr.eye-50)/100*0.14, avg+0.03, avg+0.15).toFixed(3),
    slg:+clamp(avg+0.10+(gr.power-50)/100*0.40, avg+0.07, avg+0.45).toFixed(3), hr:Math.round(gr.power/80*42), speed:Math.round(gr.speed/80*100) };
}
function pitcherStats(gr, ovr) {
  return { era:+clamp(4.8-(ovr-50)/49*2.8, 1.9, 5.6).toFixed(2), whip:+clamp(1.45-(gr.control-50)/100*0.5, 0.9, 1.6).toFixed(2),
    k9:+clamp(6+(gr.fastball-50)/10*1.1, 5, 13.5).toFixed(1), bb9:+clamp(4.5-(gr.control-50)/10*1.1, 1.2, 5.5).toFixed(1) };
}

const out = ROSTER.map((row, i) => {
  const [name, nickname, pos, overall, bats, throws, era, funFact] = row;
  const isP = PITCH.has(pos);
  const grades = isP ? pitcherGrades(overall, pos) : hitterGrades(overall, pos);
  return {
    id: `marquee-${i + 1}`, name, team: TEAMS[i % TEAMS.length], positions: [pos],
    bats, throws, stats: isP ? pitcherStats(grades, overall) : hitterStats(grades),
    overall, category: 'fictional', era, nickname, funFact, grades,
  };
});

const OUT = path.join(__dirname, '..', 'src', 'data', 'marquee-cards.json');
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`Wrote ${out.length} marquee cards -> ${path.relative(process.cwd(), OUT)}`);
