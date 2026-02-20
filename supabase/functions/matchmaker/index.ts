// Supabase Edge Function: Matchmaker
// Pairs players in the matchmaking queue by ELO proximity

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

    // Get all players in queue ordered by join time
    const { data: queue, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true });

    if (queueError) throw queueError;
    if (!queue || queue.length < 2) {
      return new Response(JSON.stringify({ matched: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let matched = 0;
    const paired = new Set<string>();

    for (let i = 0; i < queue.length; i++) {
      if (paired.has(queue[i].profile_id)) continue;

      const player = queue[i];
      const waitTime = (Date.now() - new Date(player.joined_at).getTime()) / 1000;

      // Expand ELO range based on wait time
      let eloRange = 100;
      if (waitTime > 30) eloRange = 200;
      if (waitTime > 60) eloRange = 300;

      // Find closest ELO match
      let bestMatch = null;
      let bestDiff = Infinity;

      for (let j = i + 1; j < queue.length; j++) {
        if (paired.has(queue[j].profile_id)) continue;

        const diff = Math.abs(player.elo_rating - queue[j].elo_rating);
        if (diff <= eloRange && diff < bestDiff) {
          bestDiff = diff;
          bestMatch = queue[j];
        }
      }

      if (bestMatch) {
        // Create match
        const { error: matchError } = await supabase
          .from('matches')
          .insert({
            player1_id: player.profile_id,
            player2_id: bestMatch.profile_id,
            status: 'draft',
            phase_data: {},
          });

        if (!matchError) {
          // Remove both from queue
          await supabase
            .from('matchmaking_queue')
            .delete()
            .in('profile_id', [player.profile_id, bestMatch.profile_id]);

          paired.add(player.profile_id);
          paired.add(bestMatch.profile_id);
          matched++;
        }
      }
    }

    return new Response(JSON.stringify({ matched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
