import { SeriesState, Player, GameResult } from '../types';
import { isPitcher } from './helpers';

export interface AggregatedBatterStats {
  playerId: string;
  name: string;
  team: 'player1' | 'player2';
  positions: string;
  games: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface AggregatedPitcherStats {
  playerId: string;
  name: string;
  team: 'player1' | 'player2';
  games: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  wins: number;
  losses: number;
  saves: number;
  era: number;
  whip: number;
}

export interface SeriesAward {
  title: string;
  icon: string;
  playerName: string;
  team: 'player1' | 'player2';
  statLine: string;
}

export function aggregateSeriesStats(
  series: SeriesState,
  team1Roster: Player[],
  team2Roster: Player[],
): { batters: AggregatedBatterStats[]; pitchers: AggregatedPitcherStats[] } {
  const batterMap = new Map<string, AggregatedBatterStats>();
  const pitcherMap = new Map<string, AggregatedPitcherStats>();

  const allPlayers = [...team1Roster, ...team2Roster];
  const team1Ids = new Set(team1Roster.map(p => p.id));

  function getTeam(playerId: string): 'player1' | 'player2' {
    return team1Ids.has(playerId) ? 'player1' : 'player2';
  }

  function getPlayer(playerId: string): Player | undefined {
    return allPlayers.find(p => p.id === playerId);
  }

  series.games.forEach((game: GameResult) => {
    if (!game.boxScore) return;

    [game.boxScore.away, game.boxScore.home].forEach(teamBox => {
      teamBox.batters.forEach(batter => {
        const existing = batterMap.get(batter.playerId);
        const player = getPlayer(batter.playerId);
        if (!player) return;

        if (existing) {
          existing.games++;
          existing.ab += batter.ab;
          existing.r += batter.r;
          existing.h += batter.h;
          existing.doubles += batter.doubles ?? 0;
          existing.triples += batter.triples ?? 0;
          existing.hr += batter.hr;
          existing.rbi += batter.rbi;
          existing.bb += batter.bb;
          existing.so += batter.so;
        } else {
          batterMap.set(batter.playerId, {
            playerId: batter.playerId,
            name: batter.name,
            team: getTeam(batter.playerId),
            positions: player.positions.join('/'),
            games: 1,
            ab: batter.ab,
            r: batter.r,
            h: batter.h,
            doubles: batter.doubles ?? 0,
            triples: batter.triples ?? 0,
            hr: batter.hr,
            rbi: batter.rbi,
            bb: batter.bb,
            so: batter.so,
            avg: 0, obp: 0, slg: 0, ops: 0,
          });
        }
      });

      teamBox.pitchers.forEach(pitcher => {
        const existing = pitcherMap.get(pitcher.playerId);

        if (existing) {
          existing.games++;
          existing.ip += pitcher.ip;
          existing.h += pitcher.h;
          existing.r += pitcher.r;
          existing.er += pitcher.er;
          existing.bb += pitcher.bb;
          existing.so += pitcher.so;
          if (pitcher.decision === 'W') existing.wins++;
          if (pitcher.decision === 'L') existing.losses++;
          if (pitcher.decision === 'S') existing.saves++;
        } else {
          pitcherMap.set(pitcher.playerId, {
            playerId: pitcher.playerId,
            name: pitcher.name,
            team: getTeam(pitcher.playerId),
            games: 1,
            ip: pitcher.ip,
            h: pitcher.h,
            r: pitcher.r,
            er: pitcher.er,
            bb: pitcher.bb,
            so: pitcher.so,
            wins: pitcher.decision === 'W' ? 1 : 0,
            losses: pitcher.decision === 'L' ? 1 : 0,
            saves: pitcher.decision === 'S' ? 1 : 0,
            era: 0, whip: 0,
          });
        }
      });
    });
  });

  // Calculate derived stats
  const batters = Array.from(batterMap.values()).map(b => {
    const singles = b.h - b.doubles - b.triples - b.hr;
    const tb = singles + b.doubles * 2 + b.triples * 3 + b.hr * 4;
    b.avg = b.ab > 0 ? b.h / b.ab : 0;
    b.obp = (b.ab + b.bb) > 0 ? (b.h + b.bb) / (b.ab + b.bb) : 0;
    b.slg = b.ab > 0 ? tb / b.ab : 0;
    b.ops = b.obp + b.slg;
    return b;
  });

  const pitchers = Array.from(pitcherMap.values()).map(p => {
    p.era = p.ip > 0 ? (p.er / p.ip) * 9 : 0;
    p.whip = p.ip > 0 ? (p.bb + p.h) / p.ip : 0;
    return p;
  });

  // Sort batters by OPS desc, pitchers by ERA asc
  batters.sort((a, b) => b.ops - a.ops);
  pitchers.sort((a, b) => a.era - b.era);

  return { batters, pitchers };
}

export function calculateAwards(
  batters: AggregatedBatterStats[],
  pitchers: AggregatedPitcherStats[],
  team1Roster: Player[],
  team2Roster: Player[],
): SeriesAward[] {
  const awards: SeriesAward[] = [];
  const allPlayers = [...team1Roster, ...team2Roster];
  const team1Ids = new Set(team1Roster.map(p => p.id));

  function getTeam(playerId: string): 'player1' | 'player2' {
    return team1Ids.has(playerId) ? 'player1' : 'player2';
  }

  // MVP: Highest combined score (HR*4 + RBI*2 + R + AVG_bonus)
  const qualifiedBatters = batters.filter(b => b.ab >= 8);
  if (qualifiedBatters.length > 0) {
    const mvpScores = qualifiedBatters.map(b => ({
      ...b,
      score: b.hr * 4 + b.rbi * 2 + b.r + (b.avg > 0.300 ? 5 : 0) + b.ops * 3,
    }));
    // Also consider pitchers with wins
    const topPitcherScores = pitchers.filter(p => p.ip >= 5).map(p => ({
      playerId: p.playerId,
      name: p.name,
      team: p.team,
      score: p.wins * 10 + p.saves * 5 + (p.era < 3.0 ? 8 : 0) + p.so * 0.5,
    }));
    const allMvpCandidates = [...mvpScores.map(b => ({ playerId: b.playerId, name: b.name, team: b.team, score: b.score })), ...topPitcherScores];
    allMvpCandidates.sort((a, b) => b.score - a.score);
    const mvp = allMvpCandidates[0];
    if (mvp) {
      const batter = batters.find(b => b.playerId === mvp.playerId);
      const pitcher = pitchers.find(p => p.playerId === mvp.playerId);
      let statLine = '';
      if (batter && batter.ab > 0) statLine += `.${Math.round(batter.avg * 1000).toString().padStart(3, '0')} AVG`;
      if (batter && batter.hr > 0) statLine += ` | ${batter.hr} HR`;
      if (batter && batter.rbi > 0) statLine += ` | ${batter.rbi} RBI`;
      if (pitcher && pitcher.wins > 0) statLine += ` | ${pitcher.wins}W`;
      if (pitcher && pitcher.ip > 0) statLine += ` | ${pitcher.era.toFixed(2)} ERA`;
      awards.push({ title: 'World Series MVP', icon: '🏆', playerName: mvp.name, team: mvp.team, statLine: statLine.replace(/^\s*\|\s*/, '') });
    }
  }

  // Silver Slugger: Highest OPS with 10+ AB
  const sluggerCandidates = batters.filter(b => b.ab >= 10);
  if (sluggerCandidates.length > 0) {
    const slugger = sluggerCandidates[0]; // Already sorted by OPS
    awards.push({
      title: 'Silver Slugger',
      icon: '🥇',
      playerName: slugger.name,
      team: slugger.team,
      statLine: `${slugger.ops.toFixed(3)} OPS | ${slugger.hr} HR | ${slugger.rbi} RBI`,
    });
  }

  // Gold Glove: Highest fielding grade among batters who played
  const fielders = batters.filter(b => b.ab >= 5).map(b => {
    const player = allPlayers.find(p => p.id === b.playerId);
    const fldGrade = player?.grades?.fielding ?? 50;
    return { ...b, fielding: fldGrade };
  });
  fielders.sort((a, b) => b.fielding - a.fielding);
  if (fielders.length > 0 && !isPitcher(allPlayers.find(p => p.id === fielders[0].playerId)!)) {
    const gg = fielders[0];
    awards.push({
      title: 'Gold Glove',
      icon: '🧤',
      playerName: gg.name,
      team: gg.team,
      statLine: `${gg.positions} | Fielding Grade: ${gg.fielding}`,
    });
  }

  // Cy Young: Lowest ERA with 5+ IP
  const cyYoungCandidates = pitchers.filter(p => p.ip >= 5);
  if (cyYoungCandidates.length > 0) {
    const cy = cyYoungCandidates[0]; // Already sorted by ERA
    awards.push({
      title: 'Cy Young',
      icon: '💪',
      playerName: cy.name,
      team: cy.team,
      statLine: `${cy.era.toFixed(2)} ERA | ${cy.so} K | ${cy.wins}W-${cy.losses}L`,
    });
  }

  // Mr. October: Most HR in the series
  const hrLeader = [...batters].sort((a, b) => b.hr - a.hr)[0];
  if (hrLeader && hrLeader.hr > 0) {
    awards.push({
      title: 'Mr. October',
      icon: '🎃',
      playerName: hrLeader.name,
      team: hrLeader.team,
      statLine: `${hrLeader.hr} HR | ${hrLeader.rbi} RBI | ${hrLeader.slg.toFixed(3)} SLG`,
    });
  }

  // Clutch Performer: Highest clutch grade among players who got hits
  const clutchCandidates = batters.filter(b => b.h >= 2).map(b => {
    const player = allPlayers.find(p => p.id === b.playerId);
    const clutchGrade = player?.grades?.clutch ?? 50;
    return { ...b, clutchGrade };
  });
  clutchCandidates.sort((a, b) => b.clutchGrade - a.clutchGrade);
  if (clutchCandidates.length > 0 && clutchCandidates[0].clutchGrade > 50) {
    const clutch = clutchCandidates[0];
    awards.push({
      title: 'Clutch Performer',
      icon: '🔥',
      playerName: clutch.name,
      team: getTeam(clutch.playerId),
      statLine: `Clutch Grade: ${clutch.clutchGrade} | ${clutch.h} H | ${clutch.rbi} RBI`,
    });
  }

  return awards;
}
