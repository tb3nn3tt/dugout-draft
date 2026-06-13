import { Player } from './types';
import { playersPool, managersPool, stadiumsPool } from './players';
import { getRatings } from './ratings';

// ============================================================================
// GROUPS — the spin-the-wheel categories that replace tier rounds. Every player
// belongs to MANY groups, auto-derived from real identity (team, era, category)
// and from their ratings (archetypes) and position. A spin picks a group; you
// then choose one of its players to slot onto your roster. Hundreds of groups,
// generated once from the pool, so the wheel always feels fresh.
// ============================================================================

export interface Group {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  memberIds: string[];
}

const avg = (a: number, b: number) => Math.round((a + b) / 2);

// Friendly names for the team codes that actually appear in the pool.
const TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Diamondbacks', ATL: 'Atlanta Braves', BAL: 'Baltimore Orioles',
  BOS: 'Boston Red Sox', CHC: 'Chicago Cubs', CHW: 'Chicago White Sox',
  CIN: 'Cincinnati Reds', CLE: 'Cleveland Guardians', COL: 'Colorado Rockies',
  DET: 'Detroit Tigers', FLA: 'Florida Marlins', HOU: 'Houston Astros',
  KC: 'Kansas City Royals', LAA: 'Los Angeles Angels', LAD: 'Los Angeles Dodgers',
  MIL: 'Milwaukee Brewers', MIN: 'Minnesota Twins', MON: 'Montreal Expos',
  NYM: 'New York Mets', NYY: 'New York Yankees', OAK: 'Oakland Athletics',
  PHI: 'Philadelphia Phillies', PIT: 'Pittsburgh Pirates', SD: 'San Diego Padres',
  SEA: 'Seattle Mariners', SF: 'San Francisco Giants', STL: 'St. Louis Cardinals',
  TB: 'Tampa Bay Rays', TEX: 'Texas Rangers', TOR: 'Toronto Blue Jays', WSH: 'Washington Nationals',
  MIA: 'Miami Marlins', CAL: 'California Angels',
};

const CATEGORY_GROUPS: { cat: string; name: string; emoji: string; blurb: string }[] = [
  { cat: 'legend', name: 'Cooperstown Immortals', emoji: '🏛️', blurb: 'Bronze plaques come to life.' },
  { cat: 'fictional', name: 'Hollywood Heroes', emoji: '🎬', blurb: 'Straight off the silver screen.' },
  { cat: 'niners', name: 'The Sandlot Kids', emoji: '🧢', blurb: 'Pure heart and grass stains.' },
  { cat: 'playoff', name: 'October Heroes', emoji: '🍂', blurb: 'Forged under the brightest lights.' },
  { cat: 'international', name: 'World Baseball Stars', emoji: '🌎', blurb: 'Stars from every corner of the globe.' },
  { cat: 'busts', name: 'Bust or Boom', emoji: '🎲', blurb: 'Phenoms who never were — or maybe will be.' },
  { cat: 'oddity', name: 'Cult Heroes & Weirdos', emoji: '🃏', blurb: 'One-game wonders and beautiful oddballs.' },
  { cat: 'current', name: "Today's Stars", emoji: '⭐', blurb: 'The best playing the game right now.' },
  { cat: 'peak', name: 'Peak Seasons', emoji: '⚡', blurb: 'Every player at their absolute apex.' },
];

const isHitter = (p: Player) => getRatings(p).kind === 'hitter';
const isPitcher = (p: Player) => getRatings(p).kind === 'pitcher';

