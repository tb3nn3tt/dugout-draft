import { GauntletTeam, Player, Position, RunPhase, SeriesOutcome } from '../domain/types';
import { MARQUEE_REQUIREMENTS, DEPTH_REQUIREMENTS, spinRound, offerForRound, DraftRound } from '../domain/draftRounds';
import { MatchedOpponent } from '../domain/matchmaking';
import { SeriesResult } from '../domain/sim/series';
import { getMutator } from '../domain/mutators';
import { BUDGET, cardCost } from '../domain/salary';
import { RunTally, emptyRunTally, accumulateSeries } from '../domain/seriesAwards';

export interface DraftEntry { role: Position; player: Player; }

export interface GauntletState {
  phase: RunPhase;
  teamName: string;
  mutatorId: string;
  seed: number;

  // --- draft (spin model) ---
  remaining: Record<string, number>;  // marquee roles still needed
  currentRound: DraftRound | null;     // the spun round being drafted
  offered: Player[];                   // candidates for the current round
  picks: Player[];                     // every drafted card
  draftLog: DraftEntry[];              // which role each pick filled (for the board)
  budget: number;                      // salary-cap points remaining

  // --- run ---
  team: GauntletTeam | null;
  streak: number;
  opponent: MatchedOpponent | null;    // current foe (during auto-run)
  lastResult: SeriesResult | null;
  history: SeriesOutcome[];
  totalRunsFor: number;
  totalRunsAgainst: number;
  facedGhostIds: string[];
  runStats: RunTally;                  // accumulated box scores across the run
}

export type GauntletAction =
  | { type: 'START_RUN'; teamName: string; seed: number; mutatorId: string }
  | { type: 'PICK'; player: Player }
  | { type: 'AUTOFILL_REST' }
  | { type: 'APPEND_SERIES'; opponent: MatchedOpponent; result: SeriesResult }
  | { type: 'END_RUN' }
  | { type: 'BACK_TO_MENU' };

export const initialState: GauntletState = {
  phase: 'menu',
  teamName: '',
  mutatorId: 'standard',
  seed: 0,
  remaining: {},
  currentRound: null,
  offered: [],
  picks: [],
  draftLog: [],
  budget: BUDGET,
  team: null,
  streak: 0,
  opponent: null,
  lastResult: null,
  history: [],
  totalRunsFor: 0,
  totalRunsAgainst: 0,
  facedGhostIds: [],
  runStats: emptyRunTally(),
};

function pickedIds(picks: Player[]): Set<string> {
  return new Set(picks.map(p => p.id));
}

function buildTeamFromPicks(name: string, picks: Player[]): GauntletTeam {
  const manager = picks.find(p => p.positions.includes('HC')) ?? null;
  const stadium = picks.find(p => p.positions.includes('ST')) ?? null;
  const roster = picks.filter(p => p !== manager && p !== stadium);
  return { name, roster, manager, stadium };
}

/** Spin the next marquee round + build its offer, or null when marquee is done. */
function nextRound(
  remaining: Record<string, number>,
  picks: Player[],
  filter: ((p: Player) => boolean) | undefined,
  budget: number
): { round: DraftRound; offered: Player[] } | null {
  const slotsLeft = Object.values(remaining).reduce((a, n) => a + n, 0);
  if (slotsLeft <= 0) return null;
  const round = spinRound(remaining, budget, slotsLeft);
  const offered = offerForRound(round.role, round.tier, pickedIds(picks), round.category, 5, filter, budget);
  return { round, offered };
}

/** Auto-draft the depth roles (extra arms + bench) so the user only picks marquee. */
function fillDepth(
  picks: Player[],
  draftLog: DraftEntry[],
  budget: number,
  filter: ((p: Player) => boolean) | undefined
): void {
  const taken = pickedIds(picks);
  let b = budget;
  for (const [role, count] of Object.entries(DEPTH_REQUIREMENTS)) {
    for (let i = 0; i < count; i++) {
      const offer = offerForRound(role as Position, 'diamond', taken, undefined, 5, filter, b);
      const pick = offer[0];
      if (pick) {
        picks.push(pick);
        draftLog.push({ role: role as Position, player: pick });
        taken.add(pick.id);
        b -= cardCost(pick);
      }
    }
  }
}

