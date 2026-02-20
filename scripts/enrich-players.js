import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAYERS_PATH = path.join(__dirname, '..', 'src', 'data', 'players.json');

// ── Star player overrides ──────────────────────────────────────────────
const STAR_DATA = {
  'Shohei Ohtani':      { nickname: 'Shotime',              funFact: 'The two-way unicorn - pitches AND hits like a Hall of Famer. In the same season.' },
  'Mike Trout':          { nickname: 'The Millville Meteor', funFact: 'May be the best player ever, but his Angels keep finding new ways to waste it' },
  'Mookie Betts':        { nickname: 'Mookie Magic',         funFact: 'Does everything at an elite level - hits, fields, runs, bowls 300 games' },
  'Aaron Judge':         { nickname: 'All Rise',             funFact: '6\'7" of raw power. Hit 62 homers in 2022. The ball fears him.' },
  'Ronald Acuna Jr.':    { nickname: 'El Abusador',          funFact: 'Can beat you with power, speed, or defense. Usually all three at once.' },
  'Freddie Freeman':     { nickname: 'Freddie Franchise',    funFact: 'Professional .300 hitter. Eats fastballs for breakfast.' },
  'Corey Seager':        { nickname: 'Seags',                funFact: 'World Series MVP who makes the big moment look routine' },
  'Juan Soto':           { nickname: 'Childish Bambino',     funFact: 'Has been working walks like a veteran since he was a teenager' },
  'Bryce Harper':        { nickname: 'Harp',                 funFact: 'SI cover at 16, MVP at 23. Philly finally gave him a home.' },
  'Gerrit Cole':         { nickname: 'Gerrit the Great',     funFact: 'Elite strikeout artist who lives in the strike zone' },
  'Jacob deGrom':        { nickname: 'deGoat',               funFact: 'When healthy, may be the most dominant pitcher ever. That ERA is otherworldly.' },
  'Josh Hader':          { nickname: 'Haderade',             funFact: 'Left-handed filth from the bullpen. Batters see nothing but a blur.' },
  'Edwin Diaz':          { nickname: 'Sugar',                funFact: "Enters to Timmy Trumpet's 'Narco' and sends hitters back to the dugout" },
  'Emmanuel Clase':      { nickname: 'La Maquina',           funFact: 'Throws a 100 mph cutter. Just a cutter. Nobody can hit it.' },
  'Adley Rutschman':     { nickname: 'Adley All-Star',       funFact: 'Switch-hitting catcher who can do it all behind the plate' },
  'Bobby Witt Jr.':      { nickname: 'BWJ',                  funFact: 'Electric tools across the board - the future is now in KC' },
  'Corbin Carroll':      { nickname: 'CC',                   funFact: 'Blazing speed and a sweet swing. Rookie of the Year was just the start.' },
  'Julio Rodriguez':     { nickname: 'J-Rod',                funFact: 'Built different. Power, speed, and swagger beyond his years.' },
  'Fernando Tatis Jr.':  { nickname: 'El Nino',              funFact: "The most exciting player in baseball when he's on the field" },
  'Spencer Strider':     { nickname: 'Mustache Man',         funFact: "The mustache throws 100 mph. The man attached to it isn't bad either." },
  'Zack Wheeler':        { nickname: 'Wheels',               funFact: 'Durable workhorse who can dominate any lineup' },
  'Clayton Kershaw':     { nickname: 'The Claw',             funFact: 'The greatest Dodger pitcher of all time. That curveball is art.' },
  'Max Scherzer':        { nickname: 'Mad Max',              funFact: 'One blue eye, one brown eye, zero mercy for hitters' },
  'Jose Ramirez':        { nickname: 'J-Ram',                funFact: 'The most underrated superstar in baseball. Does everything.' },
  'Matt Olson':          { nickname: 'Big O',                funFact: 'Effortless left-handed power. Makes 450-foot bombs look casual.' },
  'Yordan Alvarez':      { nickname: 'Yordong',              funFact: 'May be the best pure hitter in baseball. Built for October.' },
  'Kyle Tucker':         { nickname: 'Tuck',                 funFact: "Quietly elite at everything. Houston's most complete player." },
  'Francisco Lindor':    { nickname: 'Mr. Smile',            funFact: 'All-world shortstop who plays with pure joy' },
  'Trea Turner':         { nickname: 'Blazing Trea',         funFact: 'When he gets on base, the whole defense panics' },
  'Pete Alonso':         { nickname: 'Polar Bear',           funFact: "Mashes homers and wins derby titles. The fans' favorite." },
  'Vladimir Guerrero Jr.': { nickname: 'Vladdy',             funFact: 'Son of a legend, becoming one himself. That bat speed is inherited.' },
  'Rafael Devers':       { nickname: 'Scoops',               funFact: 'Hits rockets to every field and makes it look fun doing it' },
  'Wander Franco':       { nickname: 'El Patron',            funFact: 'Switch-hitting prodigy who made the majors before he could rent a car' },
  'Luis Robert Jr.':     { nickname: 'La Pantera',           funFact: '80-grade tools across the board when healthy. 5-tool beast.' },
  'Elly De La Cruz':     { nickname: 'EDLC',                 funFact: "6'5\" shortstop who runs a 3.8 to first. Not a typo." },
  'Adolis Garcia':       { nickname: 'El Bombi',             funFact: '2023 ALCS MVP. Lives for the big moment.' },
  'Tarik Skubal':        { nickname: 'T-Skub',               funFact: 'Detroit\'s ace turned himself into one of the best in baseball' },
  'Blake Snell':         { nickname: 'Snellzilla',           funFact: 'Back-to-back Cy Young winner. Walks some guys, strikes out everyone else.' },
  'Tyler Glasnow':       { nickname: 'Glass Cannon',         funFact: "6'8\" of unhittable when healthy. That slider is a cheat code." },
};

