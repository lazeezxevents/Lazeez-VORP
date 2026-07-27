// Notification Scheduler Edge Function
// Runs periodically to check for events that need notifications
// - MOU expiring soon
// - Pending approvals
// - Overdue tasks

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

    const results = {
      mouExpiringNotifications: 0,
      errors: [] as string[]
    }

    // Call the MOU expiring notification function
    try {
      const { error: mouError } = await supabaseClient.rpc('notify_mou_expiring_soon')
      
      if (mouError) {
        console.error('MOU notification error:', mouError)
        results.errors.push(`MOU notifications: ${mouError.message}`)
      } else {
        console.log('MOU expiring notifications sent')
        results.mouExpiringNotifications = 1
      }
    } catch (error) {
      console.error('Failed to send MOU notifications:', error)
      results.errors.push(`MOU notifications: ${error.message}`)
    }

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        ...results,
        message: results.errors.length === 0 
          ? 'Notifications scheduled successfully' 
          : 'Some notifications failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: results.errors.length === 0 ? 200 : 207, // 207 = Multi-Status
      },
    )
  } catch (error) {
    console.error('Notification scheduler error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
