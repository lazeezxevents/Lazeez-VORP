-- Add missing columns to notification_preferences table
-- Date: March 27, 2026
-- Description: Add finance_alerts, delivery_updates, and hr_activity columns

ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS finance_alerts BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_updates BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS hr_activity BOOLEAN NOT NULL DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.notification_preferences.finance_alerts IS 'Real-time alerts for payment releases and ledger entries';
COMMENT ON COLUMN public.notification_preferences.delivery_updates IS 'Updates on rider assignments and delivery completions';
COMMENT ON COLUMN public.notification_preferences.hr_activity IS 'Notifications for org chart changes and performance reviews';
