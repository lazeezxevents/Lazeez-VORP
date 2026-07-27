# Email Digest System - Complete Setup Guide

## 🎯 Overview

The Email Digest System sends automated daily or weekly summary emails to users with their:
- Assigned issues (open & in progress)
- Watched issues with recent updates
- Upcoming deadlines (next 3 days)
- Project tasks assigned to them
- New issues created (daily) or weekly performance stats (weekly)

## 📋 Components

### 1. Edge Function
**File**: `supabase/functions/send-digest-email/index.ts`

Sends beautiful HTML digest emails via Resend API. Handles:
- Data gathering from multiple tables
- Email HTML generation with responsive design
- Status badges, priority colors, and formatting
- Error handling and logging

### 2. Database Migration
**File**: `supabase/migrations/20260727_email_digest_system.sql`

Creates:
- `email_digest_enabled`, `email_digest_frequency`, `email_digest_time` columns on `profiles` table
- `digest_email_log` table to track sent digests
- `get_users_for_digest()` function to find users ready for digest
- `trigger_digest_email_now()` function for manual testing
- pg_cron jobs for automated daily/weekly sends

### 3. UI Settings
**Files**: 
- `src/components/settings/UnifiedNotificationSettings.tsx` (updated)
- `src/hooks/useUnifiedNotificationPreferences.ts` (updated)

Allows users to configure:
- Enable/disable digests
- Frequency (daily, weekly, none)
- Preferred delivery time

## 🚀 Setup Instructions

### Step 1: Apply Database Migration

```bash
cd c:\Users\SHUJA\Downloads\Lazeez-VORP
supabase db push
```

Or manually via Supabase Dashboard → SQL Editor:
1. Copy contents of `supabase/migrations/20260727_email_digest_system.sql`
2. Paste and execute

### Step 2: Deploy Edge Function

```bash
supabase functions deploy send-digest-email
```

### Step 3: Set Resend API Key

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

Or via Supabase Dashboard → Edge Functions → Secrets

### Step 4: Enable pg_cron Extension

**⚠️ IMPORTANT**: pg_cron must be enabled for automated scheduling

1. Go to Supabase Dashboard → Database → Extensions
2. Search for `pg_cron`
3. Enable it
4. Run the migration again to create the cron jobs

### Step 5: Configure Cron Jobs

The migration creates two cron jobs:
- **Daily digest**: Runs every day at 9 AM UTC (`0 9 * * *`)
- **Weekly digest**: Runs every Monday at 9 AM UTC (`0 9 * * 1`)

To adjust timing, update the migration and re-run, or use:

```sql
-- Update daily digest schedule
SELECT cron.unschedule('send-daily-digest');
SELECT cron.schedule(
  'send-daily-digest',
  '0 8 * * *', -- 8 AM UTC instead
  $$ [cron SQL query from migration] $$
);
```

### Step 6: Configure Supabase Settings

The cron jobs use these settings (set in Supabase Dashboard → Settings → API):

```sql
-- Add to Database Settings → Custom SQL
ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';
ALTER DATABASE postgres SET app.supabase_service_role_key TO 'your-service-role-key';
```

## 🧪 Testing

### Manual Test (Single User)

```sql
-- Test daily digest for a specific user
SELECT trigger_digest_email_now(
  'user-uuid-here'::uuid,
  'daily'
);

-- Test weekly digest
SELECT trigger_digest_email_now(
  'user-uuid-here'::uuid,
  'weekly'
);
```

### Check Cron Jobs

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Check Digest Logs

```sql
-- View recent digest sends
SELECT 
  u.full_name,
  u.email,
  d.digest_type,
  d.sent_at,
  d.status,
  d.error_message
FROM digest_email_log d
JOIN profiles u ON u.id = d.user_id
ORDER BY d.sent_at DESC
LIMIT 20;
```

## 📧 Email Template

The digest emails include:

