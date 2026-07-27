-- ============================================================================
-- Issue Chat Messages (persistent team chat per issue)
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  ai_agent_name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_issue_id ON issue_chat_messages(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_created_at ON issue_chat_messages(created_at ASC);

ALTER TABLE issue_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view issue chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send chat messages" ON issue_chat_messages;

CREATE POLICY "Anyone can view issue chat messages"
  ON issue_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send chat messages"
  ON issue_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_ai = true);

-- ============================================================================
-- MOU Agent Conversation History (per vendor, multi-turn)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_agent_conversations_vendor_id ON vendor_agent_conversations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_agent_conversations_user_id ON vendor_agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_agent_conversations_created_at ON vendor_agent_conversations(created_at ASC);

ALTER TABLE vendor_agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own vendor agent conversations" ON vendor_agent_conversations;
DROP POLICY IF EXISTS "Users can insert their own vendor agent conversations" ON vendor_agent_conversations;
DROP POLICY IF EXISTS "Admins can view all vendor agent conversations" ON vendor_agent_conversations;

CREATE POLICY "Users can view their own vendor agent conversations"
  ON vendor_agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vendor agent conversations"
  ON vendor_agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vendor agent conversations"
  ON vendor_agent_conversations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
  );

-- ============================================================================
-- Real-time
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vendor_agent_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vendor_agent_conversations;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ Chat & MOU Agent tables created successfully';
END $$;
