// Random team name generator for draft teams

const CITIES = [
  'Bayport', 'Riverton', 'Summit', 'Lakewood', 'Irondale',
  'Cedarville', 'Ashland', 'Crestview', 'Pinehurst', 'Eastbrook',
  'Stonefield', 'Ridgemont', 'Harborside', 'Maplewood', 'Oakville',
  'Glendale', 'Westfield', 'Fairview', 'Millbrook', 'Brookhaven',
  'Falcon Ridge', 'Coppertown', 'Silverton', 'Cliffside', 'Sandpoint',
  'Northshore', 'Winfield', 'Greendale', 'Stonewall', 'Clearwater',
];

const MASCOTS = [
  'Sluggers', 'Thunder', 'Wolves', 'Hawks', 'Mustangs',
  'Grizzlies', 'Rockets', 'Bandits', 'Vipers', 'Stallions',
  'Raptors', 'Titans', 'Wildcats', 'Cyclones', 'Mavericks',
  'Ironclads', 'Stingrays', 'Trailblazers', 'Warhawks', 'Aces',
  'Hammers', 'Bombers', 'Legends', 'Lancers', 'Firebirds',
  'Barracudas', 'Bison', 'Cobras', 'Phantoms', 'Scorpions',
];


/**
 * Generate two unique team names.
 */
export function generateTeamNames(): [string, string] {
  const cities = [...CITIES];
  const mascots = [...MASCOTS];

  // Pick first team
  const city1Idx = Math.floor(Math.random() * cities.length);
  const city1 = cities.splice(city1Idx, 1)[0];
  const mascot1Idx = Math.floor(Math.random() * mascots.length);
  const mascot1 = mascots.splice(mascot1Idx, 1)[0];

  // Pick second team (guaranteed different)
  const city2 = cities[Math.floor(Math.random() * cities.length)];
  const mascot2 = mascots[Math.floor(Math.random() * mascots.length)];

  return [`${city1} ${mascot1}`, `${city2} ${mascot2}`];
}

/**
 * Generate a CPU team name.
 */
export function generateCPUName(): string {
  return 'Robo Niners';
}

/**
 * Get a short version of a team name (just the mascot).
 * e.g. "Bayport Sluggers" → "Sluggers"
 */
export function getShortName(fullName: string): string {
  const parts = fullName.split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : fullName;
}

/**
 * Get initials for compact display.
 * e.g. "Bayport Sluggers" → "BS", "Falcon Ridge Thunder" → "FRT"
 */
export function getTeamInitials(fullName: string): string {
  return fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
}
