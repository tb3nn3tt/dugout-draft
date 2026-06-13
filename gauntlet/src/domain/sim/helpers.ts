import { Player, Position, ROSTER_REQUIREMENTS } from '../types';

// Get a display-friendly short name (last name, handling Jr./Sr./II/III suffixes).
// Strips a trailing parenthetical tag first, e.g. "Aroldis Chapman (Cuba)".
export function getDisplayName(name: string): string {
  const clean = name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0]; // Single word name like "KB" or "Nate"

  const suffixes = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'];
  const lastPart = parts[parts.length - 1];

  // If last part is a suffix, use second-to-last + suffix
  if (suffixes.includes(lastPart) && parts.length > 2) {
    return `${parts[parts.length - 2]} ${lastPart}`;
  }

  return lastPart;
}

const NAME_SUFFIXES = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'];
const isNameTag = (s: string) => /^'?\d{2,4}$/.test(s) || NAME_SUFFIXES.includes(s);

/**
 * Compact "F. Surname" abbreviation that KEEPS trailing season/suffix tags on the
 * surname — never drops them onto the initial:
 *   "Ken Griffey '97"  -> "K. Griffey '97"
 *   "Cal Ripken Jr."   -> "C. Ripken Jr."
 *   "Dottie Hinson"    -> "D. Hinson"
 */
export function abbrevName(name: string): string {
  const clean = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return clean || name;
  let end = parts.length - 1;
  const tags: string[] = [];
  while (end > 1 && isNameTag(parts[end])) { tags.unshift(parts[end]); end--; }
  const surname = parts[end];
  return `${parts[0][0]}. ${surname}${tags.length ? ' ' + tags.join(' ') : ''}`;
}

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function getPositionColor(position: Position): string {
  const colors: Record<Position, string> = {
    C: '#e74c3c',
    '1B': '#3498db',
    '2B': '#2ecc71',
    '3B': '#9b59b6',
    SS: '#f39c12',
    LF: '#1abc9c',
    CF: '#e67e22',
    RF: '#d35400',
    DH: '#7f8c8d',
    BC: '#e74c3c',
    PH: '#2980b9',
    PR: '#27ae60',
    IFD: '#16a085',
    OFD: '#d4ac0d',
    SP: '#8e44ad',
    CL: '#c0392b',
    SU: '#e74c3c',
    MRP: '#d35400',
    LRP: '#a04000',
    LOOGY: '#6c3483',
    RP: '#d35400',
    BN: '#7f8c8d',
    HC: '#2c3e50',
    ST: '#1a5276',
  };
  return colors[position] || '#95a5a6';
}

export function getPositionLabel(position: Position): string {
  const labels: Record<Position, string> = {
    C: 'Catcher',
    '1B': '1st Base',
    '2B': '2nd Base',
    '3B': '3rd Base',
    SS: 'Shortstop',
    LF: 'Left Field',
    CF: 'Center Field',
    RF: 'Right Field',
    DH: 'Designated Hitter',
    BC: 'Backup Catcher',
    PH: 'Pinch Hitter',
    PR: 'Pinch Runner',
    IFD: 'IF Def. Sub',
    OFD: 'OF Def. Sub',
    SP: 'Starter',
    CL: 'Closer',
    SU: 'Setup',
    MRP: 'Middle Relief',
    LRP: 'Long Relief',
    LOOGY: 'LOOGY',
    RP: 'Reliever',
    BN: 'Bench',
    HC: 'Head Coach',
    ST: 'Stadium',
  };
  return labels[position] || position;
}

export function formatBattingAvg(avg: number): string {
  return avg.toFixed(3).replace(/^0/, '');
}

export function formatERA(era: number): string {
  return era.toFixed(2);
}

export function getOverallRating(overall: number): { label: string; color: string } {
  if (overall >= 90) return { label: 'Diamond', color: '#00d4ff' };
  if (overall >= 85) return { label: 'Gold', color: '#ffd700' };
  if (overall >= 80) return { label: 'Silver', color: '#c0c0c0' };
  if (overall >= 75) return { label: 'Bronze', color: '#cd7f32' };
  return { label: 'Common', color: '#888' };
}

export function isPitcher(player: Player): boolean {
  // Two-way players (have both hitting and pitching positions) are treated as hitters
  const pitchingPositions = ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
  const hasPitching = player.positions.some(p => pitchingPositions.includes(p));
  const hasHitting = player.positions.some(p => !pitchingPositions.includes(p));
  if (hasPitching && hasHitting) return false; // Two-way = hitter
  return hasPitching;
}

export function isHitter(player: Player): boolean {
  return !isPitcher(player) && !player.positions.includes('HC' as Position) && !player.positions.includes('ST' as Position);
}

export function isCoach(player: Player): boolean {
  return player.positions.includes('HC' as Position);
}

export function isStadium(player: Player): boolean {
  return player.positions.includes('ST' as Position);
}

export function canPlayPosition(player: Player, position: Position): boolean {
  // Exact position match
  if (player.positions.includes(position)) return true;

  // IFD can fill any infield position
  if (['1B', '2B', '3B', 'SS'].includes(position) && player.positions.includes('IFD')) {
    return true;
  }

  // OFD can fill any outfield position
  if (['LF', 'CF', 'RF'].includes(position) && player.positions.includes('OFD')) {
    return true;
  }

  // BC can fill C
  if (position === 'C' && player.positions.includes('BC')) {
    return true;
  }

  return false;
}

