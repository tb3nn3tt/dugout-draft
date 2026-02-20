import { AggregatedBatterStats, AggregatedPitcherStats } from './seriesStats';

const STORAGE_KEY = 'baseballDraftSim_records';

export interface RecordEntry {
  playerName: string;
  value: number;
  date: string; // ISO string
}

export interface AllTimeRecords {
  highestAVG: RecordEntry | null;
  mostHR: RecordEntry | null;
  mostRBI: RecordEntry | null;
  lowestERA: RecordEntry | null;
  mostK: RecordEntry | null;
  mostWins: RecordEntry | null;
}

export interface BrokenRecord {
  category: string;
  label: string;
  playerName: string;
  value: string;
  previousRecord: RecordEntry | null;
}

function createEmptyRecords(): AllTimeRecords {
  return {
    highestAVG: null,
    mostHR: null,
    mostRBI: null,
    lowestERA: null,
    mostK: null,
    mostWins: null,
  };
}

export function loadRecords(): AllTimeRecords {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createEmptyRecords();
    const parsed = JSON.parse(stored);
    return { ...createEmptyRecords(), ...parsed };
  } catch {
    return createEmptyRecords();
  }
}

export function saveRecords(records: AllTimeRecords): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function checkAndUpdateRecords(
  batters: AggregatedBatterStats[],
  pitchers: AggregatedPitcherStats[]
): BrokenRecord[] {
  const records = loadRecords();
  const broken: BrokenRecord[] = [];
  const now = new Date().toISOString();

  // Highest AVG (min 10 AB)
  const qualifiedBatters = batters.filter(b => b.ab >= 10);
  if (qualifiedBatters.length > 0) {
    const best = qualifiedBatters.reduce((a, b) => a.avg > b.avg ? a : b);
    if (!records.highestAVG || best.avg > records.highestAVG.value) {
      broken.push({
        category: 'highestAVG',
        label: 'Highest Batting Average',
        playerName: best.name,
        value: formatAvg(best.avg),
        previousRecord: records.highestAVG,
      });
      records.highestAVG = { playerName: best.name, value: best.avg, date: now };
    }
  }

  // Most HR
  const hrLeader = batters.reduce((a, b) => a.hr > b.hr ? a : b, batters[0]);
  if (hrLeader && hrLeader.hr > 0) {
    if (!records.mostHR || hrLeader.hr > records.mostHR.value) {
      broken.push({
        category: 'mostHR',
        label: 'Most Home Runs',
        playerName: hrLeader.name,
        value: `${hrLeader.hr}`,
        previousRecord: records.mostHR,
      });
      records.mostHR = { playerName: hrLeader.name, value: hrLeader.hr, date: now };
    }
  }

  // Most RBI
  const rbiLeader = batters.reduce((a, b) => a.rbi > b.rbi ? a : b, batters[0]);
  if (rbiLeader && rbiLeader.rbi > 0) {
    if (!records.mostRBI || rbiLeader.rbi > records.mostRBI.value) {
      broken.push({
        category: 'mostRBI',
        label: 'Most RBI',
        playerName: rbiLeader.name,
        value: `${rbiLeader.rbi}`,
        previousRecord: records.mostRBI,
      });
      records.mostRBI = { playerName: rbiLeader.name, value: rbiLeader.rbi, date: now };
    }
  }

  // Lowest ERA (min 5 IP)
  const qualifiedPitchers = pitchers.filter(p => p.ip >= 5);
  if (qualifiedPitchers.length > 0) {
    const best = qualifiedPitchers.reduce((a, b) => a.era < b.era ? a : b);
    if (!records.lowestERA || best.era < records.lowestERA.value) {
      broken.push({
        category: 'lowestERA',
        label: 'Lowest ERA',
        playerName: best.name,
        value: best.era.toFixed(2),
        previousRecord: records.lowestERA,
      });
      records.lowestERA = { playerName: best.name, value: best.era, date: now };
    }
  }

  // Most K
  const kLeader = pitchers.reduce((a, b) => a.so > b.so ? a : b, pitchers[0]);
  if (kLeader && kLeader.so > 0) {
    if (!records.mostK || kLeader.so > records.mostK.value) {
      broken.push({
        category: 'mostK',
        label: 'Most Strikeouts',
        playerName: kLeader.name,
        value: `${kLeader.so}`,
        previousRecord: records.mostK,
      });
      records.mostK = { playerName: kLeader.name, value: kLeader.so, date: now };
    }
  }

  // Most Wins
  const winsLeader = pitchers.reduce((a, b) => a.wins > b.wins ? a : b, pitchers[0]);
  if (winsLeader && winsLeader.wins > 0) {
    if (!records.mostWins || winsLeader.wins > records.mostWins.value) {
      broken.push({
        category: 'mostWins',
        label: 'Most Wins',
        playerName: winsLeader.name,
        value: `${winsLeader.wins}`,
        previousRecord: records.mostWins,
      });
      records.mostWins = { playerName: winsLeader.name, value: winsLeader.wins, date: now };
    }
  }

  // Save updated records
  if (broken.length > 0) {
    saveRecords(records);
  }

  return broken;
}

function formatAvg(val: number): string {
  if (val >= 1) return '1.000';
  return '.' + Math.round(val * 1000).toString().padStart(3, '0');
}

export function formatRecordValue(category: string, value: number): string {
  switch (category) {
    case 'highestAVG':
      return formatAvg(value);
    case 'lowestERA':
      return value.toFixed(2);
    default:
      return `${value}`;
  }
}

export const RECORD_LABELS: Record<string, { label: string; icon: string }> = {
  highestAVG: { label: 'Highest Batting Average', icon: '🏅' },
  mostHR: { label: 'Most Home Runs', icon: '💣' },
  mostRBI: { label: 'Most RBI', icon: '🔥' },
  lowestERA: { label: 'Lowest ERA', icon: '🎯' },
  mostK: { label: 'Most Strikeouts', icon: '💨' },
  mostWins: { label: 'Most Wins', icon: '🏆' },
};
