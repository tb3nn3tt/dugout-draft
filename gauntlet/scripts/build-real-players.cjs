// Generates src/data/real-players.json — a DEEP pool of real MLB players across
// eras, expanded from a compact list. Each entry: [name, pos, bats, throws, era,
// archetype, overall]. Archetype gives the rating SHAPE; overall sets the level.
// Run: node scripts/build-real-players.cjs
const fs = require('fs');
const path = require('path');

const clamp = (v, lo = 20, hi = 80) => Math.max(lo, Math.min(hi, Math.round(v)));

// Hitter archetypes — grade offsets over a level base (contact/power/speed/eye/fielding/arm)
const HIT = {
  slugger:   { contact: -2, power: 15, speed: -10, eye: 5,  fielding: -4, arm: 0 },
  power:     { contact: 4,  power: 12, speed: -2,  eye: 6,  fielding: 1,  arm: 2 },
  contact:   { contact: 15, power: -5, speed: 3,   eye: 11, fielding: 3,  arm: 1 },
  allaround: { contact: 9,  power: 9,  speed: 9,   eye: 8,  fielding: 9,  arm: 7 },
  speed:     { contact: 7,  power: -8, speed: 17,  eye: 5,  fielding: 7,  arm: 3 },
  defense:   { contact: 1,  power: -3, speed: 7,   eye: 3,  fielding: 16, arm: 12 },
  catcher:   { contact: 3,  power: 4,  speed: -9,  eye: 5,  fielding: 13, arm: 13 },
  leadoff:   { contact: 10, power: -6, speed: 13,  eye: 13, fielding: 6,  arm: 3 },
};
// Pitcher archetypes — (fastball/breaking/control/stamina/changeup)
const PIT = {
  ace:       { fastball: 11, breaking: 11, control: 9,  stamina: 10, changeup: 8 },
  power:     { fastball: 16, breaking: 11, control: -2, stamina: 5,  changeup: 2 },
  control:   { fastball: -3, breaking: 7,  control: 15, stamina: 9,  changeup: 11 },
  closer:    { fastball: 15, breaking: 13, control: 3,  stamina: -12, changeup: 0 },
  workhorse: { fastball: 5,  breaking: 5,  control: 9,  stamina: 15, changeup: 6 },
  crafty:    { fastball: -7, breaking: 11, control: 11, stamina: 7,  changeup: 14 },
};
const PITCHER_ARCH = new Set(Object.keys(PIT));
const isPitcherPos = p => ['SP', 'CL', 'SU', 'RP', 'MRP', 'LRP', 'LOOGY'].includes(p);

function gradesFor(arch, ovr, pitcher) {
  const base = clamp(ovr - 30, 30, 74); // 99->69, 90->60, 80->50, 70->40
  const g = {};
  if (pitcher) {
    const o = PIT[arch] || PIT.ace;
    g.fastball = clamp(base + o.fastball); g.breaking = clamp(base + o.breaking);
    g.control = clamp(base + o.control); g.stamina = clamp(base + o.stamina);
    g.changeup = clamp(base + o.changeup);
    // light hitter grades so they can DH/field in a pinch (low)
    g.contact = clamp(base - 24); g.power = clamp(base - 22); g.speed = clamp(base - 16);
    g.eye = clamp(base - 20); g.fielding = clamp(base - 8); g.arm = clamp(base + 4);
  } else {
    const o = HIT[arch] || HIT.allaround;
    g.contact = clamp(base + o.contact); g.power = clamp(base + o.power);
    g.speed = clamp(base + o.speed); g.eye = clamp(base + o.eye);
    g.fielding = clamp(base + o.fielding); g.arm = clamp(base + o.arm);
  }
  return g;
}

// Category from stature/era so the famous-team + Cooperstown/Modern filters get fed.
function categoryFor(era, ovr) {
  if (era === 'Current Stars') return 'current';
  if (ovr >= 90) return 'legend';
  return 'star';
}

