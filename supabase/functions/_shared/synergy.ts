// Server-side synergy engine (Deno-compatible port)
// Mirrors the logic from src/utils/synergy.ts

export interface StatBoost {
  offensiveBonus: number;
  pitchingBonus: number;
}

const TEAM_SYNERGY_THRESHOLD = 5;
const TEAM_SYNERGY_BONUS = 3;
const BATTERY_BONUS = 5;

interface MinimalPlayer {
  id: string;
  team: string;
  positions: string[];
}

export function calculateStatBoosts(
  roster: MinimalPlayer[],
  batter: MinimalPlayer,
  pitcher: MinimalPlayer,
  catcher: MinimalPlayer | null,
): StatBoost {
  let offensiveBonus = 1.0;
  let pitchingBonus = 1.0;

  // Team synergies
  const teamCounts: Record<string, number> = {};
  for (const p of roster) {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
  }

  const synergyTeams = new Set(
    Object.entries(teamCounts)
      .filter(([, count]) => count >= TEAM_SYNERGY_THRESHOLD)
      .map(([team]) => team)
  );

  if (synergyTeams.has(batter.team)) {
    offensiveBonus += TEAM_SYNERGY_BONUS / 100;
  }
  if (synergyTeams.has(pitcher.team)) {
    pitchingBonus += TEAM_SYNERGY_BONUS / 100;
  }

  // Battery bonus
  if (catcher && pitcher.team === catcher.team) {
    pitchingBonus += BATTERY_BONUS / 100;
    if (batter.id === catcher.id) {
      offensiveBonus += BATTERY_BONUS / 100;
    }
  }

  return { offensiveBonus, pitchingBonus };
}
