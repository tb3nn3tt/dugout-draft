import { GauntletTeam, Player, RunPhase, SeriesOutcome } from '../domain/types';
import { DRAFT_SLOTS, offerForSlot } from '../domain/draftFlow';
import { autoDraftTeam } from '../domain/autoDraft';
import { MatchedOpponent } from '../domain/matchmaking';
import { SeriesResult } from '../domain/sim/series';

export interface GauntletState {
  phase: RunPhase;
  teamName: string;
  seed: number;

  // --- draft ---
  picks: Player[];        // chosen cards, in slot order
  offered: Player[];      // candidates for the current slot
  currentSlot: number;    // index into DRAFT_SLOTS

  // --- run ---
  team: GauntletTeam | null;
  streak: number;
  opponent: MatchedOpponent | null;
  lastResult: SeriesResult | null;
  history: SeriesOutcome[];
  totalRunsFor: number;
  totalRunsAgainst: number;
  facedGhostIds: string[];
}

export type GauntletAction =
  | { type: 'START_RUN'; teamName: string; seed: number }
  | { type: 'PICK'; player: Player }
  | { type: 'AUTOFILL_REST' }
  | { type: 'SET_OPPONENT'; opponent: MatchedOpponent }
  | { type: 'RESOLVE_SERIES'; result: SeriesResult }
  | { type: 'NEXT_OPPONENT' }
  | { type: 'BACK_TO_MENU' };

export const initialState: GauntletState = {
  phase: 'menu',
  teamName: '',
  seed: 0,
  picks: [],
  offered: [],
  currentSlot: 0,
  team: null,
  streak: 0,
  opponent: null,
  lastResult: null,
  history: [],
  totalRunsFor: 0,
  totalRunsAgainst: 0,
  facedGhostIds: [],
};

function pickedIds(picks: Player[]): Set<string> {
  return new Set(picks.map(p => p.id));
}

/** Assemble the frozen GauntletTeam from drafted picks. */
function buildTeamFromPicks(name: string, picks: Player[]): GauntletTeam {
  const manager = picks.find(p => p.positions.includes('HC')) ?? null;
  const stadium = picks.find(p => p.positions.includes('ST')) ?? null;
  const roster = picks.filter(p => p !== manager && p !== stadium);
  return { name, roster, manager, stadium };
}

export function gauntletReducer(state: GauntletState, action: GauntletAction): GauntletState {
  switch (action.type) {
    case 'START_RUN': {
      const firstOffers = offerForSlot(DRAFT_SLOTS[0].fills, new Set());
      return {
        ...initialState,
        phase: 'drafting',
        teamName: action.teamName,
        seed: action.seed,
        offered: firstOffers,
        currentSlot: 0,
        facedGhostIds: [],
      };
    }

    case 'PICK': {
      const picks = [...state.picks, action.player];
      const nextSlot = state.currentSlot + 1;

      // Draft complete → freeze team, go find first opponent.
      if (nextSlot >= DRAFT_SLOTS.length) {
        return {
          ...state,
          picks,
          team: buildTeamFromPicks(state.teamName, picks),
          phase: 'matchmaking',
          offered: [],
        };
      }

      return {
        ...state,
        picks,
        currentSlot: nextSlot,
        offered: offerForSlot(DRAFT_SLOTS[nextSlot].fills, pickedIds(picks)),
      };
    }

    case 'AUTOFILL_REST': {
      // Fill every remaining slot with the top offered-style pick, fast.
      const picks = [...state.picks];
      const taken = pickedIds(picks);
      for (let i = state.currentSlot; i < DRAFT_SLOTS.length; i++) {
        const offers = offerForSlot(DRAFT_SLOTS[i].fills, taken);
        const choice = offers[0];
        if (choice) { picks.push(choice); taken.add(choice.id); }
      }
      return {
        ...state,
        picks,
        team: buildTeamFromPicks(state.teamName, picks),
        currentSlot: DRAFT_SLOTS.length,
        phase: 'matchmaking',
        offered: [],
      };
    }

    case 'SET_OPPONENT':
      return { ...state, opponent: action.opponent, phase: 'series' };

    case 'RESOLVE_SERIES': {
      const { result } = action;
      const opp = state.opponent;
      const outcome: SeriesOutcome = {
        opponentName: opp?.displayName ?? 'Unknown',
        opponentStreak: opp?.streak ?? 0,
        won: result.winner === 'you',
        wins: result.youWins,
        losses: result.oppWins,
        runsFor: result.youRuns,
        runsAgainst: result.oppRuns,
      };
      const won = result.winner === 'you';
      return {
        ...state,
        phase: 'series_result',
        lastResult: result,
        history: [...state.history, outcome],
        streak: won ? state.streak + 1 : state.streak,
        totalRunsFor: state.totalRunsFor + result.youRuns,
        totalRunsAgainst: state.totalRunsAgainst + result.oppRuns,
        facedGhostIds: opp?.isGhost && opp.team
          ? [...state.facedGhostIds, /* ghost id tracked by matchmaking layer */ opp.displayName]
          : state.facedGhostIds,
      };
    }

    case 'NEXT_OPPONENT': {
      // Won the last series → on to the next foe (or end the run after a loss).
      const lostLast = state.history[state.history.length - 1]?.won === false;
      if (lostLast) {
        return { ...state, phase: 'run_over', opponent: null };
      }
      return { ...state, phase: 'matchmaking', opponent: null, lastResult: null };
    }

    case 'BACK_TO_MENU':
      return { ...initialState };

    default:
      return state;
  }
}

// Re-exported for the UI layer.
export { autoDraftTeam };