### Daily Digest
- 📊 Upcoming deadlines (next 3 days) - highlighted in red
- 📋 Your assigned issues (open & in progress)
- ✅ Your project tasks
- 👁️ Watched issues with updates
- 🆕 New issues created today
- 🎉 "All caught up" message if nothing pending

### Weekly Digest
All of the above, plus:
- 📊 Week in review (issues resolved, hours logged)
- 📈 Performance summary

### Design Features
- Responsive HTML (works on mobile)
- Professional gradient header
- Color-coded priority badges
- Status badges with icons
- Direct link to dashboard
- Settings link to manage preferences

## 🔧 Customization

### Adjust Cron Schedule

Edit times in `20260727_email_digest_system.sql`:
```sql
'0 9 * * *'   -- Daily at 9 AM UTC
'0 9 * * 1'   -- Weekly on Monday at 9 AM UTC
```

Cron format: `minute hour day_of_month month day_of_week`

### Change Email "From" Address

Edit in `send-digest-email/index.ts`:
```typescript
from: "Lazeez VORP <notifications@lazeez.com>",
```

Replace with your verified Resend domain.

### Customize Email Design

Edit the `generateDigestEmail()` function in `send-digest-email/index.ts`.

Colors, badges, sections, and layout are all customizable.

## 📊 Analytics

View digest engagement:

```sql
-- Digests sent per day
SELECT 
  DATE(sent_at) as date,
  digest_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'sent') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM digest_email_log
GROUP BY DATE(sent_at), digest_type
ORDER BY date DESC;

-- User opt-in rates
SELECT 
  email_digest_frequency,
  COUNT(*) as user_count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL) * 100, 1) as percentage
FROM profiles
WHERE email IS NOT NULL
GROUP BY email_digest_frequency;
```

## 🐛 Troubleshooting

### Digests not sending

1. **Check pg_cron is enabled**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check cron jobs exist**:
   ```sql
   SELECT * FROM cron.job WHERE jobname IN ('send-daily-digest', 'send-weekly-digest');
   ```

3. **Check for errors in logs**:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE status != 'succeeded' 
   ORDER BY start_time DESC;
   ```

4. **Verify edge function is deployed**:
   - Supabase Dashboard → Edge Functions → send-digest-email should be listed

5. **Check Resend API key is set**:
   ```bash
   supabase secrets list
   ```

### Users not receiving emails

1. **Check user preferences**:
   ```sql
   SELECT 
     full_name,
     email,
     email_digest_enabled,
     email_digest_frequency
   FROM profiles
   WHERE email = 'user@example.com';
   ```

2. **Check if digest was already sent today**:
   ```sql
   SELECT * FROM digest_email_log
   WHERE user_id = 'user-uuid-here'
   AND sent_at > CURRENT_DATE;
   ```

3. **Check Resend dashboard** for bounces/spam reports

### Edge function errors

Check logs in Supabase Dashboard → Edge Functions → send-digest-email → Logs

Common issues:
- Missing RESEND_API_KEY
- Invalid email addresses
- Rate limits (Resend free tier: 100 emails/day)
- Database connection issues

## 🔐 Security

- Edge function uses service role key (has full access)
- RLS policies on `digest_email_log` prevent users from seeing others' logs
- Email addresses are only visible to admins
- Cron jobs run with elevated privileges
- API keys stored as Supabase secrets (encrypted)

## 📝 Future Enhancements

Potential improvements:
- User timezone support (currently UTC-based)
- Unsubscribe links in emails
- Email open tracking via Resend webhooks
- A/B testing different digest formats
- Smart send time based on user activity patterns
- Push notification digests (mobile app)
- Slack/Teams digest integration

## 🎉 Ready to Go!

Once the migration is applied and the edge function is deployed, the system is fully automated. Users can configure their preferences in Settings → Notifications → Email Digest Preferences.

The first digests will be sent at the scheduled times (9 AM UTC by default).

---

**Support**: If you encounter issues, check the Supabase logs and the troubleshooting section above.
