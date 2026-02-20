// Supabase Edge Function: Update Career Stats
// Aggregates boxscore data from completed matches into career_stats

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

    const { matchId, playerId, stats } = await req.json();

    if (!playerId || !stats) throw new Error('Missing playerId or stats');

    // Upsert career stats
    const { data: existing } = await supabase
      .from('career_stats')
      .select('*')
      .eq('profile_id', playerId)
      .single();

    if (existing) {
      await supabase
        .from('career_stats')
        .update({
          total_ab: existing.total_ab + (stats.ab || 0),
          total_hits: existing.total_hits + (stats.hits || 0),
          total_hr: existing.total_hr + (stats.hr || 0),
          total_rbi: existing.total_rbi + (stats.rbi || 0),
          total_ip: existing.total_ip + (stats.ip || 0),
          total_er: existing.total_er + (stats.er || 0),
          total_so: existing.total_so + (stats.so || 0),
        })
        .eq('profile_id', playerId);
    } else {
      await supabase
        .from('career_stats')
        .insert({
          profile_id: playerId,
          total_ab: stats.ab || 0,
          total_hits: stats.hits || 0,
          total_hr: stats.hr || 0,
          total_rbi: stats.rbi || 0,
          total_ip: stats.ip || 0,
          total_er: stats.er || 0,
          total_so: stats.so || 0,
        });
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
