import { GauntletTeam, Player } from './types';
import { autoDraftTeam } from './autoDraft';

// ============================================================================
// Famous Teams — a gauntlet of iconic "real" clubs (fact AND fiction) assembled
// from the card pool by theme. You climb this ladder easiest → hardest. Each is
// built by auto-drafting a full roster from a themed sub-pool near a target
// overall, so it plays a complete 28-man club every time.
// ============================================================================

export interface FamousTeam {
  id: string;
  name: string;
  emoji: string;
  era: string;
  blurb: string;
  budget: number;                     // build budget (also the gauntlet order) —
                                      // the difficulty dial. Calibrated against a
                                      // quality-capped drafted team (a few A's, some
                                      // B's, a lot of C role players): early rungs
                                      // are a warm-up, the back half genuinely tough.
                                      // Spend spreads across lineup AND pitching.
  filter: (p: Player) => boolean;     // themed sub-pool
}

const eraIs = (...eras: string[]) => (p: Player) => !!p.era && eras.includes(p.era);
const catIs = (...cats: string[]) => (p: Player) => !!p.category && cats.includes(p.category);
const teamIs = (...codes: string[]) => (p: Player) => codes.includes(p.team);

// Ordered easiest → hardest. The gauntlet faces them in this sequence.
export const FAMOUS_TEAMS: FamousTeam[] = [
  { id: 'bears', name: 'The Bush League Bears', emoji: '🐻', era: 'Sandlot Saturday',
    blurb: 'Lovable misfits who somehow keep it close. Every dynasty starts here.',
    budget: 370, filter: catIs('busts', 'oddity') },
  { id: 'niners', name: 'The Niners 12U', emoji: '⚾', era: 'The Sandlot',
    blurb: 'Pure heart and grass stains. Do not underestimate the kids.',
    budget: 410, filter: catIs('niners') },
  { id: 'sandlot', name: 'The Sandlot Legends', emoji: '🌳', era: 'The Sandlot',
    blurb: 'The Beast guards the fence. Benny rounds third. Forever.',
    budget: 480, filter: eraIs('The Sandlot') },
  { id: 'hollywood', name: 'The Hollywood Heaters', emoji: '🎬', era: 'Cinematic Classic',
    blurb: 'Wild Thing on the bump, Crash behind the dish, Roy Hobbs at the plate.',
    budget: 550, filter: catIs('fictional') },
  { id: 'intl', name: 'The International XI', emoji: '🌎', era: 'World Baseball',
    blurb: 'Stars from every corner of the globe, here to silence your bats.',
    budget: 610, filter: catIs('international') },
  { id: 'nineties', name: 'The 1990s All-Stars', emoji: '📼', era: '1990s',
    blurb: 'Throwback threads, throwback thunder. The decade that defined a generation.',
    budget: 670, filter: eraIs('1990s', '1980s-90s', '1980s') },
  { id: 'steroid', name: 'The Steroid-Era Mashers', emoji: '💉', era: 'Steroid Era',
    blurb: 'Forearms like oak. The ball has never traveled farther.',
    budget: 730, filter: eraIs('Steroid Era') },
  { id: 'deadball', name: 'The Dead-Ball Legends', emoji: '🪨', era: 'Dead Ball Days',
    blurb: 'Spitballs, small ball, and spikes up. Baseball as a knife fight.',
    budget: 790, filter: eraIs('Dead Ball Days') },
  { id: 'bronx', name: 'The Bronx Bombers', emoji: '🗽', era: 'Pinstripe Dynasty',
    blurb: 'Pinstripes and October ghosts. The most feared lineup ever assembled.',
    budget: 870, filter: teamIs('NYY') },
  { id: 'cooperstown', name: 'Cooperstown Immortals', emoji: '🏛️', era: 'Hall of Fame',
    blurb: 'Bronze plaques come to life. There is no weakness in this lineup.',
    budget: 940, filter: catIs('legend') },
  { id: 'mvps', name: 'The Modern MVPs', emoji: '⭐', era: 'Current Stars',
    blurb: "Today's very best, in their primes, all on one impossible roster.",
    budget: 1040, filter: catIs('current') },
  { id: 'peak', name: 'Lightning in a Bottle', emoji: '⚡', era: 'Peak Seasons',
    blurb: 'Every player at the absolute apex of their career. Final boss.',
    budget: 1150, filter: catIs('peak', 'legend') },
];

/** Build a famous team's full roster (themed sub-pool near its difficulty). */
export function buildFamousTeam(ft: FamousTeam): GauntletTeam {
  const team = autoDraftTeam(99, ft.name, ft.filter, ft.budget);
  return team;
}

/** The famous opponent for a given streak (0-indexed ladder), or null past the end. */
export function famousForStreak(streak: number): FamousTeam | null {
  return streak < FAMOUS_TEAMS.length ? FAMOUS_TEAMS[streak] : null;
}

export const FAMOUS_COUNT = FAMOUS_TEAMS.length;
