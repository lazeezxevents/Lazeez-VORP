// Issue Timer Sync Edge Function
// Runs periodically to sync active timers and auto-log time when issues are resolved
// This ensures timers work globally, not just in user sessions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all active timers
    const { data: activeTimers, error: timersError } = await supabaseClient
      .from('issue_timers')
      .select('*, issue:issues(id, status, assignee_id)')
      .eq('is_active', true)

    if (timersError) throw timersError

    console.log(`Found ${activeTimers?.length || 0} active timers`)

    let stoppedCount = 0
    let loggedCount = 0

    // Check each timer
    for (const timer of activeTimers || []) {
      // If issue is resolved or closed, stop timer and log time
      if (timer.issue && (timer.issue.status === 'resolved' || timer.issue.status === 'closed')) {
        // Calculate elapsed time in hours
        const startedAt = new Date(timer.started_at)
        const now = new Date()
        const elapsedMs = now.getTime() - startedAt.getTime()
        const elapsedHours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(2))

        // Only log if more than 1 minute (0.016 hours)
        if (elapsedHours > 0.016) {
          // Insert time log
          const { error: logError } = await supabaseClient
            .from('issue_time_logs')
            .insert({
              issue_id: timer.issue_id,
              user_id: timer.user_id,
              hours: elapsedHours,
              description: 'Auto-logged from timer (background sync)',
              logged_date: new Date().toISOString().split('T')[0]
            })

          if (!logError) {
            loggedCount++
            console.log(`Logged ${elapsedHours}h for issue ${timer.issue_id}`)
          } else {
            console.error(`Failed to log time for issue ${timer.issue_id}:`, logError)
          }
        }

        // Deactivate timer
        const { error: deactivateError } = await supabaseClient
          .from('issue_timers')
          .update({ is_active: false })
          .eq('id', timer.id)

        if (!deactivateError) {
          stoppedCount++
          console.log(`Stopped timer for issue ${timer.issue_id}`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        activeTimers: activeTimers?.length || 0,
        stopped: stoppedCount,
        logged: loggedCount,
        message: `Synced ${activeTimers?.length || 0} timers, stopped ${stoppedCount}, logged ${loggedCount}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Timer sync error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
