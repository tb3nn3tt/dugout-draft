// Supabase Edge Function: Team Setup
// Validates lineup configuration and marks player as ready

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId, playerId, lineup } = await req.json();

    // Fetch match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (!match) throw new Error('Match not found');
    if (match.status !== 'team_setup') throw new Error('Match is not in team setup phase');

    const isPlayer1 = match.player1_id === playerId;
    const isPlayer2 = match.player2_id === playerId;
    if (!isPlayer1 && !isPlayer2) throw new Error('Not a match participant');

    const myRole = isPlayer1 ? 'player1' : 'player2';
    const phaseData = (match.phase_data || {}) as Record<string, unknown>;

    // Validate lineup
    const { battingOrder, rotation, closer, bullpen } = lineup;
    if (!battingOrder || !Array.isArray(battingOrder) || battingOrder.length !== 9) {
      throw new Error('Invalid batting order: must have 9 batters');
    }
    if (!rotation || !Array.isArray(rotation) || rotation.length !== 4) {
      throw new Error('Invalid rotation: must have 4 starters');
    }

    // Verify all players are from this player's roster
    const rosterKey = myRole === 'player1' ? 'player1Roster' : 'player2Roster';
    const roster = new Set((phaseData[rosterKey] as string[]) || []);

    for (const id of [...battingOrder, ...rotation, closer, ...bullpen].filter(Boolean)) {
      if (!roster.has(id)) {
        throw new Error(`Player ${id} not in roster`);
      }
    }

    // Store setup
    const setupKey = `${myRole}Setup`;
    const updatedPhaseData = {
      ...phaseData,
      [setupKey]: lineup,
    };

    // Check if both players are ready
    const otherSetupKey = myRole === 'player1' ? 'player2Setup' : 'player1Setup';
    const bothReady = !!updatedPhaseData[otherSetupKey];

    const newStatus = bothReady ? 'simulating' : 'team_setup';

    await supabase
      .from('matches')
      .update({
        phase_data: updatedPhaseData,
        status: newStatus,
      })
      .eq('id', matchId);

    return new Response(JSON.stringify({ success: true, bothReady }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
