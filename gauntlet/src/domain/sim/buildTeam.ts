import { DraftedTeam, GauntletTeam, Player } from '../types';
import {
  generateOptimalLineup,
  generateOptimalRotation,
  generateOptimalBullpen,
} from './lineupBuilder';

/**
 * Turn a frozen GauntletTeam (just cards) into a sim-ready DraftedTeam with a
 * derived batting order, 4-man rotation, closer, and bullpen. The HC and ST
 * cards live in `roster` so getCoachBoosts()/getStadiumEffect() still find them.
 *
 * `owner` is the sim's internal team tag — the gauntlet always passes the human
 * team as 'player1' and the opponent as 'player2'.
 */
export function buildSimTeam(team: GauntletTeam, owner: 'player1' | 'player2'): DraftedTeam {
  // Include manager + stadium in the roster so synergy/coach/park lookups work.
  const roster: Player[] = [...team.roster];
  if (team.manager && !roster.some(p => p.id === team.manager!.id)) roster.push(team.manager);
  if (team.stadium && !roster.some(p => p.id === team.stadium!.id)) roster.push(team.stadium);

  const battingOrder = generateOptimalLineup(roster, team.lineup).map(e => e.player);
  const rotation = generateOptimalRotation(roster);
  const bullpenConfig = generateOptimalBullpen(roster);
  const bullpen = [
    ...bullpenConfig.setup,
    ...bullpenConfig.middleRelief,
    ...bullpenConfig.longRelief,
  ];

  return {
    owner,
    name: team.name,
    roster,
    battingOrder,
    rotation,
    closer: bullpenConfig.closer,
    bullpen,
  };
}