export function getRosterNeeds(roster: Player[]): Position[] {
  const counts: Record<Position, number> = {
    C: 0, '1B': 0, '2B': 0, '3B': 0, SS: 0,
    LF: 0, CF: 0, RF: 0, DH: 0,
    BC: 0, PH: 0, PR: 0, IFD: 0, OFD: 0,
    SP: 0, CL: 0, SU: 0, MRP: 0, LRP: 0, LOOGY: 0,
    RP: 0, BN: 0,
    HC: 0, ST: 0,
  };

  roster.forEach(player => {
    const primary = player.positions[0];
    if (primary) counts[primary]++;
  });

  const needs: Position[] = [];
  (Object.keys(ROSTER_REQUIREMENTS) as (keyof typeof ROSTER_REQUIREMENTS)[]).forEach(pos => {
    if (counts[pos] < ROSTER_REQUIREMENTS[pos]) {
      needs.push(pos);
    }
  });

  return needs;
}

export function validateLineup(battingOrder: Player[]): string[] {
  const errors: string[] = [];

  if (battingOrder.length !== 9) {
    errors.push('Batting order must have exactly 9 players');
  }

  const uniqueIds = new Set(battingOrder.map(p => p.id));
  if (uniqueIds.size !== battingOrder.length) {
    errors.push('Batting order cannot have duplicate players');
  }

  const hasPitcher = battingOrder.some(isPitcher);
  if (hasPitcher) {
    errors.push('Batting order should not include pitchers (DH rule)');
  }

  return errors;
}

export function validateRotation(rotation: Player[]): string[] {
  const errors: string[] = [];

  if (rotation.length !== 4) {
    errors.push('Rotation must have exactly 4 starting pitchers');
  }

  const allStarters = rotation.every(p => p.positions.includes('SP'));
  if (!allStarters) {
    errors.push('All rotation pitchers must be starting pitchers');
  }

  return errors;
}

// Convert a 0-99 OVERALL rating to an A-F letter grade (card-facing).
export function overallToGrade(o: number): string {
  if (o >= 95) return 'A+';
  if (o >= 90) return 'A';
  if (o >= 85) return 'A-';
  if (o >= 80) return 'B+';
  if (o >= 75) return 'B';
  if (o >= 70) return 'B-';
  if (o >= 64) return 'C+';
  if (o >= 58) return 'C';
  if (o >= 52) return 'C-';
  if (o >= 46) return 'D+';
  if (o >= 40) return 'D';
  return 'F';
}

// Convert 20-80 grade to letter grade
export function gradeToLetter(grade: number): string {
  if (grade >= 80) return 'A+';
  if (grade >= 75) return 'A';
  if (grade >= 70) return 'B+';
  if (grade >= 65) return 'B';
  if (grade >= 60) return 'B-';
  if (grade >= 55) return 'C+';
  if (grade >= 50) return 'C';
  if (grade >= 45) return 'C-';
  if (grade >= 40) return 'D+';
  if (grade >= 35) return 'D';
  return 'F';
}

// Get grade color for visual display
export function getGradeColor(grade: number): string {
  if (grade >= 80) return '#ffd700'; // Gold for elite
  if (grade >= 70) return '#00d4ff'; // Cyan for plus-plus
  if (grade >= 60) return '#4ade80'; // Green for plus
  if (grade >= 50) return '#94a3b8'; // Gray for average
  if (grade >= 40) return '#f97316'; // Orange for below avg
  return '#ef4444'; // Red for poor
}

// Get specialty badge based on grades
export function getSpecialtyBadge(player: Player): string | null {
  const grades = player.grades;
  if (!grades) return null;

  const isPitch = player.positions.some(p => ['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'].includes(p));

  if (isPitch) {
    const fastball = grades.fastball ?? 50;
    const breaking = grades.breaking ?? 50;
    const control = grades.control ?? 50;

    if (fastball >= 75 && breaking >= 70 && control >= 70) return 'Ace';
    if (fastball >= 80) return 'Power Arm';
    if (control >= 80) return 'Precision';
    if (breaking >= 80) return 'Wipeout Stuff';
    if (fastball >= 70 && breaking >= 70) return 'Strikeout Artist';
    return null;
  } else {
    const contact = grades.contact ?? 50;
    const power = grades.power ?? 50;
    const speed = grades.speed ?? 50;
    const eye = grades.eye ?? 50;
    const fielding = grades.fielding ?? 50;
    const arm = grades.arm ?? 50;

    // 5-Tool: All five tools at 65+
    if (contact >= 65 && power >= 65 && speed >= 65 && fielding >= 65 && arm >= 65) {
      return '5-Tool';
    }
    if (power >= 80) return 'Power Hitter';
    if (speed >= 80) return 'Speedster';
    if (contact >= 80) return 'Contact Master';
    if (eye >= 80) return 'On-Base Machine';
    if (fielding >= 80) return 'Gold Glove';
    if (power >= 70 && speed >= 70) return 'Power-Speed';
    if (contact >= 70 && eye >= 70) return 'Table Setter';
    return null;
  }
}

// Get category badge icon
export function getCategoryBadge(category?: string): string {
  switch (category) {
    case 'legend': return '🏆';
    case 'peak': return '⭐';
    case 'fictional': return '🎬';
    case 'oddity': return '🤪';
    case 'niners': return '⚾';
    case 'decade': return '📻';
    case 'playoff': return '🏟️';
    case 'busts': return '💔';
    case 'coach': return '📋';
    case 'stadium': return '🏟️';
    case 'current': return '';
    default: return '';
  }
}

export function getCategorySetName(category?: string): string {
  switch (category) {
    case 'current': return 'The Show';
    case 'legend': return 'Hall of Famers';
    case 'peak': return 'Lightning in a Bottle';
    case 'fictional': return 'Hollywood Stars';
    case 'oddity': return 'Wild Cards';
    case 'niners': return 'The Niners 12U';
    case 'decade': return 'Throwback Collection';
    case 'playoff': return 'October Legends';
    default: return '';
  }
}
