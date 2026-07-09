-- ============================================================================
-- DM ATTACHMENTS AND REACTIONS TABLES
-- Task 17.2: Implement direct message features
-- Requirements: 13.4 (attachments), 13.6 (notifications), 8.x (reactions)
-- ============================================================================

-- ============================================================================
-- DM MESSAGE ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dm_message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dm_message_id UUID NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size <= 1073741824), -- 1GB limit
    file_type TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_attachments_message ON dm_message_attachments(dm_message_id);

COMMENT ON TABLE dm_message_attachments IS 'File attachments for direct messages';

-- ============================================================================
-- DM MESSAGE REACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dm_message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_dm_reactions_message ON dm_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_dm_reactions_user ON dm_message_reactions(user_id);

COMMENT ON TABLE dm_message_reactions IS 'Emoji reactions on direct messages';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE dm_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_message_reactions ENABLE ROW LEVEL SECURITY;

-- DM Attachments RLS Policies
CREATE POLICY "Users can view DM attachments"
ON dm_message_attachments FOR SELECT
TO authenticated
USING (
    dm_message_id IN (
        SELECT dm.id FROM dm_messages dm
        JOIN direct_messages d ON dm.direct_message_id = d.id
        WHERE d.user1_id = auth.uid() OR d.user2_id = auth.uid()
    )
);

CREATE POLICY "Users can add DM attachments"
ON dm_message_attachments FOR INSERT
TO authenticated
WITH CHECK (
    dm_message_id IN (
        SELECT dm.id FROM dm_messages dm
        WHERE dm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own DM attachments"
ON dm_message_attachments FOR DELETE
TO authenticated
USING (
    dm_message_id IN (
        SELECT dm.id FROM dm_messages dm
        WHERE dm.user_id = auth.uid()
    )
);

-- DM Reactions RLS Policies
CREATE POLICY "Users can view DM reactions"
ON dm_message_reactions FOR SELECT
TO authenticated
USING (
    message_id IN (
        SELECT dm.id FROM dm_messages dm
        JOIN direct_messages d ON dm.direct_message_id = d.id
        WHERE d.user1_id = auth.uid() OR d.user2_id = auth.uid()
    )
);

CREATE POLICY "Users can add DM reactions"
ON dm_message_reactions FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND message_id IN (
        SELECT dm.id FROM dm_messages dm
        JOIN direct_messages d ON dm.direct_message_id = d.id
        WHERE d.user1_id = auth.uid() OR d.user2_id = auth.uid()
    )
);

CREATE POLICY "Users can remove own DM reactions"
ON dm_message_reactions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- REALTIME SUBSCRIPTION SETUP
-- ============================================================================

-- Add tables to realtime publication
BEGIN;
  -- Drop the publication if it exists and recreate
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE dm_message_attachments;
      ALTER PUBLICATION supabase_realtime ADD TABLE dm_message_reactions;
    END IF;
  END $$;
COMMIT;
