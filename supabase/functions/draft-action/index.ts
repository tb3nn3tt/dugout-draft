// Supabase Edge Function: Draft Action
// Validates and applies draft picks and power card usage server-side

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

    const { matchId, action, playerId } = await req.json();

    // Fetch match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (!match) throw new Error('Match not found');
    if (match.status !== 'draft') throw new Error('Match is not in draft phase');

    // Verify player is a participant
    const isPlayer1 = match.player1_id === playerId;
    const isPlayer2 = match.player2_id === playerId;
    if (!isPlayer1 && !isPlayer2) throw new Error('Not a match participant');

    const myRole = isPlayer1 ? 'player1' : 'player2';
    const phaseData = (match.phase_data || {}) as Record<string, unknown>;

    // Validate it's this player's turn
    if (phaseData.currentPick && phaseData.currentPick !== myRole) {
      throw new Error('Not your turn');
    }

    // Apply action
    switch (action.type) {
      case 'PICK_PLAYER': {
        const { playerId: pickedId } = action.payload;
        const cardPool = (phaseData.cardPool as string[]) || [];
        const pickedFromPool = (phaseData.pickedFromPool as string[]) || [];

        if (!cardPool.includes(pickedId)) throw new Error('Player not in card pool');
        if (pickedFromPool.includes(pickedId)) throw new Error('Player already picked');

        const rosterKey = myRole === 'player1' ? 'player1Roster' : 'player2Roster';
        const roster = ((phaseData[rosterKey] as string[]) || []);
        roster.push(pickedId);
        pickedFromPool.push(pickedId);

        const pickNumber = ((phaseData.pickNumber as number) || 1) + 1;
        const totalPicks = 52;

        // Snake draft: determine next picker
        const roundPick = pickNumber % 4;
        const nextPicker = (roundPick === 0 || roundPick === 3) ? 'player1' : 'player2';

        // Check if draft is complete
        const newStatus = pickNumber > totalPicks ? 'team_setup' : 'draft';

        // Update phase data
        const updatedPhaseData = {
          ...phaseData,
          [rosterKey]: roster,
          pickedFromPool,
          pickNumber,
          currentPick: nextPicker,
        };

        await supabase
          .from('matches')
          .update({
            phase_data: updatedPhaseData,
            status: newStatus,
          })
          .eq('id', matchId);

        break;
      }

      case 'USE_POWER_CARD': {
        // Server-side power card validation and application
        const { cardId, cardType } = action.payload;
        // Mark card as used in phase_data
        const powerCards = (phaseData.powerCards as Record<string, unknown>) || {};
        const handKey = myRole === 'player1' ? 'player1Hand' : 'player2Hand';
        const hand = (powerCards[handKey] as Array<{ id: string; used: boolean }>) || [];

        const cardIndex = hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) throw new Error('Card not found');
        if (hand[cardIndex].used) throw new Error('Card already used');

        hand[cardIndex].used = true;

        const updatedPhaseData = {
          ...phaseData,
          powerCards: { ...powerCards, [handKey]: hand },
        };

        await supabase
          .from('matches')
          .update({ phase_data: updatedPhaseData })
          .eq('id', matchId);

        break;
      }

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
