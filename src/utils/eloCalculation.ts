/**
 * Calculate ELO rating change after a match.
 * Uses K-factor of 32 for players with <30 games, 24 for experienced players.
 */
export function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  winnerGames: number
): number {
  const K = winnerGames < 30 ? 32 : 24;
  const expectedScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(K * (1 - expectedScore));
}
