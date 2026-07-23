-- ============================================================================
-- Complete Notification Preferences Schema
-- Date: July 24, 2026
-- Description: Ensure all notification preference columns exist
-- ============================================================================

-- Add missing columns to notification_preferences table if they don't exist
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS finance_alerts BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_updates BOOLEAN NOT NULL DEFAULT true;

-- Add comments
COMMENT ON COLUMN public.notification_preferences.finance_alerts IS 
  'Real-time alerts for payment releases and ledger entries';
COMMENT ON COLUMN public.notification_preferences.delivery_updates IS 
  'Updates on rider assignments and delivery completions';

-- Ensure user_notification_preferences table exists (should already exist from earlier migration)
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  email_digests BOOLEAN NOT NULL DEFAULT true,
  digest_frequency TEXT NOT NULL DEFAULT 'daily'
    CHECK (digest_frequency IN ('immediate', 'hourly', 'daily', 'never')),
  notification_sounds BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  sound_volume_percent INTEGER NOT NULL DEFAULT 50
    CHECK (sound_volume_percent >= 0 AND sound_volume_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_notification_preferences'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies if they don't exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own notification prefs" 
    ON public.user_notification_preferences;
  CREATE POLICY "Users can view own notification prefs"
    ON public.user_notification_preferences
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert own notification prefs"
    ON public.user_notification_preferences;
  CREATE POLICY "Users can insert own notification prefs"
    ON public.user_notification_preferences
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update own notification prefs"
    ON public.user_notification_preferences;
  CREATE POLICY "Users can update own notification prefs"
    ON public.user_notification_preferences
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Create or replace update trigger
CREATE OR REPLACE FUNCTION public.touch_user_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_notification_preferences_updated_at 
  ON public.user_notification_preferences;
CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_notification_preferences_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_notification_preferences TO authenticated;

-- Verification
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  -- Verify notification_preferences has all columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'notification_preferences'
    AND column_name IN ('finance_alerts', 'delivery_updates');
  
  IF col_count < 2 THEN
    RAISE WARNING 'Some columns missing from notification_preferences. Expected 2, found %', col_count;
  END IF;
  
  -- Verify user_notification_preferences exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_notification_preferences'
  ) THEN
    RAISE EXCEPTION 'user_notification_preferences table was not created';
  END IF;
  
  RAISE NOTICE '✓ Notification preferences schema complete';
  RAISE NOTICE '  - notification_preferences has % additional columns', col_count;
  RAISE NOTICE '  - user_notification_preferences table exists and is configured';
END $$;