function buildGroups(): Group[] {
  const groups: Group[] = [];
  const add = (id: string, name: string, emoji: string, blurb: string, filter: (p: Player) => boolean, min = 4) => {
    const memberIds = playersPool.filter(filter).map(p => p.id);
    if (memberIds.length >= min) groups.push({ id, name, emoji, blurb, memberIds });
  };

  // --- Real franchises ---
  for (const [code, name] of Object.entries(TEAM_NAMES)) {
    add(`team-${code}`, name, '⚾', `The ${name} all-time roster.`, p => p.team === code, 8);
  }

  // --- Eras (real decades/periods only — movie titles carry "(YYYY)", handled below) ---
  const eras = [...new Set(playersPool.map(p => p.era).filter(Boolean))] as string[];
  for (const era of eras) {
    if (era.includes('(')) continue;
    add(`era-${era}`, era, '📅', `Ballplayers of ${era}.`, p => p.era === era, 6);
  }

  // --- Movie & TV casts — fictional players carry their film/show as `era`.
  // Only real titles (with a "(YYYY)" year) become film groups; the lore flavor-
  // eras without a year stay as normal era groups above. Avoids duplicates. ---
  const films = [...new Set(playersPool
    .filter(p => p.category === 'fictional' && p.era && /\(\d{4}\)\s*$/.test(p.era))
    .map(p => p.era as string))];
  const usedNames = new Set(groups.map(g => g.name));
  for (const film of films) {
    const bare = film.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const title = usedNames.has(bare) ? film : bare; // keep year if it'd collide (e.g. "The Sandlot")
    add(`film-${film}`, title, '🎬', `The cast of ${title}.`, p => p.category === 'fictional' && p.era === film, 3);
    usedNames.add(title);
  }

  // --- Card categories ---
  for (const g of CATEGORY_GROUPS) add(`cat-${g.cat}`, g.name, g.emoji, g.blurb, p => p.category === g.cat);

  // --- Hitter archetypes (from ratings) ---
  add('arch-slugger', 'The Sluggers', '💪', 'Light-tower power.', p => { const r = getRatings(p); return r.kind === 'hitter' && avg(r.hrVL, r.hrVR) >= 66; });
  add('arch-contact', 'Pure Hitters', '🎯', 'They just don\'t miss.', p => { const r = getRatings(p); return r.kind === 'hitter' && avg(r.conVL, r.conVR) >= 66; });
  add('arch-burner', 'The Burners', '⚡', 'Blazing, base-stealing speed.', p => { const r = getRatings(p); return r.kind === 'hitter' && r.run >= 68; });
  add('arch-glove', 'The Wizards', '🧤', 'Defensive magicians.', p => { const r = getRatings(p); return r.kind === 'hitter' && r.field >= 68; });
  add('arch-eye', 'On-Base Machines', '👁️', 'A walk is as good as a hit.', p => { const r = getRatings(p); return r.kind === 'hitter' && r.eye >= 66; });
  add('arch-5tool', 'Five-Tool Talents', '🌟', 'They do everything well.', p => { const r = getRatings(p); if (r.kind !== 'hitter') return false; const t = [avg(r.hrVL, r.hrVR) >= 60, avg(r.conVL, r.conVR) >= 60, r.run >= 60, r.field >= 60, r.eye >= 60].filter(Boolean).length; return t >= 4; });
  add('arch-leadoff', 'Leadoff Men', '🏃', 'Speed and on-base at the top.', p => { const r = getRatings(p); return r.kind === 'hitter' && r.run >= 60 && r.eye >= 58; });

  // --- Pitcher archetypes ---
  add('arch-flame', 'The Flamethrowers', '🔥', 'Pure heat and swing-and-miss.', p => { const r = getRatings(p); return r.kind === 'pitcher' && avg(r.stuffVL, r.stuffVR) >= 66; });
  add('arch-control', 'Control Artists', '🎯', 'They paint the corners.', p => { const r = getRatings(p); return r.kind === 'pitcher' && r.control >= 66; });
  add('arch-workhorse', 'The Workhorses', '🐴', 'Innings eaters who never tire.', p => { const r = getRatings(p); return r.kind === 'pitcher' && r.stamina >= 68; });
  add('arch-groundball', 'Ground-Ball Kings', '⬇️', 'Worms beware.', p => { const r = getRatings(p); return r.kind === 'pitcher' && r.gb >= 50; });
  add('arch-crafty', 'Crafty Lefties & Junkballers', '🧠', 'Guile over gas.', p => { const r = getRatings(p); return r.kind === 'pitcher' && avg(r.cmdVL, r.cmdVR) >= 64; });

  // --- Position specialties ---
  add('pos-aces', 'The Aces', '🅰️', 'Front-of-the-rotation horses.', p => p.positions[0] === 'SP' && p.overall >= 84);
  add('pos-closers', 'Lockdown Closers', '🔒', 'Slam the door in the ninth.', p => p.positions[0] === 'CL');
  add('pos-loogy', 'Lefty Specialists', '🥷', 'Brought in for one big lefty.', p => p.positions[0] === 'LOOGY');
  add('pos-backstops', 'The Backstops', '🧰', 'Catchers who run the game.', p => p.positions[0] === 'C');
  add('pos-mash-c', 'Mashing Catchers', '💣', 'Rare power behind the dish.', p => p.positions[0] === 'C' && isHitter(p) && avg((getRatings(p) as any).hrVL, (getRatings(p) as any).hrVR) >= 58);
  add('pos-ss-glove', 'Wizards at Short', '🪄', 'Slick-fielding shortstops.', p => p.positions[0] === 'SS' && (getRatings(p) as any).field >= 64);
  add('pos-cf-speed', 'Center-Field Gazelles', '🦌', 'They run everything down.', p => p.positions[0] === 'CF' && (getRatings(p) as any).run >= 64);
  add('pos-corner-power', 'Corner Bashers', '🏠', 'Power at the infield corners.', p => ['1B', '3B'].includes(p.positions[0]) && isHitter(p) && avg((getRatings(p) as any).hrVL, (getRatings(p) as any).hrVR) >= 62);
  add('pos-keystone', 'Keystone Combos', '🔁', 'Middle-infield gloves.', p => ['2B', 'SS'].includes(p.positions[0]));
  add('pos-bench', 'Bench Weapons', '🪑', 'Pinch-hit and pinch-run specialists.', p => ['PH', 'PR', 'BC', 'IFD', 'OFD'].includes(p.positions[0]));

  // --- Fun cross-cuts ---
  add('fun-movie-ss', 'Movie Shortstops', '🎥', 'Fictional men up the middle.', p => p.category === 'fictional' && ['SS', '2B'].includes(p.positions[0]));
  add('fun-lefty-mash', 'Lefty Mashers', '🤚', 'Left-handed thump.', p => p.bats === 'L' && isHitter(p) && avg((getRatings(p) as any).hrVL, (getRatings(p) as any).hrVR) >= 60);
  add('fun-switch', 'Switch Hitters', '🔄', 'Dangerous from both sides.', p => p.bats === 'S' && isHitter(p));
  add('fun-flame-pen', 'Power Bullpen Arms', '💨', 'Relievers who bring it.', p => isPitcher(p) && ['CL', 'SU', 'MRP'].includes(p.positions[0]) && avg((getRatings(p) as any).stuffVL, (getRatings(p) as any).stuffVR) >= 60);
  add('fun-diamonds', 'Diamond Tier', '💎', 'The highest-rated cards in the game.', p => p.overall >= 92);
  add('fun-sleepers', 'Hidden Gems', '🔍', 'Underrated role players worth a flier.', p => p.overall >= 66 && p.overall < 76);

  // --- more cross-cuts (quality-mixed, for wheel variety) ---
  const FIELD8 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  add('fun-utility', 'Utility Men', '🧰', 'Do-it-all gloves who line up anywhere.', p => isHitter(p) && p.positions.filter(x => FIELD8.includes(x)).length >= 3);
  add('fun-twoway', 'Two-Way Threats', '🔀', 'They rake AND deal.', p => p.positions.includes('SP') && p.positions.some(x => ['DH', '1B', 'LF', 'RF', 'CF'].includes(x)), 2);
  add('fun-cannon', 'Cannon Arms', '🎯', 'Plus-plus throwing arms.', p => isHitter(p) && (p.grades?.arm ?? 0) >= 66);
  add('fun-vets', 'The Old-Timers', '👴', 'Ballplayers from a bygone era.', p => !!p.era && /19[0-7]0|Dead Ball|Sandlot/.test(p.era));
  add('fun-glovef', 'Glove-First Infield', '🧤', 'Leather wizards around the horn.', p => { const r = getRatings(p); return r.kind === 'hitter' && ['C', '1B', '2B', '3B', 'SS'].includes(p.positions[0]) && r.field >= 64; });
  add('fun-rockets', 'Rocket Launchers', '🚀', 'Light-tower, tape-measure power.', p => { const r = getRatings(p); return r.kind === 'hitter' && avg(r.hrVL, r.hrVR) >= 70; });
  add('fun-contact', 'Contact Maestros', '🪄', 'They square it up every time.', p => { const r = getRatings(p); return r.kind === 'hitter' && avg(r.conVL, r.conVR) >= 70; });
  add('fun-speedd', 'Speed & Defense', '🏃', 'Run it down, then steal a base.', p => { const r = getRatings(p); return r.kind === 'hitter' && r.run >= 62 && r.field >= 60; });

  return groups;
}

export const GROUPS: Group[] = buildGroups();

// Manager + ballpark spins draw from their own pools (single bespoke group each).
export const STAFF_GROUPS = {
  HC: { id: 'staff-hc', name: 'The Skippers', emoji: '🎩', blurb: 'Every great club needs a great mind.', memberIds: managersPool.map(m => m.id) } as Group,
  ST: { id: 'staff-st', name: 'Cathedrals of the Game', emoji: '🏟️', blurb: 'Pick the field you call home.', memberIds: stadiumsPool.map(s => s.id) } as Group,
};
