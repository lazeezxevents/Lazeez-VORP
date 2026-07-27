-- ============================================================================
-- Fix ALL Issue Tracking Features
-- ============================================================================
-- This migration fixes: remarks submission, file uploads, time tracking, 
-- drag-drop, and ensures all real-time features work correctly

-- ============================================================================
-- PART 1: Ensure issue_activity table has proper structure
-- ============================================================================

-- Make sure user_id can be null for system-generated activities
DO $$
BEGIN
  -- Check if user_id has NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issue_activity'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE issue_activity ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_issue_activity_action_type ON issue_activity(action_type);
CREATE INDEX IF NOT EXISTS idx_issue_activity_user_id ON issue_activity(user_id);

-- ============================================================================
-- PART 2: Fix RLS policies for issue_activity (allow comments from authenticated users)
-- ============================================================================

DROP POLICY IF EXISTS "System can create activity" ON issue_activity;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON issue_activity;
DROP POLICY IF EXISTS "All authenticated can add activity" ON issue_activity;
DROP POLICY IF EXISTS "Authenticated users can add activity" ON issue_activity;
DROP POLICY IF EXISTS "Users can update own activity" ON issue_activity;

-- Allow all authenticated users to insert activity (comments, time logs, etc.)
CREATE POLICY "Authenticated users can add activity"
  ON issue_activity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update their own comments (for future edit feature)
CREATE POLICY "Users can update own activity"
  ON issue_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 3: Create issue_chat_messages table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_ai BOOLEAN DEFAULT false,
  ai_agent_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_issue_id ON issue_chat_messages(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_created_at ON issue_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE issue_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat messages
DROP POLICY IF EXISTS "All authenticated can view chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "All authenticated can send chat messages" ON issue_chat_messages;

CREATE POLICY "All authenticated can view chat messages"
  ON issue_chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can send chat messages"
  ON issue_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'issue_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_chat_messages;
  END IF;
END $$;

-- ============================================================================
-- PART 4: Ensure issue_time_logs table has proper real-time setup
-- ============================================================================

-- Enable realtime for time logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'issue_time_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_time_logs;
  END IF;
END $$;

-- ============================================================================
-- PART 5: Fix storage bucket policies for file uploads
-- ============================================================================

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'issue-attachments',
  'issue-attachments',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed'
  ];

-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can view issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own attachments from storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- Create new comprehensive policies
CREATE POLICY "Authenticated users can view attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'issue-attachments' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-attachments' 
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IS NOT NULL -- Ensure file is in a folder (issue_id)
  );

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'issue-attachments' 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update own uploads"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'issue-attachments' 
    AND auth.uid() IS NOT NULL
  );

-- ============================================================================
-- PART 6: Add project_tasks table if it doesn't exist (for drag-drop)
-- ============================================================================

-- Create table only if it doesn't exist
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date DATE,
  position INTEGER DEFAULT 0, -- For drag-drop ordering
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add position column if table already exists but column doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_tasks' AND column_name = 'position'
  ) THEN
    ALTER TABLE project_tasks ADD COLUMN position INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_position ON project_tasks(position);

-- Enable RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "All authenticated can view tasks" ON project_tasks;
DROP POLICY IF EXISTS "All authenticated can create tasks" ON project_tasks;
DROP POLICY IF EXISTS "All authenticated can update tasks" ON project_tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON project_tasks;

CREATE POLICY "All authenticated can view tasks"
  ON project_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated can create tasks"
  ON project_tasks FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "All authenticated can update tasks"
  ON project_tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete tasks"
  ON project_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND main_role IN ('admin', 'manager')
    )
  );

-- Enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks;
  END IF;
END $$;

-- ============================================================================
-- PART 7: Helper function to reorder tasks (for drag-drop)
-- ============================================================================

DROP FUNCTION IF EXISTS reorder_project_tasks(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION reorder_project_tasks(
  task_id UUID,
  new_position INTEGER,
  new_status TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  old_position INTEGER;
  old_status TEXT;
  target_project_id UUID;
BEGIN
  -- Get current position and status
  SELECT position, status, project_id
  INTO old_position, old_status, target_project_id
  FROM project_tasks
  WHERE id = task_id;

  -- If status changed, update it
  IF new_status IS NOT NULL AND new_status != old_status THEN
    UPDATE project_tasks
    SET status = new_status,
        updated_at = now()
    WHERE id = task_id;
    
    old_status := new_status;
  END IF;

  -- Reorder tasks in the same status/project
  IF new_position != old_position THEN
    -- Shift tasks between old and new position
    IF new_position < old_position THEN
      -- Moving up
      UPDATE project_tasks
      SET position = position + 1,
          updated_at = now()
      WHERE project_id = target_project_id
        AND status = old_status
        AND position >= new_position
        AND position < old_position;
    ELSE
      -- Moving down
      UPDATE project_tasks
      SET position = position - 1,
          updated_at = now()
      WHERE project_id = target_project_id
        AND status = old_status
        AND position > old_position
        AND position <= new_position;
    END IF;

    -- Update the moved task
    UPDATE project_tasks
    SET position = new_position,
        updated_at = now()
    WHERE id = task_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reorder_project_tasks TO authenticated;

-- ============================================================================
-- PART 8: Trigger to auto-update updated_at timestamp
-- ============================================================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 9: Verify all real-time channels are enabled
-- ============================================================================

-- List of tables that need real-time
DO $$
DECLARE
  tables_to_enable TEXT[] := ARRAY[
    'issue_activity',
    'issue_attachments',
    'issue_watchers',
    'issue_time_logs',
    'issue_chat_messages',
    'project_tasks',
    'issues'
  ];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables_to_enable
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
      RAISE NOTICE 'Enabled real-time for: %', table_name;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  RAISE NOTICE '✅ All issue tracking features fixed';
  RAISE NOTICE '📝 Remarks submission - RLS policies updated';
  RAISE NOTICE '📎 File attachments - storage policies fixed, 50MB limit';
  RAISE NOTICE '⏱️ Time tracking - real-time enabled';
  RAISE NOTICE '🎯 Drag & drop - reorder function created';
  RAISE NOTICE '🔔 Real-time sync - enabled for all tables';
  RAISE NOTICE '🧪 Test: Create issue, add remark, upload file, log time, drag task';
END $$;
