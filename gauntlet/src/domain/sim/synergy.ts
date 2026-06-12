import { Player, DraftedTeam, SynergyBonus, ActiveSynergies, StatBoost, CoachEffect, ParkEffect } from '../types';

const TEAM_SYNERGY_THRESHOLD = 5;
const TEAM_SYNERGY_BONUS = 3; // 3% bonus
const BATTERY_BONUS = 5; // 5% bonus

/**
 * Calculate team synergies (5+ players from same MLB team)
 */
export function calculateTeamSynergies(roster: Player[]): SynergyBonus[] {
  const teamCounts: Record<string, Player[]> = {};

  roster.forEach(player => {
    if (!teamCounts[player.team]) {
      teamCounts[player.team] = [];
    }
    teamCounts[player.team].push(player);
  });

  const synergies: SynergyBonus[] = [];

  Object.entries(teamCounts).forEach(([team, players]) => {
    if (players.length >= TEAM_SYNERGY_THRESHOLD) {
      synergies.push({
        type: 'team',
        team,
        players,
        bonus: TEAM_SYNERGY_BONUS,
        description: `${team} Connection: ${players.length} players (+${TEAM_SYNERGY_BONUS}% all stats)`,
      });
    }
  });

  return synergies;
}

/**
 * Check if there's a battery bonus (pitcher + catcher from same team)
 */
export function calculateBatteryBonus(
  pitcher: Player,
  catcher: Player
): SynergyBonus | null {
  if (pitcher.team === catcher.team) {
    return {
      type: 'battery',
      team: pitcher.team,
      players: [pitcher, catcher],
      bonus: BATTERY_BONUS,
      description: `Battery Bonus: ${pitcher.name} + ${catcher.name} (+${BATTERY_BONUS}% effectiveness)`,
    };
  }
  return null;
}

/**
 * Get all active synergies for a team during a game
 */
export function getActiveSynergies(
  team: DraftedTeam,
  currentPitcher: Player | null,
  currentCatcher: Player | null
): ActiveSynergies {
  const teamSynergies = calculateTeamSynergies(team.roster);

  let batteryBonus: SynergyBonus | null = null;
  if (currentPitcher && currentCatcher) {
    batteryBonus = calculateBatteryBonus(currentPitcher, currentCatcher);
  }

  return {
    teamSynergies,
    batteryBonus,
  };
}

/**
 * Check if a player is part of an active team synergy
 */
export function playerHasTeamSynergy(
  player: Player,
  synergies: SynergyBonus[]
): boolean {
  return synergies.some(
    s => s.type === 'team' && s.players.some(p => p.id === player.id)
  );
}

/**
 * Extract the head coach's effect from a roster.
 */
export function getCoachBoosts(roster: Player[]): CoachEffect | null {
  const coach = roster.find(p => p.positions.includes('HC' as any));
  return coach?.coachEffect ?? null;
}

/** Neutral park effect (all factors = 1.0) for when no stadium is drafted. */
export const NEUTRAL_PARK: ParkEffect = {
  name: 'Neutral Park',
  hrFactor: 1.0,
  doublesFactor: 1.0,
  triplesFactor: 1.0,
  runFactor: 1.0,
  errorFactor: 1.0,
};

/**
 * Extract the stadium's park effect from a roster.
 */
export function getStadiumEffect(roster: Player[]): ParkEffect | null {
  const stadium = roster.find(p => p.positions.includes('ST' as any));
  return stadium?.parkEffect ?? null;
}

/**
 * Calculate stat boosts based on active synergies and optional coach effect.
 */
export function calculateStatBoosts(
  synergies: ActiveSynergies,
  batter: Player,
  pitcher: Player,
  coachEffect?: CoachEffect | null
): StatBoost {
  let offensiveBonus = 1.0;
  let pitchingBonus = 1.0;

  // Team synergy bonus for batter
  if (playerHasTeamSynergy(batter, synergies.teamSynergies)) {
    offensiveBonus += TEAM_SYNERGY_BONUS / 100;
  }

  // Team synergy bonus for pitcher
  if (playerHasTeamSynergy(pitcher, synergies.teamSynergies)) {
    pitchingBonus += TEAM_SYNERGY_BONUS / 100;
  }

  // Battery bonus
  if (synergies.batteryBonus) {
    // Pitcher gets effectiveness boost
    if (synergies.batteryBonus.players.some(p => p.id === pitcher.id)) {
      pitchingBonus += BATTERY_BONUS / 100;
    }
    // Catcher gets OBP boost (applied as offensive bonus)
    const catcherInBattery = synergies.batteryBonus.players.find(
      p => p.positions.includes('C')
    );
    if (catcherInBattery && catcherInBattery.id === batter.id) {
      offensiveBonus += BATTERY_BONUS / 100;
    }
  }

  // Coach bonuses (applied as percentage boosts)
  if (coachEffect) {
    offensiveBonus += coachEffect.offensiveBonus / 100;
    pitchingBonus += coachEffect.pitchingBonus / 100;
  }

  return { offensiveBonus, pitchingBonus };
}

/**
 * Get team abbreviation full name
 */
export function getTeamFullName(abbrev: string): string {
  const teams: Record<string, string> = {
    LAD: 'Los Angeles Dodgers',
    NYY: 'New York Yankees',
    BOS: 'Boston Red Sox',
    ATL: 'Atlanta Braves',
    HOU: 'Houston Astros',
    PHI: 'Philadelphia Phillies',
    SD: 'San Diego Padres',
    SEA: 'Seattle Mariners',
    TEX: 'Texas Rangers',
    TB: 'Tampa Bay Rays',
    TOR: 'Toronto Blue Jays',
    BAL: 'Baltimore Orioles',
    CLE: 'Cleveland Guardians',
    MIN: 'Minnesota Twins',
    CHW: 'Chicago White Sox',
    KC: 'Kansas City Royals',
    DET: 'Detroit Tigers',
    OAK: 'Oakland Athletics',
    LAA: 'Los Angeles Angels',
    NYM: 'New York Mets',
    MIA: 'Miami Marlins',
    WAS: 'Washington Nationals',
    CHC: 'Chicago Cubs',
    MIL: 'Milwaukee Brewers',
    STL: 'St. Louis Cardinals',
    CIN: 'Cincinnati Reds',
    PIT: 'Pittsburgh Pirates',
    ARI: 'Arizona Diamondbacks',
    COL: 'Colorado Rockies',
    SF: 'San Francisco Giants',
  };
  return teams[abbrev] || abbrev;
}
