// Minimal player data lookup for server-side functions
// In production, this would load from a database or bundled JSON
// For now, we define the structure and expect the client to hydrate full Player objects

export interface ServerPlayer {
  id: string;
  name: string;
  team: string;
  positions: string[];
  overall: number;
  category?: string;
}

// Player lookup will be populated from match phase_data
// Server functions operate on player IDs and use the phase_data for state
export function getPlayerById(
  players: Record<string, ServerPlayer>,
  id: string
): ServerPlayer | null {
  return players[id] || null;
}

export function getHighestRatedPlayer(
  playerIds: string[],
  players: Record<string, ServerPlayer>
): string | null {
  if (playerIds.length === 0) return null;

  let bestId = playerIds[0];
  let bestOverall = 0;

  for (const id of playerIds) {
    const player = players[id];
    if (player && player.overall > bestOverall) {
      bestOverall = player.overall;
      bestId = id;
    }
  }

  return bestId;
}