// ── Well-known nicknames for non-star players ──────────────────────────
const KNOWN_NICKNAMES = {
  'Marcus Semien':       'Iron Man',
  'Bo Bichette':         'Bo Flow',
  'Manny Machado':       'El Ministro',
  'Austin Riley':        'Young Thicc',
  'Nolan Arenado':       'Nado',
  'Alex Bregman':        'Breg',
  'Ozzie Albies':        'Oz',
  'Jazz Chisholm Jr.':   'Jazz Hands',
  'Luis Arraez':         'The Hitman',
  'Michael Harris II':   'MH2',
  'Byron Buxton':        'Buck',
  'Cody Bellinger':      'Belli',
  'George Springer':     'Springer Dinger',
  'Lars Nootbaar':       'Noot',
  'J.T. Realmuto':       'The Catching GOAT',
  'Will Smith':          'Fresh Prince',
  'Sean Murphy':         'Murph',
  'Salvador Perez':      'Salvy',
  'Willson Contreras':   'Willy C',
  'William Contreras':   'Willy Two',
  'Cal Raleigh':         'Big Dumper',
  'Dansby Swanson':      'Dans',
  'Carlos Correa':       'El Mago',
  'Xander Bogaerts':     'X-Man',
  'Gunnar Henderson':    'Gunshow',
  'Anthony Volpe':       'Volpe the Fox',
  'Yandy Diaz':          'Yandy Man',
  'Christian Walker':    'C-Walk',
  'Ke\'Bryan Hayes':     'KBH',
  'Ketel Marte':         'Ketel Corn',
  'Steven Kwan':         'Kwan-tum',
  'Randy Arozarena':     'Randy Rockets',
  'Bryan Reynolds':      'B-Rey',
  'Christian Yelich':    'Yeli',
  'Masataka Yoshida':    'Yoshi',
  'Ha-Seong Kim':        'HSK',
  'Jeremy Pena':         'JP',
  'Nico Hoerner':        'Nico',
  'Corbin Burnes':       'Burnsie',
  'Kevin Gausman':       'Gaus',
  'Framber Valdez':      'El Frambo',
  'Logan Webb':          'Webby',
  'Shane McClanahan':    'Sugar Shane',
  'George Kirby':        'Kirbs',
  'Sandy Alcantara':     'Sandy K',
  'Yu Darvish':          'Yu-san',
  'Aaron Nola':          'Nols',
  'Sonny Gray':          'Sunshine',
  'Max Fried':           'Fried Chicken',
  'Chris Sale':          'The Condor',
  'Kenley Jansen':       'KJ',
  'Craig Kimbrel':       'Dirty Craig',
  'Devin Williams':      'Air Bender',
  'Ryan Helsley':        'Hels Bells',
  'Aroldis Chapman':     'The Cuban Missile',
  'Cedric Mullins':      'Ced',
  'Nick Castellanos':    'Casty',
  'Paul Goldschmidt':    'Goldy',
  'Anthony Rizzo':       'Rizz',
  'Miguel Cabrera':      'Miggy',
  'Joey Votto':          'Joey Bats',
  'Willy Adames':        'Willy A',
  'Javier Baez':         'El Mago',
  'Andrew McCutchen':    'Cutch',
  'Kris Bryant':         'KB',
  'Rhys Hoskins':        'Big Rhys',
  'Matt McLain':         'McLain Train',
  'Oneil Cruz':          'Big O',
  'Zac Gallen':          'Z-Gal',
  'Brandon Woodruff':    'Woody',
  'Kyle Bradish':        'Brady',
  'Logan Gilbert':       'Gilby',
  'Nathan Eovaldi':      'Nasty Nate',
  'Jose Berrios':        'La Makina',
  'Felix Bautista':      'Big Felix',
  'Alexis Diaz':         'Lexi',
  'Camilo Doval':        'Camilo Heat',
  'David Bednar':        'The Bedrock',
  'Jordan Romano':       'Romano Closer',
  'Matt Chapman':        'Chappy',
  'Joc Pederson':        'Joc Pop',
  'Jordan Walker':       'J-Walk',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(val)));
}

