// Supabase Edge Function: Simulate Game
// Runs one game of the World Series server-side

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  simulateAtBat,
  advanceRunners,
  shouldSubstitutePitcher,
  type ScoutingGrades,
} from '../_shared/simulation.ts';
import {
  createInitialMomentum,
  updateMomentum,
  resetHalfInningMomentum,
  updateBatterStreak,
  getStreakModifier,
  type BatterStreakMap,
  type MomentumState,
} from '../_shared/momentumEngine.ts';
import { calculateStatBoosts } from '../_shared/synergy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlayerData {
  id: string;
  name: string;
  team: string;
  positions: string[];
  overall: number;
  grades?: ScoutingGrades;
  stats?: { speed?: number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId, playerId, mode } = await req.json();

    // Fetch match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (!match) throw new Error('Match not found');
    if (match.status !== 'simulating') throw new Error('Match is not in simulating phase');

    const phaseData = (match.phase_data || {}) as Record<string, unknown>;
    const seriesScore = (phaseData.seriesScore as { player1: number; player2: number }) || { player1: 0, player2: 0 };
    const gameNumber = seriesScore.player1 + seriesScore.player2 + 1;

    // Get both teams' setups from phase_data
    const p1Setup = phaseData.player1Setup as Record<string, unknown>;
    const p2Setup = phaseData.player2Setup as Record<string, unknown>;

    if (!p1Setup || !p2Setup) throw new Error('Team setups not found');

    // The actual player data should be stored in phase_data.playerData
    // (hydrated by the client before first simulation call)
    const playerDataMap = (phaseData.playerData as Record<string, PlayerData>) || {};

    // Determine home/away
    const homeTeam = (gameNumber % 2 === 1) ? 'player1' : 'player2';
    const isHomeGame = [1, 2, 6, 7].includes(gameNumber);
    const actualHome = isHomeGame ? homeTeam : (homeTeam === 'player1' ? 'player2' : 'player1');

    // Simulate a quick game
    let score: [number, number] = [0, 0];
    let momentum: MomentumState = createInitialMomentum();
    let streaks: BatterStreakMap = {};

    // Simplified simulation: run 9+ innings
    for (let inning = 1; inning <= 15; inning++) {
      // Top (away bats)
      const topRuns = simulateHalfInning();
      score[0] += topRuns;

      if (inning >= 9 && score[1] > score[0]) break;

      // Bottom (home bats)
      const bottomRuns = simulateHalfInning();
      score[1] += bottomRuns;

      if (inning >= 9 && score[0] !== score[1]) break;
      if (inning >= 9 && score[1] > score[0]) break;
    }

    // Force a winner if still tied
    if (score[0] === score[1]) score[1]++;

    const winner = score[1] > score[0] ? actualHome : (actualHome === 'player1' ? 'player2' : 'player1');

    // Update series score
    const newSeriesScore = {
      player1: seriesScore.player1 + (winner === 'player1' ? 1 : 0),
      player2: seriesScore.player2 + (winner === 'player2' ? 1 : 0),
    };

    const isSeriesOver = newSeriesScore.player1 === 4 || newSeriesScore.player2 === 4;
    const seriesWinner = newSeriesScore.player1 === 4 ? match.player1_id
      : newSeriesScore.player2 === 4 ? match.player2_id
      : null;

    const updatedPhaseData = {
      ...phaseData,
      seriesScore: newSeriesScore,
      currentGameResult: { score, winner, gameNumber },
      games: [...((phaseData.games as unknown[]) || []), { score, winner, gameNumber }],
    };

    const newStatus = isSeriesOver ? 'completed' : 'simulating';

    await supabase
      .from('matches')
      .update({
        phase_data: updatedPhaseData,
        status: newStatus,
        winner_id: seriesWinner,
        completed_at: isSeriesOver ? new Date().toISOString() : null,
      })
      .eq('id', matchId);

    // If series is over, trigger ELO calculation
    if (isSeriesOver && seriesWinner) {
      await supabase.functions.invoke('complete-match', {
        body: { matchId },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      gameResult: { score, winner, gameNumber },
      seriesScore: newSeriesScore,
      isSeriesOver,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simplified half-inning simulation
function simulateHalfInning(): number {
  let runs = 0;
  let outs = 0;
  let runners: [boolean, boolean, boolean] = [false, false, false];
  const defaultGrades: ScoutingGrades = { contact: 50, power: 50, speed: 50, eye: 50, fastball: 50, breaking: 50, control: 50 };

  while (outs < 3) {
    const result = simulateAtBat(defaultGrades, defaultGrades);
    const advance = advanceRunners(result, runners, 50, outs);
    runs += advance.runsScored;
    runners = advance.newRunners;
    outs = advance.newOuts;
  }

  return runs;
}
