/**
 * Position Migration Script
 *
 * Migrates player data from old position system to new:
 * - RP → MRP
 * - IF → remove (secondary) or convert
 * - OF → remove (secondary) or convert to LF/CF/RF
 * - Tag bench roles: BC, PH, PR, IFD, OFD
 * - Tag LOOGY for left-handed specialist relievers
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

const DATA_FILES = [
  'players.json',
  'historical-players.json',
  'single-season-players.json',
  'fictional-players.json',
  'niners-players.json',
  'decade-60s70s-players.json',
  'decade-80s90s-players.json',
  'playoff-heroes-players.json',
  'one-year-wonders-players.json',
  'busted-prospects.json',
];

const PITCHING_POSITIONS = ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
const INFIELD_POSITIONS = ['1B', '2B', '3B', 'SS'];
const OUTFIELD_POSITIONS = ['LF', 'CF', 'RF'];

function isPitcher(player) {
  return player.positions.some(p => ['SP', 'CL', 'SU', 'RP', 'MRP', 'LRP', 'LOOGY'].includes(p));
}

function isInfielder(player) {
  return player.positions.some(p => INFIELD_POSITIONS.includes(p));
}

function isOutfielder(player) {
  return player.positions.some(p => OUTFIELD_POSITIONS.includes(p));
}

function migrateFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`  SKIP: ${filename} (not found)`);
    return { players: [], filename };
  }

  const players = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  let rpCount = 0, ifCount = 0, ofCount = 0;

  for (const player of players) {
    // Step 1: RP → MRP
    player.positions = player.positions.map(pos => {
      if (pos === 'RP') { rpCount++; return 'MRP'; }
      return pos;
    });

    // Step 2: Remove IF as secondary position
    if (player.positions.includes('IF')) {
      ifCount++;
      if (player.positions.length > 1) {
        player.positions = player.positions.filter(p => p !== 'IF');
      } else {
        // Solo IF → pick an infield position based on name/context
        player.positions = ['2B'];
      }
    }

    // Step 3: Remove OF as secondary position
    if (player.positions.includes('OF')) {
      ofCount++;
      if (player.positions.length > 1) {
        player.positions = player.positions.filter(p => p !== 'OF');
      } else {
        // Solo OF → pick an outfield position
        player.positions = ['LF'];
      }
    }
  }

  console.log(`  ${filename}: RP→MRP: ${rpCount}, IF removed: ${ifCount}, OF removed: ${ofCount}`);

  // Write back
  fs.writeFileSync(filepath, JSON.stringify(players, null, 2) + '\n');
  return { players, filename };
}

function tagBenchRoles(allFiles) {
  // Collect all players from main file for bench role tagging
  const mainFile = allFiles.find(f => f.filename === 'players.json');
  if (!mainFile) return;

  const players = mainFile.players;
  const hitters = players.filter(p => !isPitcher(p));
  const pitchers = players.filter(p => isPitcher(p));

  // Tag BC: lower-OVR catchers (< 80) who aren't the best at C
  const catchers = hitters.filter(p => p.positions.includes('C'));
  const sortedCatchers = [...catchers].sort((a, b) => a.overall - b.overall);
  const bcCandidates = sortedCatchers.filter(c => c.overall < 80).slice(0, 8);
  for (const p of bcCandidates) {
    if (!p.positions.includes('BC')) p.positions.push('BC');
  }
  console.log(`  BC tagged: ${bcCandidates.length} (${bcCandidates.map(p => p.name).join(', ')})`);

  // Tag PH: hitters with good bat (contact >= 60 or power >= 60) but lower fielding
  const phCandidates = hitters
    .filter(p => {
      const g = p.grades || {};
      const goodBat = (g.contact ?? 50) >= 60 || (g.power ?? 50) >= 60;
      const weakField = (g.fielding ?? 50) < 55;
      const notCatcher = !p.positions.includes('C');
      return goodBat && weakField && notCatcher && !p.positions.includes('PH');
    })
    .sort((a, b) => {
      const aScore = ((a.grades?.contact ?? 50) + (a.grades?.power ?? 50)) / 2;
      const bScore = ((b.grades?.contact ?? 50) + (b.grades?.power ?? 50)) / 2;
      return bScore - aScore;
    })
    .slice(0, 12);
  for (const p of phCandidates) {
    p.positions.push('PH');
  }
  console.log(`  PH tagged: ${phCandidates.length} (${phCandidates.map(p => p.name).join(', ')})`);

  // Tag PR: fast hitters (speed >= 65)
  const prCandidates = hitters
    .filter(p => {
      const speed = p.grades?.speed ?? p.stats?.speed ?? 50;
      return speed >= 65 && !p.positions.includes('PR') && !p.positions.includes('C');
    })
    .sort((a, b) => {
      const aSpd = a.grades?.speed ?? a.stats?.speed ?? 50;
      const bSpd = b.grades?.speed ?? b.stats?.speed ?? 50;
      return bSpd - aSpd;
    })
    .slice(0, 8);
  for (const p of prCandidates) {
    p.positions.push('PR');
  }
  console.log(`  PR tagged: ${prCandidates.length} (${prCandidates.map(p => p.name).join(', ')})`);

  // Tag IFD: infielders with high fielding (>= 65)
  const ifdCandidates = hitters
    .filter(p => {
      const isIF = p.positions.some(pos => INFIELD_POSITIONS.includes(pos));
      const goodField = (p.grades?.fielding ?? 50) >= 65;
      return isIF && goodField && !p.positions.includes('IFD');
    })
    .sort((a, b) => (b.grades?.fielding ?? 50) - (a.grades?.fielding ?? 50))
    .slice(0, 8);
  for (const p of ifdCandidates) {
    p.positions.push('IFD');
  }
  console.log(`  IFD tagged: ${ifdCandidates.length} (${ifdCandidates.map(p => p.name).join(', ')})`);

  // Tag OFD: outfielders with high fielding (>= 65)
  const ofdCandidates = hitters
    .filter(p => {
      const isOF = p.positions.some(pos => OUTFIELD_POSITIONS.includes(pos));
      const goodField = (p.grades?.fielding ?? 50) >= 65;
      return isOF && goodField && !p.positions.includes('OFD');
    })
    .sort((a, b) => (b.grades?.fielding ?? 50) - (a.grades?.fielding ?? 50))
    .slice(0, 8);
  for (const p of ofdCandidates) {
    p.positions.push('OFD');
  }
  console.log(`  OFD tagged: ${ofdCandidates.length} (${ofdCandidates.map(p => p.name).join(', ')})`);

  // Tag LOOGY: left-handed relievers with lower stamina / specialist profile
  const lhpRelievers = pitchers.filter(p =>
    p.throws === 'L' &&
    p.positions.some(pos => ['MRP', 'SU'].includes(pos)) &&
    !p.positions.includes('CL') // Don't convert closers
  );
  const loogyCandidates = lhpRelievers
    .sort((a, b) => (a.grades?.stamina ?? 50) - (b.grades?.stamina ?? 50))
    .slice(0, 6);
  for (const p of loogyCandidates) {
    // Replace MRP with LOOGY (keep other positions)
    p.positions = p.positions.map(pos => pos === 'MRP' ? 'LOOGY' : pos);
    // If they only had SU, add LOOGY
    if (!p.positions.includes('LOOGY')) {
      p.positions.push('LOOGY');
    }
  }
  console.log(`  LOOGY tagged: ${loogyCandidates.length} (${loogyCandidates.map(p => p.name).join(', ')})`);

  // Write back main file
  const filepath = path.join(DATA_DIR, 'players.json');
  fs.writeFileSync(filepath, JSON.stringify(players, null, 2) + '\n');
}

function tagHistoricalBenchRoles(allFiles) {
  // Tag bench roles in historical/special player files too
  const specialFiles = allFiles.filter(f => f.filename !== 'players.json' && f.players.length > 0);

  for (const { players, filename } of specialFiles) {
    const hitters = players.filter(p => !isPitcher(p));
    const pitchers = players.filter(p => isPitcher(p));
    let tagged = 0;

    // BC: lower catchers
    const catchers = hitters.filter(p => p.positions.includes('C') && p.overall < 80);
    for (const p of catchers.slice(0, 3)) {
      if (!p.positions.includes('BC')) { p.positions.push('BC'); tagged++; }
    }

    // PH: good bat hitters
    const phCandidates = hitters
      .filter(p => {
        const g = p.grades || {};
        return ((g.contact ?? 50) >= 60 || (g.power ?? 50) >= 60) && !p.positions.includes('C');
      })
      .slice(0, 4);
    for (const p of phCandidates) {
      if (!p.positions.includes('PH')) { p.positions.push('PH'); tagged++; }
    }

    // PR: fast players
    const prCandidates = hitters
      .filter(p => (p.grades?.speed ?? 50) >= 65)
      .slice(0, 3);
    for (const p of prCandidates) {
      if (!p.positions.includes('PR')) { p.positions.push('PR'); tagged++; }
    }

    // IFD: good-field infielders
    const ifdCandidates = hitters
      .filter(p => isInfielder(p) && (p.grades?.fielding ?? 50) >= 60)
      .slice(0, 3);
    for (const p of ifdCandidates) {
      if (!p.positions.includes('IFD')) { p.positions.push('IFD'); tagged++; }
    }

    // OFD: good-field outfielders
    const ofdCandidates = hitters
      .filter(p => isOutfielder(p) && (p.grades?.fielding ?? 50) >= 60)
      .slice(0, 3);
    for (const p of ofdCandidates) {
      if (!p.positions.includes('OFD')) { p.positions.push('OFD'); tagged++; }
    }

    // LOOGY: LHP relievers
    const loogyCandidates = pitchers
      .filter(p => p.throws === 'L' && p.positions.some(pos => ['MRP', 'SU'].includes(pos)) && !p.positions.includes('CL'))
      .slice(0, 2);
    for (const p of loogyCandidates) {
      p.positions = p.positions.map(pos => pos === 'MRP' ? 'LOOGY' : pos);
      if (!p.positions.includes('LOOGY')) { p.positions.push('LOOGY'); tagged++; }
    }

    if (tagged > 0) {
      console.log(`  ${filename}: ${tagged} bench/LOOGY roles tagged`);
      const filepath = path.join(DATA_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(players, null, 2) + '\n');
    }
  }
}

function validate(allFiles) {
  console.log('\n--- Validation ---');
  let errors = 0;

  for (const { players, filename } of allFiles) {
    const hasRP = players.some(p => p.positions.includes('RP'));
    const hasIF = players.some(p => p.positions.includes('IF'));
    const hasOF = players.some(p => p.positions.includes('OF'));

    if (hasRP) { console.log(`  ERROR: ${filename} still has RP positions`); errors++; }
    if (hasIF) { console.log(`  ERROR: ${filename} still has IF positions`); errors++; }
    if (hasOF) { console.log(`  ERROR: ${filename} still has OF positions`); errors++; }
  }

  // Check bench role counts in main file
  const main = allFiles.find(f => f.filename === 'players.json');
  if (main) {
    const counts = {};
    for (const p of main.players) {
      for (const pos of p.positions) {
        counts[pos] = (counts[pos] || 0) + 1;
      }
    }
    console.log('  Position counts (players.json):', JSON.stringify(counts, null, 2));

    const minRequired = { BC: 4, PH: 6, PR: 4, IFD: 4, OFD: 4, LOOGY: 4 };
    for (const [pos, min] of Object.entries(minRequired)) {
      if ((counts[pos] || 0) < min) {
        console.log(`  WARNING: ${pos} has only ${counts[pos] || 0} players (need at least ${min} for 2-team draft)`);
      }
    }
  }

  if (errors === 0) {
    console.log('  All validations passed!');
  }
}

// Run migration
console.log('=== Position Migration ===\n');
console.log('Step 1: Migrate RP→MRP, remove IF/OF...');
const allFiles = DATA_FILES.map(f => migrateFile(f));

console.log('\nStep 2: Tag bench roles (main file)...');
tagBenchRoles(allFiles);

console.log('\nStep 3: Tag bench roles (historical files)...');
tagHistoricalBenchRoles(allFiles);

// Re-read all files for validation
console.log('\nStep 4: Re-reading files for validation...');
const reloadedFiles = DATA_FILES.map(filename => {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return { players: [], filename };
  return { players: JSON.parse(fs.readFileSync(filepath, 'utf-8')), filename };
});

validate(reloadedFiles);
console.log('\nDone!');
