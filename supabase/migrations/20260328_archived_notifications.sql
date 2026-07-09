-- Create archived_notifications table
CREATE TABLE IF NOT EXISTS archived_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    action_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    original_created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_archived_notifications_user_id ON archived_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_archived_notifications_category ON archived_notifications(category);
CREATE INDEX IF NOT EXISTS idx_archived_notifications_archived_at ON archived_notifications(archived_at DESC);

-- Enable RLS
ALTER TABLE archived_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own archived notifications"
    ON archived_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can archive their own notifications"
    ON archived_notifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own archived notifications"
    ON archived_notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON archived_notifications TO authenticated;

COMMENT ON TABLE archived_notifications IS 'Stores archived notifications for users';
