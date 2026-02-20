/**
 * Generate avatar manifest for all players with team colors.
 * Run: node scripts/generate-avatar-manifest.js
 * Output: avatar-manifest.json (ready for image generation service)
 */

const fs = require('fs');
const path = require('path');

// Official MLB team colors (primary cap color + secondary accent)
const TEAM_COLORS = {
  ARI: { primary: "#A71930", secondary: "#E3D4AD", name: "Arizona Diamondbacks" },
  ATL: { primary: "#CE1141", secondary: "#13274F", name: "Atlanta Braves" },
  BAL: { primary: "#DF4601", secondary: "#000000", name: "Baltimore Orioles" },
  BOS: { primary: "#BD3039", secondary: "#0C2340", name: "Boston Red Sox" },
  CHC: { primary: "#0E3386", secondary: "#CC3433", name: "Chicago Cubs" },
  CHW: { primary: "#27251F", secondary: "#C4CED4", name: "Chicago White Sox" },
  CIN: { primary: "#C6011F", secondary: "#000000", name: "Cincinnati Reds" },
  CLE: { primary: "#00385D", secondary: "#E50022", name: "Cleveland Guardians" },
  COL: { primary: "#33006F", secondary: "#C4CED4", name: "Colorado Rockies" },
  DET: { primary: "#0C2340", secondary: "#FA4616", name: "Detroit Tigers" },
  HOU: { primary: "#002D62", secondary: "#EB6E1F", name: "Houston Astros" },
  KC:  { primary: "#004687", secondary: "#BD9B60", name: "Kansas City Royals" },
  LAA: { primary: "#BA0021", secondary: "#003263", name: "Los Angeles Angels" },
  LAD: { primary: "#005A9C", secondary: "#FFFFFF", name: "Los Angeles Dodgers" },
  MIA: { primary: "#000000", secondary: "#00A3E0", name: "Miami Marlins" },
  MIL: { primary: "#FFC52F", secondary: "#12284B", name: "Milwaukee Brewers" },
  MIN: { primary: "#002B5C", secondary: "#D31145", name: "Minnesota Twins" },
  NYM: { primary: "#002D72", secondary: "#FF5910", name: "New York Mets" },
  NYY: { primary: "#0C2340", secondary: "#FFFFFF", name: "New York Yankees" },
  OAK: { primary: "#003831", secondary: "#EFB21E", name: "Oakland Athletics" },
  PHI: { primary: "#E81828", secondary: "#002D72", name: "Philadelphia Phillies" },
  PIT: { primary: "#27251F", secondary: "#FDB827", name: "Pittsburgh Pirates" },
  SD:  { primary: "#2F241D", secondary: "#FFC425", name: "San Diego Padres" },
  SEA: { primary: "#0C2C56", secondary: "#005C5C", name: "Seattle Mariners" },
  SF:  { primary: "#FD5A1E", secondary: "#27251F", name: "San Francisco Giants" },
  STL: { primary: "#C41E3A", secondary: "#0C2340", name: "St. Louis Cardinals" },
  TB:  { primary: "#092C5C", secondary: "#8FBCE6", name: "Tampa Bay Rays" },
  TEX: { primary: "#003278", secondary: "#C0111F", name: "Texas Rangers" },
  TOR: { primary: "#134A8E", secondary: "#1D2D5C", name: "Toronto Blue Jays" },
  WAS: { primary: "#AB0003", secondary: "#14225A", name: "Washington Nationals" },
  // Historical/fictional teams
  MON: { primary: "#003087", secondary: "#E4002B", name: "Montreal Expos" },
  BRK: { primary: "#005A9C", secondary: "#FFFFFF", name: "Brooklyn Dodgers" },
  PHM: { primary: "#003831", secondary: "#EFB21E", name: "Philadelphia Athletics" },
  WSH: { primary: "#AB0003", secondary: "#14225A", name: "Washington Nationals" },
  NYG: { primary: "#FD5A1E", secondary: "#27251F", name: "New York Giants" },
  CAL: { primary: "#BA0021", secondary: "#003263", name: "California Angels" },
  FLA: { primary: "#000000", secondary: "#00A3E0", name: "Florida Marlins" },
  SLT: { primary: "#C41E3A", secondary: "#0C2340", name: "St. Louis (historical)" },
  // Fictional teams
  HOM: { primary: "#FFD700", secondary: "#8B4513", name: "Homer's Team (Simpsons)" },
  DUR: { primary: "#00385D", secondary: "#E50022", name: "Durham Bulls" },
  NYK: { primary: "#003087", secondary: "#E4002B", name: "New York Knights" },
  RPB: { primary: "#C41E3A", secondary: "#FFFFFF", name: "Rockford Peaches" },
  BNB: { primary: "#27251F", secondary: "#FDB827", name: "Bad News Bears" },
  "9RS": { primary: "#333333", secondary: "#FFD700", name: "Niners" },
};

