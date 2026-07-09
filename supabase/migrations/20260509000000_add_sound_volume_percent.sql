-- Add sound_volume_percent column to user_notification_preferences
-- This column stores the volume level (0-100) for notification sounds

ALTER TABLE public.user_notification_preferences
ADD COLUMN IF NOT EXISTS sound_volume_percent INTEGER NOT NULL DEFAULT 40
    CHECK (sound_volume_percent >= 0 AND sound_volume_percent <= 100);

COMMENT ON COLUMN public.user_notification_preferences.sound_volume_percent IS 
    'Volume level for notification sounds (0-100 percent)';
