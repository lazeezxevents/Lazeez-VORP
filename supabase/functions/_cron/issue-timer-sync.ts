// Cron job to run issue-timer-sync every 5 minutes
// This ensures timers are synced globally even when users aren't active

Deno.cron("Sync issue timers", "*/5 * * * *", async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables')
    return
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/issue-timer-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()
    console.log('Timer sync result:', result)
  } catch (error) {
    console.error('Failed to sync timers:', error)
  }
})
