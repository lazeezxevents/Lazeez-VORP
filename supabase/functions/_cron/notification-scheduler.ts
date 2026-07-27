// Cron job to run notification-scheduler daily at 9 AM
// This checks for expiring MOUs and other time-based notifications

Deno.cron("Daily notification scheduler", "0 9 * * *", async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables')
    return
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/notification-scheduler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()
    console.log('Notification scheduler result:', result)
  } catch (error) {
    console.error('Failed to run notification scheduler:', error)
  }
})
