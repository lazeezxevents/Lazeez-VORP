-- Communication Module Database Schema (SIMPLIFIED - NO CREATED_BY)
-- Created: 2026-05-06
-- Purpose: Slack-like real-time communication system for VORP
-- Simplified: Removed created_by columns to avoid foreign key issues

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL CHECK (length(name) <= 100),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_department_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

-- ============================================================================
-- CHANNELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(name) <= 100),
    description TEXT,
    purpose TEXT,
    is_private BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_channel_per_department UNIQUE (department_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_department ON channels(department_id);
CREATE INDEX IF NOT EXISTS idx_channels_archived ON channels(is_archived);
CREATE INDEX IF NOT EXISTS idx_channels_private ON channels(is_private);
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);

-- ============================================================================
-- CHANNEL MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS channel_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_channel_member UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_last_read ON channel_members(last_read_at);

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(content) <= 4000),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- MESSAGE ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size <= 52428800),
    file_type TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id);

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_user_reaction UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);

-- ============================================================================
-- DIRECT MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CHECK (user1_id < user2_id),
    CONSTRAINT unique_dm_pair UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_user1 ON direct_messages(user1_id);
CREATE INDEX IF NOT EXISTS idx_dm_user2 ON direct_messages(user2_id);

-- ============================================================================
-- DM MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS dm_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    direct_message_id UUID NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(content) <= 4000),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON dm_messages(direct_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_user ON dm_messages(user_id);

-- ============================================================================
-- USER PRESENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_presence (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'dnd', 'offline')),
    custom_status TEXT CHECK (length(custom_status) <= 100),
    status_expires_at TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON user_presence(last_seen);

-- ============================================================================
-- MESSAGE BOOKMARKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    note TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_user_bookmark UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON message_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON message_bookmarks USING GIN(tags);

-- ============================================================================
-- MESSAGE REMINDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON message_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON message_reminders(remind_at) WHERE NOT completed;

