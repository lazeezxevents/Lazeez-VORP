-- Add missing delivery_updates column to notification_preferences
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS delivery_updates BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN notification_preferences.delivery_updates IS 'Enable notifications for delivery status updates';