/** Marquee draft complete → fill depth, freeze the team, start the auto-run. */
function finishDraft(state: GauntletState, picks: Player[], draftLog: DraftEntry[], budget: number, filter: ((p: Player) => boolean) | undefined): GauntletState {
  fillDepth(picks, draftLog, budget, filter);
  return {
    ...state,
    picks, draftLog,
    remaining: {},
    team: buildTeamFromPicks(state.teamName, picks),
    phase: 'gauntlet',
    currentRound: null,
    offered: [],
  };
}

export function gauntletReducer(state: GauntletState, action: GauntletAction): GauntletState {
  switch (action.type) {
    case 'START_RUN': {
      const filter = getMutator(action.mutatorId).poolFilter;
      const remaining = { ...MARQUEE_REQUIREMENTS };
      const next = nextRound(remaining, [], filter, BUDGET);
      return {
        ...initialState,
        phase: 'drafting',
        teamName: action.teamName,
        mutatorId: action.mutatorId,
        seed: action.seed,
        remaining,
        budget: BUDGET,
        currentRound: next?.round ?? null,
        offered: next?.offered ?? [],
      };
    }

    case 'PICK': {
      if (!state.currentRound) return state;
      const role = state.currentRound.role;
      const picks = [...state.picks, action.player];
      const draftLog = [...state.draftLog, { role, player: action.player }];
      const remaining = { ...state.remaining, [role]: (state.remaining[role] ?? 0) - 1 };
      const budget = state.budget - cardCost(action.player);
      const filter = getMutator(state.mutatorId).poolFilter;
      const next = nextRound(remaining, picks, filter, budget);

      if (!next) return finishDraft({ ...state, budget }, picks, draftLog, budget, filter);
      return { ...state, picks, draftLog, remaining, budget, currentRound: next.round, offered: next.offered };
    }

    case 'AUTOFILL_REST': {
      const filter = getMutator(state.mutatorId).poolFilter;
      const picks = [...state.picks];
      const draftLog = [...state.draftLog];
      const remaining = { ...state.remaining };
      let budget = state.budget;
      let round: DraftRound | null = state.currentRound;
      let offered = state.offered;
      let guard = 0;
      while (round && Object.values(remaining).some(n => n > 0) && guard++ < 30) {
        const choice = offered[0];
        if (choice) {
          picks.push(choice);
          draftLog.push({ role: round.role, player: choice });
          remaining[round.role] = (remaining[round.role] ?? 0) - 1;
          budget -= cardCost(choice);
        }
        const next = nextRound(remaining, picks, filter, budget);
        round = next?.round ?? null;
        offered = next?.offered ?? [];
      }
      return finishDraft({ ...state, budget }, picks, draftLog, budget, filter);
    }

    case 'APPEND_SERIES': {
      const { result, opponent } = action;
      const outcome: SeriesOutcome = {
        opponentName: opponent.displayName,
        opponentStreak: opponent.streak,
        won: result.winner === 'you',
        wins: result.youWins,
        losses: result.oppWins,
        runsFor: result.youRuns,
        runsAgainst: result.oppRuns,
      };
      const won = result.winner === 'you';
      const yourIds = new Set((state.team?.roster ?? []).map(p => p.id));
      return {
        ...state,
        opponent,
        lastResult: result,
        runStats: accumulateSeries(state.runStats, result, yourIds),
        history: [...state.history, outcome],
        streak: won ? state.streak + 1 : state.streak,
        totalRunsFor: state.totalRunsFor + result.youRuns,
        totalRunsAgainst: state.totalRunsAgainst + result.oppRuns,
        facedGhostIds: opponent.isGhost && opponent.id ? [...state.facedGhostIds, opponent.id] : state.facedGhostIds,
      };
    }

    case 'END_RUN':
      return { ...state, phase: 'run_over', opponent: null };

    case 'BACK_TO_MENU':
      return { ...initialState };

    default:
      return state;
  }
}
