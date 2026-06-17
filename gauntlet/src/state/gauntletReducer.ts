import { GauntletTeam, Player, Position, RunPhase, SeriesOutcome } from '../domain/types';
import { MARQUEE_REQUIREMENTS, DEPTH_REQUIREMENTS, spinGroupRound, assignRole, playerFitsRole, offerForRound, DraftRound } from '../domain/draftRounds';
import { MatchedOpponent } from '../domain/matchmaking';
import { SeriesResult } from '../domain/sim/series';
import { getMutator } from '../domain/mutators';
import { BUDGET } from '../domain/salary';
import { rand } from '../domain/sim/rng';
import { RunTally, emptyRunTally, accumulateSeries } from '../domain/seriesAwards';

export interface DraftEntry { role: Position; player: Player; }

export interface GauntletState {
  phase: RunPhase;
  teamName: string;
  mutatorId: string;
  seed: number;
  dailyDate: string | null;            // set → this run is the daily challenge

  // --- draft (spin model) ---
  remaining: Record<string, number>;  // marquee roles still needed
  currentRound: DraftRound | null;     // the spun round being drafted
  offered: Player[];                   // candidates for the current round
  picks: Player[];                     // every drafted card
  draftLog: DraftEntry[];              // which role each pick filled (for the board)
  budget: number;                      // salary-cap points remaining
  rerolls: number;                     // re-spins in the pool (max 3)
  rerollClean: number;                 // picks made since last re-spin (regen at 3 → +1)

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
  | { type: 'START_RUN'; teamName: string; seed: number; mutatorId: string; dailyDate?: string | null }
  | { type: 'PICK'; player: Player }
  | { type: 'REROLL_ROLE' }                      // re-spin to a different open role
  | { type: 'REROLL_PLAYERS' }                   // same role, four new candidates
  | { type: 'AUTOFILL_REST' }
  | { type: 'SWAP_SLOTS'; a: number; b: number } // roster editor: swap two slots' players
  | { type: 'SUBMIT_ROSTER' }                    // lock the roster, start the gauntlet
  | { type: 'APPEND_SERIES'; opponent: MatchedOpponent; result: SeriesResult }
  | { type: 'END_RUN' }
  | { type: 'BACK_TO_MENU' };

// The lineup defensive slots whose assignment the sim honors (incl. DH).
const LINEUP_ROLES = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

// Re-spin economy: a shared pool (max 3). Spending one resets your "clean" run;
// make REGEN_PICKS picks WITHOUT spending one and you earn a re-spin back.
const REROLL_LIMIT = 3;
const REGEN_PICKS = 3;

export const initialState: GauntletState = {
  phase: 'menu',
  teamName: '',
  mutatorId: 'standard',
  seed: 0,
  dailyDate: null,
  remaining: {},
  currentRound: null,
  offered: [],
  picks: [],
  draftLog: [],
  budget: BUDGET,
  rerolls: REROLL_LIMIT,
  rerollClean: 0,
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

function buildTeamFromPicks(name: string, picks: Player[], draftLog: DraftEntry[]): GauntletTeam {
  const manager = picks.find(p => p.positions.includes('HC')) ?? null;
  const stadium = picks.find(p => p.positions.includes('ST')) ?? null;
  const roster = picks.filter(p => p !== manager && p !== stadium);
  // Freeze the player's chosen defensive alignment so the sim honors it.
  const lineup: Record<string, string> = {};
  for (const e of draftLog) {
    if (LINEUP_ROLES.includes(e.role) && !lineup[e.role]) lineup[e.role] = e.player.id;
  }
  return { name, roster, manager, stadium, lineup };
}

/**
 * Spin the next round — a THEMED GROUP whose players can fill an open slot — or
 * null when the roster is full. The pick then auto-assigns to the best open role.
 */
function nextRound(
  remaining: Record<string, number>,
  picks: Player[],
  filter: ((p: Player) => boolean) | undefined
): { round: DraftRound; offered: Player[] } | null {
  return spinGroupRound(remaining, pickedIds(picks), filter);
}

/**
 * Auto-draft the depth roles (extra arms + bench) so the user only picks
 * marquee. Depth is filled at SILVER tier — solid role players, not stars — so
 * the auto-filled bench/bullpen never quietly turns the team into a super-squad.
 */
function fillDepth(
  picks: Player[],
  draftLog: DraftEntry[],
  filter: ((p: Player) => boolean) | undefined
): void {
  const taken = pickedIds(picks);
  for (const [role, count] of Object.entries(DEPTH_REQUIREMENTS)) {
    for (let i = 0; i < count; i++) {
      const offer = offerForRound(role as Position, 'silver', taken, undefined, 5, filter);
      const pick = offer[Math.floor(rand() * Math.min(offer.length, 3)) || 0] ?? offer[0];
      if (pick) {
        picks.push(pick);
        draftLog.push({ role: role as Position, player: pick });
        taken.add(pick.id);
      }
    }
  }
}

/** Marquee draft complete → go to the roster editor (depth + team build happen at submit). */
function finishDraft(state: GauntletState, picks: Player[], draftLog: DraftEntry[]): GauntletState {
  return {
    ...state,
    picks, draftLog,
    remaining: {},
    phase: 'roster_review',
    currentRound: null,
    offered: [],
  };
}

export function gauntletReducer(state: GauntletState, action: GauntletAction): GauntletState {
  switch (action.type) {
    case 'START_RUN': {
      const filter = getMutator(action.mutatorId).poolFilter;
      const remaining = { ...MARQUEE_REQUIREMENTS };
      const next = nextRound(remaining, [], filter);
      return {
        ...initialState,
        phase: 'drafting',
        teamName: action.teamName,
        mutatorId: action.mutatorId,
        seed: action.seed,
        dailyDate: action.dailyDate ?? null,
        remaining,
        budget: BUDGET,
        currentRound: next?.round ?? null,
        offered: next?.offered ?? [],
      };
    }

    case 'PICK': {
      if (!state.currentRound) return state;
      // The picked player auto-slots into the best open role they qualify for.
      const role = assignRole(action.player, state.remaining);
      if (!role) return state; // not eligible for any open slot (shouldn't happen)
      const picks = [...state.picks, action.player];
      const draftLog = [...state.draftLog, { role, player: action.player }];
      const remaining = { ...state.remaining, [role]: (state.remaining[role] ?? 0) - 1 };
      const filter = getMutator(state.mutatorId).poolFilter;
      const next = nextRound(remaining, picks, filter);

      if (!next) return finishDraft(state, picks, draftLog);
      // Clean pick (no re-spin spent this round) → progress the regen meter; earn
      // a re-spin back after REGEN_PICKS clean picks.
      const cleaned = state.rerollClean + 1;
      const regen = cleaned >= REGEN_PICKS && state.rerolls < REROLL_LIMIT;
      return {
        ...state, picks, draftLog, remaining, currentRound: next.round, offered: next.offered,
        rerolls: regen ? state.rerolls + 1 : state.rerolls,
        rerollClean: cleaned >= REGEN_PICKS ? 0 : cleaned,
      };
    }

    case 'REROLL_ROLE': {   // "New Group" — spin a different group
      if (!state.currentRound || state.rerolls <= 0) return state;
      const filter = getMutator(state.mutatorId).poolFilter;
      const next = spinGroupRound(state.remaining, pickedIds(state.picks), filter, { excludeGroupId: state.currentRound.groupId });
      if (!next) return state;
      return { ...state, currentRound: next.round, offered: next.offered, rerolls: state.rerolls - 1, rerollClean: 0 };
    }

    case 'REROLL_PLAYERS': {   // "Refresh" — same group, new members
      if (!state.currentRound || state.rerolls <= 0) return state;
      const filter = getMutator(state.mutatorId).poolFilter;
      const next = spinGroupRound(state.remaining, pickedIds(state.picks), filter, { forceGroupId: state.currentRound.groupId });
      if (!next) return state;
      return { ...state, currentRound: next.round, offered: next.offered, rerolls: state.rerolls - 1, rerollClean: 0 };
    }

    case 'AUTOFILL_REST': {
      const filter = getMutator(state.mutatorId).poolFilter;
      const picks = [...state.picks];
      const draftLog = [...state.draftLog];
      const remaining = { ...state.remaining };
      let offered = state.offered;
      let guard = 0;
      while (Object.values(remaining).some(n => n > 0) && guard++ < 40) {
        const choice = offered[0];
        if (choice) {
          const role = assignRole(choice, remaining);
          if (role) {
            picks.push(choice);
            draftLog.push({ role, player: choice });
            remaining[role] = (remaining[role] ?? 0) - 1;
          }
        }
        const next = nextRound(remaining, picks, filter);
        offered = next?.offered ?? [];
        if (!next) break;
      }
      return finishDraft(state, picks, draftLog);
    }

    case 'SWAP_SLOTS': {
      const { a, b } = action;
      const dl = state.draftLog;
      if (a === b || a < 0 || b < 0 || a >= dl.length || b >= dl.length) return state;
      const ea = dl[a], eb = dl[b];
      // Legal only if each player can play the other's role.
      if (!playerFitsRole(eb.player, ea.role) || !playerFitsRole(ea.player, eb.role)) return state;
      const draftLog = dl.map((e, i) => i === a ? { ...e, player: eb.player } : i === b ? { ...e, player: ea.player } : e);
      return { ...state, draftLog };
    }

    case 'SUBMIT_ROSTER': {
      if (state.phase !== 'roster_review') return state;
      const filter = getMutator(state.mutatorId).poolFilter;
      const picks = [...state.picks];
      const draftLog = [...state.draftLog];
      fillDepth(picks, draftLog, filter); // round out bullpen + bench
      return { ...state, picks, draftLog, team: buildTeamFromPicks(state.teamName, picks, draftLog), phase: 'gauntlet' };
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