// Player data files
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const dataFiles = [
  'players.json',
  'historical-players.json',
  'fictional-players.json',
  'single-season-players.json',
  'playoff-heroes-players.json',
  'decade-60s70s-players.json',
  'decade-80s90s-players.json',
  'one-year-wonders-players.json',
  'busted-prospects.json',
  'niners-players.json',
];

const allPlayers = [];
const unknownTeams = new Set();

for (const file of dataFiles) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${file}`);
    continue;
  }
  const players = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const p of players) {
    const teamColors = TEAM_COLORS[p.team];
    if (!teamColors) {
      unknownTeams.add(p.team);
    }
    allPlayers.push({
      id: p.id,
      name: p.name,
      team: p.team,
      teamName: teamColors?.name || p.team,
      category: p.category || 'current',
      era: p.era || '',
      positions: p.positions,
      capColor: teamColors?.primary || '#333333',
      accentColor: teamColors?.secondary || '#CCCCCC',
      // Hints for avatar variation (optional use by artist/AI)
      bats: p.bats, // L/R/S — could hint at stance
      isPitcher: (p.positions || []).some(pos => ['SP', 'CL', 'RP', 'SU', 'LRP'].includes(pos)),
    });
  }
}

// Sort by category then name
allPlayers.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.name.localeCompare(b.name);
});

const manifest = {
  _meta: {
    totalPlayers: allPlayers.length,
    generatedAt: new Date().toISOString(),
    imageSpec: {
      size: "384x384",
      format: "PNG",
      background: "transparent or light neutral",
      style: "Simple cartoon headshot, baseball cap, minimal facial detail, flat/lightly shaded, no logos/trademarks",
      naming: "{id}.png (e.g., 1.png, legend-1.png, fiction-1.png)",
    },
    categories: [...new Set(allPlayers.map(p => p.category))],
    teamColorReference: TEAM_COLORS,
  },
  players: allPlayers,
};

if (unknownTeams.size > 0) {
  console.warn('Unknown team codes (using fallback colors):', [...unknownTeams]);
}

const outPath = path.join(__dirname, '..', 'avatar-manifest.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`Generated avatar manifest: ${outPath}`);
console.log(`Total players: ${allPlayers.length}`);
console.log(`Categories: ${[...new Set(allPlayers.map(p => p.category))].join(', ')}`);

// Also generate a simplified CSV for quick reference
const csvLines = ['id,name,team,category,capColor,accentColor,isPitcher'];
for (const p of allPlayers) {
  csvLines.push(`${p.id},"${p.name}",${p.team},${p.category},${p.capColor},${p.accentColor},${p.isPitcher}`);
}
const csvPath = path.join(__dirname, '..', 'avatar-manifest.csv');
fs.writeFileSync(csvPath, csvLines.join('\n'));
console.log(`Also generated CSV: ${csvPath}`);