// ── THE LIST: real players across eras. [name, pos, B, T, era, archetype, overall]
const P = [
  // ---- Dead Ball / 1900s-1920s ----
  ['Ty Cobb','CF','L','R','Dead Ball Days','leadoff',96],
  ['Honus Wagner','SS','R','R','Dead Ball Days','allaround',96],
  ['Walter Johnson','SP','R','R','Dead Ball Days','ace',97],
  ['Christy Mathewson','SP','R','R','Dead Ball Days','control',94],
  ['Tris Speaker','CF','L','L','Dead Ball Days','contact',92],
  ['Nap Lajoie','2B','R','R','Dead Ball Days','contact',91],
  ['Grover Alexander','SP','R','R','Dead Ball Days','control',92],
  ['Eddie Collins','2B','L','R','Dead Ball Days','contact',90],
  ['Shoeless Joe Jackson','LF','L','R','Dead Ball Days','contact',91],
  ['Cy Young','SP','R','R','Dead Ball Days','workhorse',93],
  // ---- 1920s-1940s ----
  ['Babe Ruth','RF','L','L','1920s-40s','slugger',99],
  ['Lou Gehrig','1B','L','L','1920s-40s','power',97],
  ['Rogers Hornsby','2B','R','R','1920s-40s','power',95],
  ['Jimmie Foxx','1B','R','R','1920s-40s','slugger',94],
  ['Ted Williams','LF','L','R','1920s-40s','power',98],
  ['Joe DiMaggio','CF','R','R','1920s-40s','allaround',96],
  ['Hank Greenberg','1B','R','R','1920s-40s','slugger',92],
  ['Lefty Grove','SP','L','L','1920s-40s','ace',94],
  ['Mel Ott','RF','L','R','1920s-40s','power',91],
  ['Bob Feller','SP','R','R','1920s-40s','power',93],
  ['Satchel Paige','SP','R','R','1920s-40s','crafty',92],
  ['Josh Gibson','C','R','R','1920s-40s','slugger',95],
  ['Cool Papa Bell','CF','S','R','1920s-40s','speed',90],
  ['Stan Musial','LF','L','L','1920s-40s','allaround',96],
  // ---- 1950s-1960s ----
  ['Willie Mays','CF','R','R','1950s-60s','allaround',99],
  ['Mickey Mantle','CF','S','R','1950s-60s','power',97],
  ['Hank Aaron','RF','R','R','1950s-60s','power',98],
  ['Sandy Koufax','SP','R','L','1950s-60s','ace',96],
  ['Bob Gibson','SP','R','R','1950s-60s','power',95],
  ['Roberto Clemente','RF','R','R','1950s-60s','allaround',95],
  ['Frank Robinson','RF','R','R','1950s-60s','power',93],
  ['Ernie Banks','SS','R','R','1950s-60s','power',91],
  ['Yogi Berra','C','L','R','1950s-60s','catcher',90],
  ['Warren Spahn','SP','L','L','1950s-60s','control',92],
  ['Whitey Ford','SP','L','L','1950s-60s','control',90],
  ['Al Kaline','RF','R','R','1950s-60s','allaround',91],
  ['Brooks Robinson','3B','R','R','1950s-60s','defense',89],
  ['Harmon Killebrew','1B','R','R','1950s-60s','slugger',90],
  ['Juan Marichal','SP','R','R','1950s-60s','control',90],
  // ---- 1970s ----
  ['Tom Seaver','SP','R','R','1970s','ace',95],
  ['Johnny Bench','C','R','R','1970s','catcher',94],
  ['Joe Morgan','2B','L','R','1970s','allaround',92],
  ['Reggie Jackson','RF','L','L','1970s','slugger',91],
  ['Rod Carew','1B','L','R','1970s','contact',92],
  ['Mike Schmidt','3B','R','R','1970s','power',95],
  ['Nolan Ryan','SP','R','R','1970s','power',94],
  ['Steve Carlton','SP','L','L','1970s','ace',93],
  ['Pete Rose','1B','S','R','1970s','contact',90],
  ['Carl Yastrzemski','LF','L','R','1970s','allaround',90],
  ['Rollie Fingers','CL','R','R','1970s','closer',86],
  ['Gaylord Perry','SP','R','R','1970s','crafty',88],
  ['Willie Stargell','LF','L','L','1970s','slugger',89],
  ['Jim Palmer','SP','R','R','1970s','control',90],
  // ---- 1980s ----
  ['Rickey Henderson','LF','R','L','1980s','leadoff',95],
  ['Wade Boggs','3B','L','R','1980s','contact',91],
  ['Cal Ripken Jr.','SS','R','R','1980s','allaround',92],
  ['Tony Gwynn','RF','L','L','1980s','contact',93],
  ['Ozzie Smith','SS','S','R','1980s','defense',89],
  ['Dale Murphy','CF','R','R','1980s','power',88],
  ['George Brett','3B','L','R','1980s','contact',92],
  ['Robin Yount','SS','R','R','1980s','allaround',90],
  ['Roger Clemens','SP','R','R','1980s','power',96],
  ['Dennis Eckersley','CL','R','R','1980s','closer',88],
  ['Ryne Sandberg','2B','R','R','1980s','allaround',89],
  ['Eddie Murray','1B','S','R','1980s','power',89],
  ['Dwight Gooden','SP','R','R','1980s','power',87],
  ['Andre Dawson','RF','R','R','1980s','power',88],
  ['Alan Trammell','SS','R','R','1980s','allaround',86],
  // ---- 1990s ----
  ['Ken Griffey Jr.','CF','L','L','1990s','allaround',97],
  ['Barry Bonds','LF','L','L','1990s','power',98],
  ['Greg Maddux','SP','R','R','1990s','control',96],
  ['Frank Thomas','1B','R','R','1990s','slugger',93],
  ['Pedro Martinez','SP','R','R','1990s','ace',97],
  ['Randy Johnson','SP','R','L','1990s','power',96],
  ['Jeff Bagwell','1B','R','R','1990s','power',92],
  ['Craig Biggio','2B','R','R','1990s','allaround',89],
  ['Mike Piazza','C','R','R','1990s','slugger',92],
  ['Roberto Alomar','2B','S','R','1990s','allaround',90],
  ['John Smoltz','SP','R','R','1990s','power',91],
  ['Tom Glavine','SP','L','L','1990s','control',90],
  ['Curt Schilling','SP','R','R','1990s','power',91],
  ['Mariano Rivera','CL','R','R','1990s','closer',95],
  ['Trevor Hoffman','CL','R','R','1990s','closer',88],
  ['Larry Walker','RF','L','R','1990s','allaround',91],
  ['Chipper Jones','3B','S','R','1990s','power',91],
  ['Kenny Lofton','CF','L','L','1990s','speed',86],
  ['Edgar Martinez','DH','R','R','1990s','contact',90],
  // ---- Steroid Era / 2000s ----
  ['Alex Rodriguez','SS','R','R','Steroid Era','power',96],
  ['Albert Pujols','1B','R','R','Steroid Era','power',96],
  ['Manny Ramirez','LF','R','R','Steroid Era','slugger',92],
  ['Sammy Sosa','RF','R','R','Steroid Era','slugger',89],
  ['Mark McGwire','1B','R','R','Steroid Era','slugger',90],
  ['Vladimir Guerrero','RF','R','R','Steroid Era','power',93],
  ['Derek Jeter','SS','R','R','Steroid Era','contact',91],
  ['Ichiro Suzuki','RF','L','R','Steroid Era','speed',92],
  ['Jim Thome','1B','L','R','Steroid Era','slugger',90],
  ['David Ortiz','DH','L','L','Steroid Era','slugger',92],
  ['Miguel Cabrera','3B','R','R','Steroid Era','power',94],
  ['Johan Santana','SP','L','L','Steroid Era','ace',90],
  ['Roy Halladay','SP','R','R','Steroid Era','workhorse',93],
  ['CC Sabathia','SP','L','L','Steroid Era','workhorse',88],
  ['Chase Utley','2B','L','R','Steroid Era','allaround',88],
  ['Todd Helton','1B','L','R','Steroid Era','contact',88],
  ['Carlos Beltran','CF','S','R','Steroid Era','allaround',89],
  ['Scott Rolen','3B','R','R','Steroid Era','defense',87],
  ['Andruw Jones','CF','R','R','Steroid Era','defense',88],
  ['Billy Wagner','CL','L','L','Steroid Era','closer',87],
  // ---- 2010s / Current ----
  ['Mike Trout','CF','R','R','Current Stars','allaround',97],
  ['Mookie Betts','RF','R','R','Current Stars','allaround',94],
  ['Aaron Judge','RF','R','R','Current Stars','slugger',95],
  ['Clayton Kershaw','SP','L','L','Current Stars','ace',94],
  ['Max Scherzer','SP','R','R','Current Stars','power',93],
  ['Justin Verlander','SP','R','R','Current Stars','power',92],
  ['Jacob deGrom','SP','L','R','Current Stars','ace',94],
  ['Freddie Freeman','1B','L','R','Current Stars','contact',91],
  ['Jose Altuve','2B','R','R','Current Stars','contact',89],
  ['Nolan Arenado','3B','R','R','Current Stars','defense',90],
  ['Francisco Lindor','SS','S','R','Current Stars','allaround',90],
  ['Bryce Harper','RF','L','R','Current Stars','power',92],
  ['Manny Machado','3B','R','R','Current Stars','power',91],
  ['Juan Soto','RF','L','L','Current Stars','power',94],
  ['Yordan Alvarez','DH','L','R','Current Stars','slugger',92],
  ['Gerrit Cole','SP','R','R','Current Stars','power',92],
  ['Corey Seager','SS','L','R','Current Stars','power',89],
  ['Jose Ramirez','3B','S','R','Current Stars','allaround',90],
  ['Vladimir Guerrero Jr.','1B','R','R','Current Stars','power',90],
  ['Ronald Acuna Jr.','RF','R','R','Current Stars','allaround',94],
  ['Bobby Witt Jr.','SS','R','R','Current Stars','allaround',91],
  ['Gunnar Henderson','SS','L','R','Current Stars','allaround',89],
  ['Emmanuel Clase','CL','R','R','Current Stars','closer',89],
  ['Edwin Diaz','CL','R','R','Current Stars','closer',88],
  ['Spencer Strider','SP','R','R','Current Stars','power',89],
  ['Kyle Tucker','RF','L','R','Current Stars','allaround',89],
  ['Marcus Semien','2B','R','R','Current Stars','allaround',86],
  ['Matt Olson','1B','L','R','Current Stars','slugger',88],
  ['Adley Rutschman','C','S','R','Current Stars','catcher',87],
  ['William Contreras','C','R','R','Current Stars','catcher',85],
  // ---- Deeper regulars / role players across eras (solid, not stars) ----
  ['Don Mattingly','1B','L','L','1980s','contact',86],
  ['Keith Hernandez','1B','L','L','1980s','defense',84],
  ['Dave Winfield','RF','R','R','1980s','power',87],
  ['Gary Carter','C','R','R','1980s','catcher',86],
  ['Lou Whitaker','2B','L','R','1980s','allaround',84],
  ['Tim Raines','LF','S','R','1980s','leadoff',88],
  ['Fernando Valenzuela','SP','L','L','1980s','crafty',83],
  ['Orel Hershiser','SP','R','R','1980s','control',84],
  ['Bret Saberhagen','SP','R','R','1980s','control',84],
  ['Will Clark','1B','L','L','1990s','contact',85],
  ['Barry Larkin','SS','R','R','1990s','allaround',88],
  ['Kirby Puckett','CF','R','R','1990s','contact',87],
  ['Tim Salmon','RF','R','R','1990s','power',82],
  ['Bernie Williams','CF','S','R','1990s','allaround',85],
  ['Paul O’Neill','RF','L','L','1990s','contact',82],
  ['David Cone','SP','R','R','1990s','power',86],
  ['Kevin Brown','SP','R','R','1990s','power',86],
  ['Moises Alou','LF','R','R','1990s','power',83],
  ['Jeff Kent','2B','R','R','1990s','power',85],
  ['Jim Edmonds','CF','L','L','Steroid Era','defense',86],
  ['Bobby Abreu','RF','L','R','Steroid Era','allaround',85],
  ['Lance Berkman','1B','S','R','Steroid Era','power',86],
  ['Magglio Ordonez','RF','R','R','Steroid Era','contact',83],
  ['Roy Oswalt','SP','R','R','Steroid Era','control',85],
  ['Tim Hudson','SP','R','R','Steroid Era','control',83],
  ['Mark Buehrle','SP','L','L','Steroid Era','crafty',82],
  ['Torii Hunter','CF','R','R','Steroid Era','defense',83],
  ['Adrian Beltre','3B','R','R','Steroid Era','defense',90],
  ['Joe Mauer','C','L','R','Steroid Era','contact',87],
  ['Dustin Pedroia','2B','R','R','Steroid Era','allaround',84],
  ['Robinson Cano','2B','L','R','Steroid Era','contact',87],
  ['Felix Hernandez','SP','R','R','Steroid Era','power',88],
  ['Cole Hamels','SP','L','L','Steroid Era','control',84],
  ['Zack Greinke','SP','R','R','Current Stars','control',88],
  ['Paul Goldschmidt','1B','R','R','Current Stars','power',88],
  ['Anthony Rizzo','1B','L','L','Current Stars','power',84],
  ['Christian Yelich','LF','L','R','Current Stars','allaround',87],
  ['Trea Turner','SS','R','R','Current Stars','speed',88],
  ['Xander Bogaerts','SS','R','R','Current Stars','contact',85],
  ['J.T. Realmuto','C','R','R','Current Stars','catcher',86],
  ['Salvador Perez','C','R','R','Current Stars','catcher',84],
  ['DJ LeMahieu','2B','R','R','Current Stars','contact',83],
  ['George Springer','CF','R','R','Current Stars','power',85],
  ['Starling Marte','CF','R','R','Current Stars','speed',83],
  ['Pete Alonso','1B','R','R','Current Stars','slugger',86],
  ['Rafael Devers','3B','L','R','Current Stars','power',88],
  ['Ozzie Albies','2B','S','R','Current Stars','allaround',84],
  ['Austin Riley','3B','R','R','Current Stars','power',86],
  ['Sandy Alcantara','SP','R','R','Current Stars','workhorse',87],
  ['Corbin Burnes','SP','R','R','Current Stars','ace',89],
  ['Shane Bieber','SP','R','R','Current Stars','control',85],
  ['Framber Valdez','SP','L','L','Current Stars','workhorse',85],
  ['Josh Hader','CL','L','L','Current Stars','closer',88],
  ['Ryan Helsley','CL','R','R','Current Stars','closer',86],
  ['Devin Williams','CL','R','R','Current Stars','closer',86],
  ['Logan Webb','SP','R','R','Current Stars','control',85],
  ['Tarik Skubal','SP','L','L','Current Stars','ace',90],
];

const cards = P.map((row, i) => {
  const [name, pos, bats, throws, era, arch, overall] = row;
  const pitcher = isPitcherPos(pos) || PITCHER_ARCH.has(arch) && isPitcherPos(pos);
  const positions = [pos];
  return {
    id: `real-${i + 1}`,
    name, team: '', positions, bats, throws,
    stats: {},
    overall,
    category: categoryFor(era, overall),
    era,
    grades: gradesFor(arch, overall, isPitcherPos(pos)),
  };
});

const out = path.join(__dirname, '..', 'src', 'data', 'real-players.json');
fs.writeFileSync(out, JSON.stringify(cards, null, 1));
console.log(`Wrote ${cards.length} real players → ${out}`);
