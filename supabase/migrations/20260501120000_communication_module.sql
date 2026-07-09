        -- =====================================================
        -- Communication Module Migration
        -- =====================================================
        -- Description: Slack-like real-time communication system
        -- Requirements: 28.1-28.11
        -- Created: 2026-05-01
        -- =====================================================

        -- =====================================================
        -- 1. DEPARTMENTS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.departments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL CHECK (length(name) <= 100),
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        -- =====================================================
        -- 2. CHANNELS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
            name TEXT NOT NULL CHECK (length(name) <= 100),
            description TEXT,
            purpose TEXT,
            is_private BOOLEAN DEFAULT false,
            is_archived BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(department_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_channels_department ON public.channels(department_id);
        CREATE INDEX IF NOT EXISTS idx_channels_archived ON public.channels(is_archived);
        CREATE INDEX IF NOT EXISTS idx_channels_private ON public.channels(is_private);

        -- =====================================================
        -- 3. CHANNEL_MEMBERS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.channel_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT now(),
            role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
            last_read_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(channel_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON public.channel_members(channel_id);
        CREATE INDEX IF NOT EXISTS idx_channel_members_user ON public.channel_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_channel_members_last_read ON public.channel_members(last_read_at);

        -- =====================================================
        -- 4. MESSAGES TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
            thread_parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL CHECK (length(content) <= 4000),
            edited_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now(),
            search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
        );

        CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_parent_id);
        CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_search ON public.messages USING GIN(search_vector);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

        -- =====================================================
        -- 5. MESSAGE_ATTACHMENTS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.message_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            file_url TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size BIGINT NOT NULL CHECK (file_size <= 52428800),
            file_type TEXT NOT NULL,
            thumbnail_url TEXT,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.message_attachments(message_id);

        -- =====================================================
        -- 6. MESSAGE_REACTIONS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.message_reactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            emoji TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(message_id, user_id, emoji)
        );

        CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.message_reactions(message_id);
        CREATE INDEX IF NOT EXISTS idx_reactions_user ON public.message_reactions(user_id);

        -- =====================================================
        -- 7. DIRECT_MESSAGES TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.direct_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT now(),
            CHECK (user1_id < user2_id),
            UNIQUE(user1_id, user2_id)
        );

        CREATE INDEX IF NOT EXISTS idx_dm_user1 ON public.direct_messages(user1_id);
        CREATE INDEX IF NOT EXISTS idx_dm_user2 ON public.direct_messages(user2_id);

        -- =====================================================
        -- 8. DM_MESSAGES TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.dm_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            direct_message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL CHECK (length(content) <= 4000),
            edited_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation ON public.dm_messages(direct_message_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_dm_messages_user ON public.dm_messages(user_id);

        -- =====================================================
        -- 9. USER_PRESENCE TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.user_presence (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'dnd', 'offline')),
            custom_status TEXT CHECK (length(custom_status) <= 100),
            status_expires_at TIMESTAMPTZ,
            last_seen TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_presence_status ON public.user_presence(status);
        CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON public.user_presence(last_seen);

        -- =====================================================
        -- 10. MESSAGE_BOOKMARKS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.message_bookmarks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            note TEXT,
            tags TEXT[],
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(user_id, message_id)
        );

        CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.message_bookmarks(user_id);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON public.message_bookmarks USING GIN(tags);

        -- =====================================================
        -- 11. MESSAGE_REMINDERS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.message_reminders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            remind_at TIMESTAMPTZ NOT NULL,
            is_recurring BOOLEAN DEFAULT false,
            recurrence_pattern TEXT,
            completed BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_reminders_user ON public.message_reminders(user_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_time ON public.message_reminders(remind_at) WHERE NOT completed;

        -- =====================================================
        -- 12. PINNED_MESSAGES TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.pinned_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            pinned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            pinned_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(channel_id, message_id)
        );

        CREATE INDEX IF NOT EXISTS idx_pinned_channel ON public.pinned_messages(channel_id);

        -- =====================================================
        -- 13. CALL_SESSIONS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.call_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
            call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
            started_at TIMESTAMPTZ DEFAULT now(),
            ended_at TIMESTAMPTZ,
            recording_url TEXT,
            transcript_url TEXT,
            initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_calls_channel ON public.call_sessions(channel_id);
        CREATE INDEX IF NOT EXISTS idx_calls_started ON public.call_sessions(started_at DESC);

        -- =====================================================
        -- 14. CALL_PARTICIPANTS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.call_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT now(),
            left_at TIMESTAMPTZ,
            UNIQUE(call_session_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_call_participants_session ON public.call_participants(call_session_id);
        CREATE INDEX IF NOT EXISTS idx_call_participants_user ON public.call_participants(user_id);

        -- =====================================================
        -- 15. MESSAGE_POLLS TABLE
        -- =====================================================
        CREATE TABLE IF NOT EXISTS public.message_polls (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            options JSONB NOT NULL,
            allow_multiple BOOLEAN DEFAULT false,
            anonymous BOOLEAN DEFAULT false,
            expires_at TIMESTAMPTZ,
            closed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_polls_message ON public.message_polls(message_id);

        -- =====================================================
        -- ENABLE ROW LEVEL SECURITY
        -- =====================================================
        ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.message_reminders ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.message_polls ENABLE ROW LEVEL SECURITY;

        -- =====================================================
        -- RLS POLICIES - DEPARTMENTS
        -- =====================================================
        CREATE POLICY "Users can view departments"
        ON public.departments FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Admins can create departments"
        ON public.departments FOR INSERT
        TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND main_role = 'admin'
            )
        );

        CREATE POLICY "Admins can update departments"
        ON public.departments FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND main_role = 'admin'
            )
        );

        -- =====================================================
        -- RLS POLICIES - CHANNELS
        -- =====================================================
        CREATE POLICY "Users can view their channels"
        ON public.channels FOR SELECT
        TO authenticated
        USING (
            id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
        );

        CREATE POLICY "Users can create channels"
        ON public.channels FOR INSERT
        TO authenticated
        WITH CHECK (true);

        CREATE POLICY "Channel owners can update channels"
        ON public.channels FOR UPDATE
        TO authenticated
        USING (
            id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND main_role = 'admin'
            )
        );

        -- =====================================================
        -- RLS POLICIES - CHANNEL_MEMBERS
        -- =====================================================
        CREATE POLICY "Users can view channel members"
        ON public.channel_members FOR SELECT
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
        );

        CREATE POLICY "Channel owners can add members"
        ON public.channel_members FOR INSERT
        TO authenticated
        WITH CHECK (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        );

        CREATE POLICY "Users can update own membership"
        ON public.channel_members FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Channel owners can remove members"
        ON public.channel_members FOR DELETE
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
            OR user_id = auth.uid()
        );

        -- =====================================================
        -- RLS POLICIES - MESSAGES
        -- =====================================================
        CREATE POLICY "Users can view channel messages"
        ON public.messages FOR SELECT
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
        );

        CREATE POLICY "Users can send messages"
        ON public.messages FOR INSERT
        TO authenticated
        WITH CHECK (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
            AND user_id = auth.uid()
        );

        CREATE POLICY "Users can edit own messages"
        ON public.messages FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can delete own messages"
        ON public.messages FOR DELETE
        TO authenticated
        USING (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND main_role = 'admin'
            )
        );

        -- =====================================================
        -- RLS POLICIES - MESSAGE_ATTACHMENTS
        -- =====================================================
        CREATE POLICY "Users can view message attachments"
        ON public.message_attachments FOR SELECT
        TO authenticated
        USING (
            message_id IN (
                SELECT m.id FROM public.messages m
                INNER JOIN public.channel_members cm ON m.channel_id = cm.channel_id
                WHERE cm.user_id = auth.uid()
            )
        );

        CREATE POLICY "Users can add attachments"
        ON public.message_attachments FOR INSERT
        TO authenticated
        WITH CHECK (
            message_id IN (
                SELECT id FROM public.messages WHERE user_id = auth.uid()
            )
        );

        -- =====================================================
        -- RLS POLICIES - MESSAGE_REACTIONS
        -- =====================================================
        CREATE POLICY "Users can view reactions"
        ON public.message_reactions FOR SELECT
        TO authenticated
        USING (
            message_id IN (
                SELECT m.id FROM public.messages m
                INNER JOIN public.channel_members cm ON m.channel_id = cm.channel_id
                WHERE cm.user_id = auth.uid()
            )
        );

        CREATE POLICY "Users can add reactions"
        ON public.message_reactions FOR INSERT
        TO authenticated
        WITH CHECK (
            message_id IN (
                SELECT m.id FROM public.messages m
                INNER JOIN public.channel_members cm ON m.channel_id = cm.channel_id
                WHERE cm.user_id = auth.uid()
            )
            AND user_id = auth.uid()
        );

        CREATE POLICY "Users can remove own reactions"
        ON public.message_reactions FOR DELETE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - DIRECT_MESSAGES
        -- =====================================================
        CREATE POLICY "Users can view own DMs"
        ON public.direct_messages FOR SELECT
        TO authenticated
        USING (user1_id = auth.uid() OR user2_id = auth.uid());

        CREATE POLICY "Users can create DMs"
        ON public.direct_messages FOR INSERT
        TO authenticated
        WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - DM_MESSAGES
        -- =====================================================
        CREATE POLICY "Users can view DM messages"
        ON public.dm_messages FOR SELECT
        TO authenticated
        USING (
            direct_message_id IN (
                SELECT id FROM public.direct_messages
                WHERE user1_id = auth.uid() OR user2_id = auth.uid()
            )
        );

        CREATE POLICY "Users can send DM messages"
        ON public.dm_messages FOR INSERT
        TO authenticated
        WITH CHECK (
            direct_message_id IN (
                SELECT id FROM public.direct_messages
                WHERE user1_id = auth.uid() OR user2_id = auth.uid()
            )
            AND user_id = auth.uid()
        );

        CREATE POLICY "Users can edit own DM messages"
        ON public.dm_messages FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Users can delete own DM messages"
        ON public.dm_messages FOR DELETE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - USER_PRESENCE
        -- =====================================================
        CREATE POLICY "Users can view presence"
        ON public.user_presence FOR SELECT
        TO authenticated
        USING (true);

        CREATE POLICY "Users can update own presence"
        ON public.user_presence FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can modify own presence"
        ON public.user_presence FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - MESSAGE_BOOKMARKS
        -- =====================================================
        CREATE POLICY "Users can view own bookmarks"
        ON public.message_bookmarks FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Users can create bookmarks"
        ON public.message_bookmarks FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can update own bookmarks"
        ON public.message_bookmarks FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Users can delete own bookmarks"
        ON public.message_bookmarks FOR DELETE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - MESSAGE_REMINDERS
        -- =====================================================
        CREATE POLICY "Users can view own reminders"
        ON public.message_reminders FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Users can create reminders"
        ON public.message_reminders FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can update own reminders"
        ON public.message_reminders FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        CREATE POLICY "Users can delete own reminders"
        ON public.message_reminders FOR DELETE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - PINNED_MESSAGES
        -- =====================================================
        CREATE POLICY "Users can view pinned messages"
        ON public.pinned_messages FOR SELECT
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
        );

        CREATE POLICY "Channel owners can pin messages"
        ON public.pinned_messages FOR INSERT
        TO authenticated
        WITH CHECK (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
            AND pinned_by = auth.uid()
        );

        CREATE POLICY "Channel owners can unpin messages"
        ON public.pinned_messages FOR DELETE
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        );

        -- =====================================================
        -- RLS POLICIES - CALL_SESSIONS
        -- =====================================================
        CREATE POLICY "Users can view channel calls"
        ON public.call_sessions FOR SELECT
        TO authenticated
        USING (
            channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            )
            OR channel_id IS NULL
        );

        CREATE POLICY "Users can initiate calls"
        ON public.call_sessions FOR INSERT
        TO authenticated
        WITH CHECK (
            (channel_id IN (
                SELECT channel_id FROM public.channel_members
                WHERE user_id = auth.uid()
            ) OR channel_id IS NULL)
            AND initiated_by = auth.uid()
        );

        CREATE POLICY "Call initiators can update calls"
        ON public.call_sessions FOR UPDATE
        TO authenticated
        USING (initiated_by = auth.uid());

        -- =====================================================
        -- RLS POLICIES - CALL_PARTICIPANTS
        -- =====================================================
        CREATE POLICY "Users can view call participants"
        ON public.call_participants FOR SELECT
        TO authenticated
        USING (
            call_session_id IN (
                SELECT id FROM public.call_sessions
                WHERE channel_id IN (
                    SELECT channel_id FROM public.channel_members
                    WHERE user_id = auth.uid()
                )
                OR channel_id IS NULL
            )
        );

        CREATE POLICY "Users can join calls"
        ON public.call_participants FOR INSERT
        TO authenticated
        WITH CHECK (user_id = auth.uid());

        CREATE POLICY "Users can update own participation"
        ON public.call_participants FOR UPDATE
        TO authenticated
        USING (user_id = auth.uid());

        -- =====================================================
        -- RLS POLICIES - MESSAGE_POLLS
        -- =====================================================
        CREATE POLICY "Users can view polls"
        ON public.message_polls FOR SELECT
        TO authenticated
        USING (
            message_id IN (
                SELECT m.id FROM public.messages m
                INNER JOIN public.channel_members cm ON m.channel_id = cm.channel_id
                WHERE cm.user_id = auth.uid()
            )
        );

        CREATE POLICY "Users can create polls"
        ON public.message_polls FOR INSERT
        TO authenticated
        WITH CHECK (
            message_id IN (
                SELECT id FROM public.messages WHERE user_id = auth.uid()
            )
        );

        CREATE POLICY "Poll creators can update polls"
        ON public.message_polls FOR UPDATE
        TO authenticated
        USING (
            message_id IN (
                SELECT id FROM public.messages WHERE user_id = auth.uid()
            )
        );
