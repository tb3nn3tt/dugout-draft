// Adaptive CPU skill tracking — persists win/loss history in localStorage
// and computes a skill level (0-100) that scales CPU draft intelligence.

const STORAGE_KEY = 'baseballDraftSim_cpuHistory';
const MAX_HISTORY = 20;
const DEFAULT_SKILL = 35;
const MIN_SKILL = 10;
const MAX_SKILL = 95;
const SKILL_STEP_UP = 8;   // CPU was too easy → increase
const SKILL_STEP_DOWN = 6; // CPU was too hard → decrease

interface CpuGameRecord {
  timestamp: number;
  playerWon: boolean;
  seriesScore: [number, number];
}

interface CpuSkillData {
  history: CpuGameRecord[];
  currentSkill: number;
}

function loadCpuSkillData(): CpuSkillData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Corrupt data — reset
  }
  return { history: [], currentSkill: DEFAULT_SKILL };
}

function saveCpuSkillData(data: CpuSkillData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable
  }
}

function computeSkill(history: CpuGameRecord[]): number {
  if (history.length === 0) return DEFAULT_SKILL;

  let skill = DEFAULT_SKILL;
  for (let i = 0; i < history.length; i++) {
    // Recent games weighted more: 0.5 for oldest → 1.0 for newest
    const recency = history.length === 1
      ? 1.0
      : 0.5 + 0.5 * (i / (history.length - 1));

    if (history[i].playerWon) {
      skill += SKILL_STEP_UP * recency;
    } else {
      skill -= SKILL_STEP_DOWN * recency;
    }
  }

  return Math.round(Math.max(MIN_SKILL, Math.min(MAX_SKILL, skill)));
}

export function getCpuSkill(): number {
  return loadCpuSkillData().currentSkill;
}

export function recordCpuGameResult(
  playerWon: boolean,
  seriesScore: [number, number]
): void {
  const data = loadCpuSkillData();
  data.history.push({
    timestamp: Date.now(),
    playerWon,
    seriesScore,
  });
  // Keep only the most recent games
  if (data.history.length > MAX_HISTORY) {
    data.history = data.history.slice(-MAX_HISTORY);
  }
  data.currentSkill = computeSkill(data.history);
  saveCpuSkillData(data);
}