-- ============================================================================
-- PINNED MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    pinned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT unique_pinned_message UNIQUE (channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_channel ON pinned_messages(channel_id);

-- ============================================================================
-- CALL SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    recording_url TEXT,
    transcript_url TEXT,
    initiated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calls_channel ON call_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_calls_started ON call_sessions(started_at DESC);

-- ============================================================================
-- CALL PARTICIPANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    left_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_call_participant UNIQUE (call_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_session ON call_participants(call_session_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user ON call_participants(user_id);

-- ============================================================================
-- MESSAGE POLLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_polls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    allow_multiple BOOLEAN DEFAULT false,
    anonymous BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_message ON message_polls(message_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_polls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Users can view their channels" ON channels;
DROP POLICY IF EXISTS "Users can create channels" ON channels;
DROP POLICY IF EXISTS "Channel owners can update channels" ON channels;
DROP POLICY IF EXISTS "Users can view channel members" ON channel_members;
DROP POLICY IF EXISTS "Channel owners can add members" ON channel_members;
DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
DROP POLICY IF EXISTS "Users can view channel messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can edit own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
DROP POLICY IF EXISTS "Users can view attachments in their channels" ON message_attachments;
DROP POLICY IF EXISTS "Users can add attachments to their messages" ON message_attachments;
DROP POLICY IF EXISTS "Users can view reactions in their channels" ON message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can view their DMs" ON direct_messages;
DROP POLICY IF EXISTS "Users can create DMs" ON direct_messages;
DROP POLICY IF EXISTS "Users can view their DM messages" ON dm_messages;
DROP POLICY IF EXISTS "Users can send DM messages" ON dm_messages;
DROP POLICY IF EXISTS "Users can view presence" ON user_presence;
DROP POLICY IF EXISTS "Users can update own presence" ON user_presence;
DROP POLICY IF EXISTS "Users can update own presence status" ON user_presence;
DROP POLICY IF EXISTS "Users can view their bookmarks" ON message_bookmarks;
DROP POLICY IF EXISTS "Users can create bookmarks" ON message_bookmarks;
DROP POLICY IF EXISTS "Users can delete their bookmarks" ON message_bookmarks;
DROP POLICY IF EXISTS "Users can view their reminders" ON message_reminders;
DROP POLICY IF EXISTS "Users can create reminders" ON message_reminders;
DROP POLICY IF EXISTS "Users can update their reminders" ON message_reminders;
DROP POLICY IF EXISTS "Users can delete their reminders" ON message_reminders;
DROP POLICY IF EXISTS "Users can view pinned messages in their channels" ON pinned_messages;
DROP POLICY IF EXISTS "Channel admins can pin messages" ON pinned_messages;
DROP POLICY IF EXISTS "Users can view calls in their channels" ON call_sessions;
DROP POLICY IF EXISTS "Users can create calls in their channels" ON call_sessions;
DROP POLICY IF EXISTS "Users can view call participants" ON call_participants;
DROP POLICY IF EXISTS "Users can join calls" ON call_participants;
DROP POLICY IF EXISTS "Users can view polls in their channels" ON message_polls;
DROP POLICY IF EXISTS "Users can create polls" ON message_polls;

-- DEPARTMENTS RLS
CREATE POLICY "Users can view departments" ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create departments" ON departments FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
);

-- CHANNELS RLS
CREATE POLICY "Users can view their channels" ON channels FOR SELECT TO authenticated USING (
    id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create channels" ON channels FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager'))
);
CREATE POLICY "Channel owners can update channels" ON channels FOR UPDATE TO authenticated USING (
    id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
);

-- CHANNEL MEMBERS RLS
CREATE POLICY "Users can view channel members" ON channel_members FOR SELECT TO authenticated USING (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Channel owners can add members" ON channel_members FOR INSERT TO authenticated WITH CHECK (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);
CREATE POLICY "Users can leave channels" ON channel_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- MESSAGES RLS
CREATE POLICY "Users can view channel messages" ON messages FOR SELECT TO authenticated USING (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid()) AND user_id = auth.uid()
);
CREATE POLICY "Users can edit own messages" ON messages FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own messages" ON messages FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
);

-- MESSAGE ATTACHMENTS RLS
CREATE POLICY "Users can view attachments in their channels" ON message_attachments FOR SELECT TO authenticated USING (
    message_id IN (SELECT m.id FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "Users can add attachments to their messages" ON message_attachments FOR INSERT TO authenticated WITH CHECK (
    message_id IN (SELECT id FROM messages WHERE user_id = auth.uid())
);

-- MESSAGE REACTIONS RLS
CREATE POLICY "Users can view reactions in their channels" ON message_reactions FOR SELECT TO authenticated USING (
    message_id IN (SELECT m.id FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "Users can add reactions" ON message_reactions FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND message_id IN (SELECT m.id FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "Users can remove their reactions" ON message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- DIRECT MESSAGES RLS
CREATE POLICY "Users can view their DMs" ON direct_messages FOR SELECT TO authenticated USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Users can create DMs" ON direct_messages FOR INSERT TO authenticated WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- DM MESSAGES RLS
CREATE POLICY "Users can view their DM messages" ON dm_messages FOR SELECT TO authenticated USING (
    direct_message_id IN (SELECT id FROM direct_messages WHERE user1_id = auth.uid() OR user2_id = auth.uid())
);
CREATE POLICY "Users can send DM messages" ON dm_messages FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND direct_message_id IN (SELECT id FROM direct_messages WHERE user1_id = auth.uid() OR user2_id = auth.uid())
);

-- USER PRESENCE RLS
CREATE POLICY "Users can view presence" ON user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own presence" ON user_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own presence status" ON user_presence FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- MESSAGE BOOKMARKS RLS
CREATE POLICY "Users can view their bookmarks" ON message_bookmarks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create bookmarks" ON message_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their bookmarks" ON message_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- MESSAGE REMINDERS RLS
CREATE POLICY "Users can view their reminders" ON message_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create reminders" ON message_reminders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their reminders" ON message_reminders FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete their reminders" ON message_reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- PINNED MESSAGES RLS
CREATE POLICY "Users can view pinned messages in their channels" ON pinned_messages FOR SELECT TO authenticated USING (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Channel admins can pin messages" ON pinned_messages FOR INSERT TO authenticated WITH CHECK (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- CALL SESSIONS RLS
CREATE POLICY "Users can view calls in their channels" ON call_sessions FOR SELECT TO authenticated USING (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create calls in their channels" ON call_sessions FOR INSERT TO authenticated WITH CHECK (
    channel_id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
);

-- CALL PARTICIPANTS RLS
CREATE POLICY "Users can view call participants" ON call_participants FOR SELECT TO authenticated USING (
    call_session_id IN (SELECT cs.id FROM call_sessions cs JOIN channel_members cm ON cm.channel_id = cs.channel_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "Users can join calls" ON call_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- MESSAGE POLLS RLS
CREATE POLICY "Users can view polls in their channels" ON message_polls FOR SELECT TO authenticated USING (
    message_id IN (SELECT m.id FROM messages m JOIN channel_members cm ON cm.channel_id = m.channel_id WHERE cm.user_id = auth.uid())
);
CREATE POLICY "Users can create polls" ON message_polls FOR INSERT TO authenticated WITH CHECK (
    message_id IN (SELECT id FROM messages WHERE user_id = auth.uid())
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_count(p_channel_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.channel_id = p_channel_id
        AND m.created_at > (
            SELECT COALESCE(last_read_at, '1970-01-01'::timestamp)
            FROM channel_members
            WHERE channel_id = p_channel_id AND user_id = p_user_id
        )
        AND m.deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_channel_read(p_channel_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE channel_members
    SET last_read_at = now()
    WHERE channel_id = p_channel_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_presence_updated_at ON user_presence;
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON user_presence
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

INSERT INTO departments (name, description)
VALUES ('General', 'Default department for general communication')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_channel_read TO authenticated;