function isPitcher(player) {
  return player.stats.era !== undefined;
}

function isHitter(player) {
  return player.stats.avg !== undefined;
}

function isTwoWay(player) {
  return isPitcher(player) && isHitter(player);
}

// ── Grade calculators ───────────────────────────────────────────────────

function contactGrade(avg) {
  // .200 -> 35, .240 -> 50, .270 -> 60, .300+ -> 70-80
  if (avg >= 0.330) return 80;
  if (avg >= 0.300) return clamp(70 + (avg - 0.300) / 0.030 * 10, 70, 80);
  if (avg >= 0.270) return clamp(60 + (avg - 0.270) / 0.030 * 10, 60, 70);
  if (avg >= 0.240) return clamp(50 + (avg - 0.240) / 0.030 * 10, 50, 60);
  if (avg >= 0.200) return clamp(35 + (avg - 0.200) / 0.040 * 15, 35, 50);
  return 30;
}

function powerGrade(hr) {
  if (hr >= 55) return 80;
  if (hr >= 45) return clamp(75 + (hr - 45) / 10 * 5, 75, 80);
  if (hr >= 35) return clamp(70 + (hr - 35) / 10 * 5, 70, 75);
  if (hr >= 25) return clamp(60 + (hr - 25) / 10 * 10, 60, 70);
  if (hr >= 15) return clamp(50 + (hr - 15) / 10 * 10, 50, 60);
  if (hr >= 5)  return clamp(35 + (hr - 5) / 10 * 15, 35, 50);
  return 30;
}

function speedGrade(speed) {
  // speed is already roughly on 20-80 ish scale (actually 15-99 in the data)
  // map it: 99->80, 85->75, 70->65, 55->55, 40->45, 25->35, 15->25
  if (speed >= 95) return 80;
  if (speed >= 85) return clamp(75 + (speed - 85) / 10 * 5, 75, 80);
  if (speed >= 70) return clamp(65 + (speed - 70) / 15 * 10, 65, 75);
  if (speed >= 55) return clamp(55 + (speed - 55) / 15 * 10, 55, 65);
  if (speed >= 40) return clamp(45 + (speed - 40) / 15 * 10, 45, 55);
  if (speed >= 25) return clamp(35 + (speed - 25) / 15 * 10, 35, 45);
  return clamp(20 + (speed - 10) / 15 * 15, 20, 35);
}

function eyeGrade(obp) {
  if (obp >= 0.420) return 80;
  if (obp >= 0.400) return clamp(75 + (obp - 0.400) / 0.020 * 5, 75, 80);
  if (obp >= 0.370) return clamp(70 + (obp - 0.370) / 0.030 * 5, 70, 75);
  if (obp >= 0.340) return clamp(60 + (obp - 0.340) / 0.030 * 10, 60, 70);
  if (obp >= 0.310) return clamp(50 + (obp - 0.310) / 0.030 * 10, 50, 60);
  if (obp >= 0.280) return clamp(40 + (obp - 0.280) / 0.030 * 10, 40, 50);
  return 35;
}

