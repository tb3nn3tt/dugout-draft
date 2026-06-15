import { Player, Tier } from './types';

// Bundled card data. players.json is the main pool; the themed sets widen it.
import playersData from '../data/players.json';
import historical from '../data/historical-players.json';
import singleSeason from '../data/single-season-players.json';
import decade6070 from '../data/decade-60s70s-players.json';
import decade8090 from '../data/decade-80s90s-players.json';
import playoff from '../data/playoff-heroes-players.json';
import steroid from '../data/steroid-era-players.json';
import international from '../data/international-players.json';
import oneYear from '../data/one-year-wonders-players.json';
import busts from '../data/busted-prospects.json';
import fictional from '../data/fictional-players.json';
import niners from '../data/niners-players.json';
import lore from '../data/lore-players.json';
import marquee from '../data/marquee-cards.json';
import extraRegulars from '../data/extra-regulars.json';
import rolePlayers from '../data/role-players.json';
import rolePlayers2 from '../data/role-players-2.json';
import rolePlayers3 from '../data/role-players-3.json';
import realPlayers from '../data/real-players.json';
import coachesData from '../data/coaches.json';
import stadiumsData from '../data/stadiums.json';

// Hitters + pitchers — the draftable athlete pool.
export const playersPool: Player[] = [
  ...(playersData as Player[]),
  ...(historical as Player[]),
  ...(singleSeason as Player[]),
  ...(decade6070 as Player[]),
  ...(decade8090 as Player[]),
  ...(playoff as Player[]),
  ...(steroid as Player[]),
  ...(international as Player[]),
  ...(oneYear as Player[]),
  ...(busts as Player[]),
  ...(fictional as Player[]),
  ...(niners as Player[]),
  ...(lore as Player[]),
  ...(marquee as Player[]),
  ...(extraRegulars as Player[]),
  ...(rolePlayers as Player[]),
  ...(rolePlayers2 as Player[]),
  ...(rolePlayers3 as Player[]),
  ...(realPlayers as Player[]),
];

export const managersPool: Player[] = coachesData as Player[];
export const stadiumsPool: Player[] = stadiumsData as Player[];

// Everything, for hydration by id.
export const allCards: Player[] = [...playersPool, ...managersPool, ...stadiumsPool];

const idMap: Map<string, Player> = (() => {
  const m = new Map<string, Player>();
  for (const c of allCards) m.set(c.id, c);
  return m;
})();

/** Hydrate a list of ids back into full cards (skips any unknown ids). */
export function hydrateIds(ids: string[]): Player[] {
  const out: Player[] = [];
  for (const id of ids) {
    const c = idMap.get(id);
    if (c) out.push(c);
  }
  return out;
}

export function getCard(id: string): Player | undefined {
  return idMap.get(id);
}

/** Map a 0-99 overall onto a card tier (used for pool building + visuals). */
export function getTier(overall: number): Tier {
  if (overall >= 92) return 'diamond';
  if (overall >= 84) return 'gold';
  if (overall >= 75) return 'silver';
  if (overall >= 65) return 'bronze';
  return 'common';
}

export const TIER_COLORS: Record<Tier, string> = {
  diamond: 'var(--diamond)',
  gold: 'var(--gold)',
  silver: 'var(--silver)',
  bronze: 'var(--bronze)',
  common: 'var(--common)',
};
