-- ============================================================================
-- Email Digest System: Daily/Weekly notification digests
-- ============================================================================

-- 1. Add notification preferences to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_digest_frequency TEXT DEFAULT 'daily' CHECK (email_digest_frequency IN ('daily', 'weekly', 'none')),
ADD COLUMN IF NOT EXISTS email_digest_time TIME DEFAULT '09:00:00';

COMMENT ON COLUMN profiles.email_digest_enabled IS 'Master toggle for email digests';
COMMENT ON COLUMN profiles.email_digest_frequency IS 'Frequency: daily, weekly, or none';
COMMENT ON COLUMN profiles.email_digest_time IS 'Preferred time to receive digest (in user timezone)';

-- 2. Create digest_email_log table to track sent digests
CREATE TABLE IF NOT EXISTS digest_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_id TEXT, -- Resend email ID for tracking
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_digest_email_log_user_id ON digest_email_log(user_id);
CREATE INDEX idx_digest_email_log_sent_at ON digest_email_log(sent_at DESC);
CREATE INDEX idx_digest_email_log_status ON digest_email_log(status);

GRANT SELECT, INSERT ON digest_email_log TO authenticated;

-- RLS policies for digest_email_log
ALTER TABLE digest_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own digest logs" ON digest_email_log;
CREATE POLICY "Users can view their own digest logs"
  ON digest_email_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert digest logs" ON digest_email_log;
CREATE POLICY "Service role can insert digest logs"
  ON digest_email_log FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway

-- 3. Function to get users ready for digest email
CREATE OR REPLACE FUNCTION get_users_for_digest(digest_type TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  digest_frequency TEXT,
  last_digest_sent TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.email,
    p.full_name,
    p.email_digest_frequency AS digest_frequency,
    (
      SELECT MAX(del.sent_at) 
      FROM digest_email_log del 
      WHERE del.user_id = p.id AND del.digest_type = digest_type
    ) AS last_digest_sent
  FROM profiles p
  WHERE 
    p.email_digest_enabled = true
    AND p.email_digest_frequency = digest_type
    AND p.email IS NOT NULL
    AND p.email != ''
    -- Don't send if already sent today (daily) or this week (weekly)
    AND (
      (digest_type = 'daily' AND (
        SELECT MAX(del.sent_at) 
        FROM digest_email_log del 
        WHERE del.user_id = p.id AND del.digest_type = 'daily'
      ) < CURRENT_DATE)
      OR
      (digest_type = 'weekly' AND (
        SELECT MAX(del.sent_at) 
        FROM digest_email_log del 
        WHERE del.user_id = p.id AND del.digest_type = 'weekly'
      ) < DATE_TRUNC('week', CURRENT_DATE))
      OR
      NOT EXISTS (
        SELECT 1 FROM digest_email_log del 
        WHERE del.user_id = p.id AND del.digest_type = digest_type
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create pg_cron jobs for sending digests
-- Note: pg_cron must be enabled in Supabase dashboard first
-- These are example schedules; adjust as needed

-- Daily digest at 9 AM UTC (adjust for your timezone)
SELECT cron.schedule(
  'send-daily-digest',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.supabase_url') || '/functions/v1/send-digest-email'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'users', (
          SELECT json_agg(row_to_json(u))
          FROM get_users_for_digest('daily') u
        ),
        'digestType', 'daily'
      )
    ) AS request_id;
  $$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-digest'
);

-- Weekly digest on Monday at 9 AM UTC
SELECT cron.schedule(
  'send-weekly-digest',
  '0 9 * * 1', -- Every Monday at 9 AM
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.supabase_url') || '/functions/v1/send-digest-email'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'users', (
          SELECT json_agg(row_to_json(u))
          FROM get_users_for_digest('weekly') u
        ),
        'digestType', 'weekly'
      )
    ) AS request_id;
  $$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-weekly-digest'
);

-- 5. Manual trigger function for testing digests
CREATE OR REPLACE FUNCTION trigger_digest_email_now(
  p_user_id UUID,
  p_digest_type TEXT DEFAULT 'daily'
)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_result JSONB;
BEGIN
  -- Get user details
  SELECT id, email, full_name
  INTO v_user
  FROM profiles
  WHERE id = p_user_id AND email_digest_enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found or digests disabled'
    );
  END IF;

  -- Call the edge function
  SELECT content::jsonb INTO v_result
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/send-digest-email',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'))
    ],
    'application/json',
    jsonb_build_object(
      'users', jsonb_build_array(
        jsonb_build_object(
          'userId', v_user.id,
          'email', v_user.email,
          'fullName', v_user.full_name,
          'digestType', p_digest_type
        )
      ),
      'digestType', p_digest_type
    )::text
  ));

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (they can trigger their own digest)
GRANT EXECUTE ON FUNCTION trigger_digest_email_now TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Email digest system created';
  RAISE NOTICE '📧 Notification preferences added to profiles';
  RAISE NOTICE '📊 Digest log table created';
  RAISE NOTICE '⏰ Cron jobs scheduled (requires pg_cron extension)';
  RAISE NOTICE '🧪 Use trigger_digest_email_now(user_id, ''daily'') to test';
END $$;