function fieldingGrade(overall, positions) {
  // base from overall: overall 99 -> ~70, overall 70 -> ~45
  let base = clamp(40 + (overall - 70) / 30 * 30, 40, 70);
  // positional adjustments
  const pos = positions[0];
  if (pos === 'C' || pos === 'SS') base += 5;
  if (pos === '1B') base -= 5;
  if (pos === 'LF' || pos === 'RF') base -= 2;
  // multi-position bonus
  if (positions.length >= 3) base += 3;
  return clamp(base, 40, 75);
}

function armGrade(positions) {
  const pos = positions[0];
  if (pos === 'C') return clamp(65 + Math.floor(Math.random() * 10), 65, 75);
  if (pos === 'RF') return clamp(63 + Math.floor(Math.random() * 8), 63, 70);
  if (pos === '3B') return clamp(62 + Math.floor(Math.random() * 8), 62, 70);
  if (pos === 'SS') return clamp(58 + Math.floor(Math.random() * 8), 58, 65);
  if (pos === 'CF') return clamp(52 + Math.floor(Math.random() * 8), 52, 60);
  if (pos === '2B') return clamp(50 + Math.floor(Math.random() * 8), 50, 58);
  if (pos === '1B') return clamp(45 + Math.floor(Math.random() * 8), 45, 53);
  if (pos === 'LF') return clamp(50 + Math.floor(Math.random() * 8), 50, 58);
  return clamp(50 + Math.floor(Math.random() * 8), 50, 58);
}

function fastballGrade(k9) {
  if (k9 >= 14)  return 80;
  if (k9 >= 13)  return clamp(75 + (k9 - 13) * 5, 75, 80);
  if (k9 >= 11)  return clamp(70 + (k9 - 11) / 2 * 5, 70, 75);
  if (k9 >= 9)   return clamp(60 + (k9 - 9) / 2 * 10, 60, 70);
  if (k9 >= 7)   return clamp(50 + (k9 - 7) / 2 * 10, 50, 60);
  return clamp(40 + (k9 - 5) / 2 * 10, 35, 50);
}

function breakingGrade(era, whip) {
  // lower era + whip = better. Combined 3.0 or less -> 75, 5.0 -> 60
  const combined = era + whip;
  if (combined <= 2.5) return 75;
  if (combined <= 3.5) return clamp(70 + (3.5 - combined) * 5, 70, 75);
  if (combined <= 4.5) return clamp(65 + (4.5 - combined) * 5, 65, 70);
  if (combined <= 5.5) return clamp(60 + (5.5 - combined) * 5, 60, 65);
  return clamp(55 + (6.5 - combined) * 5, 50, 60);
}

function controlGrade(bb9) {
  if (bb9 <= 1.3) return 80;
  if (bb9 <= 1.5) return clamp(75 + (1.5 - bb9) / 0.2 * 5, 75, 80);
  if (bb9 <= 2.0) return clamp(70 + (2.0 - bb9) / 0.5 * 5, 70, 75);
  if (bb9 <= 2.5) return clamp(60 + (2.5 - bb9) / 0.5 * 10, 60, 70);
  if (bb9 <= 3.0) return clamp(50 + (3.0 - bb9) / 0.5 * 10, 50, 60);
  if (bb9 <= 4.0) return clamp(40 + (4.0 - bb9) / 1.0 * 10, 40, 50);
  return clamp(30 + (5.0 - bb9) / 1.0 * 10, 25, 40);
}

function staminaGrade(positions, overall) {
  const isSP = positions.includes('SP');
  if (isSP) {
    // SPs: 60-75 based on overall
    return clamp(60 + (overall - 72) / 28 * 15, 60, 75);
  }
  // relievers: 35-50
  return clamp(35 + (overall - 70) / 30 * 15, 35, 50);
}

function changeupGrade(overall) {
  // 45-65 based on overall
  return clamp(45 + (overall - 70) / 30 * 20, 45, 65);
}

