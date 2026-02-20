// Supabase Edge Function: Complete Match
// Calculates ELO changes and updates profiles after a match ends

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateEloChange(
  winnerElo: number,
  loserElo: number,
  winnerGames: number,
  _loserGames: number
): number {
  const K = winnerGames < 30 ? 32 : 24;
  const expectedScore = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(K * (1 - expectedScore));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId } = await req.json();

    // Fetch match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (!match) throw new Error('Match not found');
    if (match.status !== 'completed') throw new Error('Match is not completed');
    if (!match.winner_id) throw new Error('No winner set');

    // Fetch both profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', [match.player1_id, match.player2_id]);

    if (profileError) throw profileError;
    if (!profiles || profiles.length !== 2) throw new Error('Profiles not found');

    const p1 = profiles.find((p: { id: string }) => p.id === match.player1_id)!;
    const p2 = profiles.find((p: { id: string }) => p.id === match.player2_id)!;

    const winnerId = match.winner_id;
    const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
    const winnerProfile = winnerId === p1.id ? p1 : p2;
    const loserProfile = winnerId === p1.id ? p2 : p1;

    // Calculate ELO change
    const eloChange = calculateEloChange(
      winnerProfile.elo_rating,
      loserProfile.elo_rating,
      winnerProfile.games_played,
      loserProfile.games_played
    );

    const winnerNewElo = winnerProfile.elo_rating + eloChange;
    const loserNewElo = Math.max(100, loserProfile.elo_rating - eloChange);

    // Update winner profile
    await supabase
      .from('profiles')
      .update({
        elo_rating: winnerNewElo,
        games_played: winnerProfile.games_played + 1,
        wins: winnerProfile.wins + 1,
        peak_elo: Math.max(winnerProfile.peak_elo, winnerNewElo),
      })
      .eq('id', winnerId);

    // Update loser profile
    await supabase
      .from('profiles')
      .update({
        elo_rating: loserNewElo,
        games_played: loserProfile.games_played + 1,
        losses: loserProfile.losses + 1,
      })
      .eq('id', loserId);

    // Get series score from phase_data
    const phaseData = match.phase_data as Record<string, unknown>;
    const seriesScore = phaseData.seriesScore as { player1: number; player2: number };
    const seriesScoreStr = `${seriesScore.player1}-${seriesScore.player2}`;

    // Create match history record
    await supabase
      .from('match_history')
      .insert({
        match_id: matchId,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        winner_id: winnerId,
        player1_elo_before: p1.elo_rating,
        player2_elo_before: p2.elo_rating,
        elo_change: eloChange,
        series_score: seriesScoreStr,
      });

    // Update match phase_data with ELO change info
    await supabase
      .from('matches')
      .update({
        phase_data: {
          ...phaseData,
          eloChange,
          winnerNewElo,
          loserNewElo,
        },
      })
      .eq('id', matchId);

    return new Response(JSON.stringify({
      success: true,
      eloChange,
      winnerNewElo,
      loserNewElo,
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