// ── Hitter grades ───────────────────────────────────────────────────────
function computeHitterGrades(player) {
  const s = player.stats;
  return {
    contact:  contactGrade(s.avg),
    power:    powerGrade(s.hr),
    speed:    speedGrade(s.speed),
    eye:      eyeGrade(s.obp),
    fielding: fieldingGrade(player.overall, player.positions),
    arm:      armGrade(player.positions),
  };
}

// ── Pitcher grades ──────────────────────────────────────────────────────
function computePitcherGrades(player) {
  const s = player.stats;
  return {
    fastball:  fastballGrade(s.k9),
    breaking:  breakingGrade(s.era, s.whip),
    control:   controlGrade(s.bb9),
    stamina:   staminaGrade(player.positions, player.overall),
    changeup:  changeupGrade(player.overall),
  };
}

// ── Specialty determination ─────────────────────────────────────────────
function determineSpecialty(grades, player) {
  if (isHitter(player) && !isPitcher(player)) {
    const g = grades;
    if (g.contact >= 65 && g.power >= 60 && g.speed >= 70 && g.fielding >= 65 && g.eye >= 60)
      return '5-Tool';
    if (g.power >= 70) return 'Power Hitter';
    if (g.contact >= 70 && g.eye >= 65) return 'Contact Master';
    if (g.speed >= 75) return 'Speedster';
    if (g.fielding >= 70) return 'Gold Glove';
    if (g.eye >= 70 && g.contact >= 60) return 'On-Base Machine';
    return null;
  }

  if (isPitcher(player) && !isHitter(player)) {
    const g = grades;
    const k9 = player.stats.k9;
    if (g.fastball >= 70 && k9 >= 11) return 'Strikeout King';
    if (g.fastball >= 70) return 'Power Arm';
    if (g.fastball >= 65 && g.control >= 65 && g.breaking >= 60) return 'Ace';
    if (g.control >= 70) return 'Precision';
    return null;
  }

  // Two-way (like Ohtani) - check both
  if (isTwoWay(player)) {
    const g = grades;
    // Check hitter specialties
    if (g.contact >= 65 && g.power >= 60 && g.speed >= 70 && g.fielding >= 65 && g.eye >= 60)
      return '5-Tool';
    if (g.power >= 70) return 'Power Hitter';
    // Check pitcher specialties
    const k9 = player.stats.k9;
    if (g.fastball >= 70 && k9 >= 11) return 'Strikeout King';
    if (g.fastball >= 70) return 'Power Arm';
    if (g.fastball >= 65 && g.control >= 65 && g.breaking >= 60) return 'Ace';
    if (g.contact >= 70 && g.eye >= 65) return 'Contact Master';
    if (g.speed >= 75) return 'Speedster';
    if (g.fielding >= 70) return 'Gold Glove';
    if (g.eye >= 70 && g.contact >= 60) return 'On-Base Machine';
    if (g.control >= 70) return 'Precision';
    return null;
  }

  return null;
}

// ── Nickname generator for non-star, non-known players ──────────────────
function generateNickname(player) {
  const parts = player.name.split(' ');
  const first = parts[0];
  const last = parts[parts.length - 1];
  const firstInitial = first[0];

  // A few pattern-based approaches, pick deterministically based on id
  const idNum = parseInt(player.id, 10);
  const patterns = [
    () => firstInitial + '-' + last.substring(0, Math.min(last.length, 4)),
    () => first.substring(0, Math.min(first.length, 4)),
    () => 'Big ' + last.substring(0, Math.min(last.length, 4)),
    () => last.substring(0, 1).toUpperCase() + '-' + first.substring(0, 3),
    () => firstInitial + '.' + last.substring(0, 1).toUpperCase() + '.',
    () => first.substring(0, 3) + last.substring(0, 3),
  ];

  return patterns[idNum % patterns.length]();
}

// ── Fun fact generator for non-star players ─────────────────────────────
function generateFunFact(player) {
  const s = player.stats;

  if (isHitter(player) && !isPitcher(player)) {
    const positions = player.positions;

    // High avg
    if (s.avg >= 0.290) return 'Makes contact look easy - a true professional hitter';

    // Power hitter
    if (s.hr >= 25) return "When he connects, the ball doesn't come back";

    // Speedster
    if (s.speed >= 80) return "Blink and he's already on second base";

    // Good catcher
    if (positions.includes('C')) return 'The backbone behind the plate - runs the show';

    // Multi-position
    if (positions.length >= 3) return 'Can play anywhere you need him';

    // Decent average with moderate power
    if (s.avg >= 0.270 && s.hr >= 15) return 'Solid all-around bat who comes through in the clutch';

    // Good OBP
    if (s.obp >= 0.350) return 'Gets on base like clockwork - a rally starter';

    // Moderate hitter
    if (s.speed >= 65) return 'Legs that can change the game on the basepaths';

    // Decent power
    if (s.hr >= 18) return 'Sneaky pop in the bat - watch out for the long ball';

    // Low power, decent contact
    if (s.avg >= 0.250) return 'Puts the ball in play and lets things happen';

    return 'A dependable contributor who fills his role every day';
  }

  if (isPitcher(player) && !isHitter(player)) {
    const positions = player.positions;
    const k9 = s.k9;
    const bb9 = s.bb9;
    const era = s.era;

    // Closers/setup
    if (positions.includes('CL') || positions.includes('SU')) {
      if (k9 >= 12) return 'Punchouts are his specialty';
      if (era <= 2.5) return "Shuts the door when the game's on the line";
      return 'Reliable arm who keeps the bullpen rolling';
    }

    // SP with high K
    if (k9 >= 10 && positions.includes('SP')) return 'Punchouts are his specialty';

    // Good SP
    if (positions.includes('SP') && era <= 3.5) return 'Eats innings and keeps his team in every game';

    // Craft pitcher (low K, low BB)
    if (k9 < 8 && bb9 <= 2.5) return "Doesn't throw hard but knows exactly where every pitch is going";

    // Strikeout RP
    if (k9 >= 10) return 'Punchouts are his specialty';

    // Low-overall reliever
    if (positions.includes('LRP') || positions.includes('RP')) {
      if (era <= 3.5) return 'Reliable arm who keeps the bullpen rolling';
      return 'Keeps the ship steady in the middle innings';
    }

    // Generic SP
    if (positions.includes('SP')) return 'Eats innings and keeps his team in every game';

    return 'Reliable arm who keeps the bullpen rolling';
  }

  // Two-way
  return 'Does it all - hits and pitches at an elite level';
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  console.log('Reading players.json...');
  const raw = fs.readFileSync(PLAYERS_PATH, 'utf8');
  const players = JSON.parse(raw);
  console.log(`Found ${players.length} players.`);

  // Use a deterministic seed for arm grades
  // We'll use a simple seeded random to keep output stable
  let _seed = 42;
  const origRandom = Math.random;
  Math.random = function() {
    _seed = (_seed * 16807 + 0) % 2147483647;
    return (_seed - 1) / 2147483646;
  };

  for (const player of players) {
    // 1. Category and era
    player.category = 'current';
    player.era = 'Current Stars';

    // 2. Grades
    let grades = {};
    if (isTwoWay(player)) {
      // Both hitter and pitcher grades (Ohtani)
      grades = { ...computeHitterGrades(player), ...computePitcherGrades(player) };
    } else if (isHitter(player)) {
      grades = computeHitterGrades(player);
    } else if (isPitcher(player)) {
      grades = computePitcherGrades(player);
    }
    player.grades = grades;

    // 3. Nickname and funFact
    const starInfo = STAR_DATA[player.name];
    if (starInfo) {
      player.nickname = starInfo.nickname;
      player.funFact = starInfo.funFact;
    } else {
      player.nickname = KNOWN_NICKNAMES[player.name] || generateNickname(player);
      player.funFact = generateFunFact(player);
    }

    // 4. Specialty
    player.specialty = determineSpecialty(grades, player);
  }

  // Restore Math.random
  Math.random = origRandom;

  // Write back
  const output = JSON.stringify(players, null, 2);
  fs.writeFileSync(PLAYERS_PATH, output + '\n', 'utf8');
  console.log(`Enriched ${players.length} players. Written to ${PLAYERS_PATH}`);

  // Quick summary
  const specialtyCounts = {};
  for (const p of players) {
    const s = p.specialty || '(none)';
    specialtyCounts[s] = (specialtyCounts[s] || 0) + 1;
  }
  console.log('\nSpecialty distribution:');
  for (const [s, c] of Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${c}`);
  }
}

main();
