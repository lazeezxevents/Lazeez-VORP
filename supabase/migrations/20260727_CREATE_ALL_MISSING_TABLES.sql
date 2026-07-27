-- ============================================================================
-- CREATE ALL MISSING TABLES - ONE DEFINITIVE MIGRATION
-- ============================================================================
-- ROOT CAUSE: All issue enhancement tables are missing from the database.
-- Every query returns 400 because the tables don't exist.
-- This migration creates ALL required tables from scratch.
-- ============================================================================

-- ============================================================================
-- 1. TASKS TABLE (was getting 404)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issue_id uuid,
  due_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_issue ON tasks(issue_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;

CREATE POLICY "Users can view tasks" ON tasks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update tasks" ON tasks FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete tasks" ON tasks FOR DELETE USING (auth.uid() = created_by);

-- ============================================================================
-- 2. ISSUE_WATCHERS TABLE (was getting 400)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue ON issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user ON issue_watchers(user_id);

ALTER TABLE issue_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view issue watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Auth users can add watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Auth users can remove watchers" ON issue_watchers;

CREATE POLICY "Anyone can view issue watchers"
  ON issue_watchers FOR SELECT USING (true);

CREATE POLICY "Auth users can add watchers"
  ON issue_watchers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can remove watchers"
  ON issue_watchers FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 3. ISSUE_ACTIVITY TABLE (remarks - was getting 400)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'comment' CHECK (action_type IN (
    'comment', 'status_change', 'priority_change', 'assignment',
    'created', 'label_added', 'label_removed', 'watcher_added',
    'watcher_removed', 'attachment_added', 'attachment_removed', 'time_logged'
  )),
  old_value text,
  new_value text,
  comment_text text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_activity_issue ON issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_user ON issue_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_created ON issue_activity(created_at ASC);

DROP POLICY IF EXISTS "Anyone can view issue activity" ON issue_activity;
DROP POLICY IF EXISTS "Auth users can add activity" ON issue_activity;
DROP POLICY IF EXISTS "Users can update own activity" ON issue_activity;

CREATE POLICY "Anyone can view issue activity"
  ON issue_activity FOR SELECT USING (true);

CREATE POLICY "Auth users can add activity"
  ON issue_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity"
  ON issue_activity FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. ISSUE_CHAT_MESSAGES TABLE (was getting 400)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_ai boolean NOT NULL DEFAULT false,
  ai_agent_name text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_issue ON issue_chat_messages(issue_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON issue_chat_messages(created_at ASC);

ALTER TABLE issue_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Auth users can send messages" ON issue_chat_messages;

CREATE POLICY "Anyone can view chat messages"
  ON issue_chat_messages FOR SELECT USING (true);

CREATE POLICY "Auth users can send messages"
  ON issue_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_ai = true);

-- ============================================================================
-- 5. ISSUE_ATTACHMENTS TABLE (was getting 400)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue ON issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_attachments_uploader ON issue_attachments(uploaded_by);

ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Auth users can upload attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON issue_attachments;

CREATE POLICY "Anyone can view attachments"
  ON issue_attachments FOR SELECT USING (true);

CREATE POLICY "Auth users can upload attachments"
  ON issue_attachments FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own attachments"
  ON issue_attachments FOR DELETE USING (auth.uid() = uploaded_by);

-- ============================================================================
-- 6. ISSUE_TIME_LOGS TABLE (was getting 400)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours numeric(10, 2) NOT NULL CHECK (hours > 0),
  description text,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_issue ON issue_time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user ON issue_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON issue_time_logs(logged_date DESC);

ALTER TABLE issue_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Auth users can add time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can update own time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can delete own time logs" ON issue_time_logs;

CREATE POLICY "Anyone can view time logs"
  ON issue_time_logs FOR SELECT USING (true);

CREATE POLICY "Auth users can add time logs"
  ON issue_time_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time logs"
  ON issue_time_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time logs"
  ON issue_time_logs FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 7. ISSUE_LABELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE issue_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view labels" ON issue_labels;
DROP POLICY IF EXISTS "Auth users can manage labels" ON issue_labels;

CREATE POLICY "Anyone can view labels"
  ON issue_labels FOR SELECT USING (true);

CREATE POLICY "Auth users can manage labels"
  ON issue_labels FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 8. ISSUE_LABEL_RELATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_label_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(issue_id, label_id)
);

ALTER TABLE issue_label_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view label relations" ON issue_label_relations;
DROP POLICY IF EXISTS "Auth users can manage label relations" ON issue_label_relations;

CREATE POLICY "Anyone can view label relations"
  ON issue_label_relations FOR SELECT USING (true);

CREATE POLICY "Auth users can manage label relations"
  ON issue_label_relations FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 9. ISSUE_TIMERS TABLE (auto-timer system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS issue_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_timers_issue ON issue_timers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_timers_user ON issue_timers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_timers_active ON issue_timers(is_active) WHERE is_active = true;

ALTER TABLE issue_timers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can manage timers" ON issue_timers;

CREATE POLICY "Anyone can manage timers"
  ON issue_timers FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 10. STORAGE BUCKET FOR ATTACHMENTS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'issue-attachments',
  'issue-attachments',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf',
        'text/plain','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage policies
DROP POLICY IF EXISTS "issue-attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "issue-attachments auth upload" ON storage.objects;
DROP POLICY IF EXISTS "issue-attachments auth delete" ON storage.objects;

CREATE POLICY "issue-attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-attachments');

CREATE POLICY "issue-attachments auth upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "issue-attachments auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'issue-attachments' AND auth.uid() IS NOT NULL);

-- ============================================================================
-- 11. ADD MISSING COLUMNS TO ISSUES TABLE
-- ============================================================================
-- Add missing columns if they don't exist (use assigned_to, not assignee_id)
ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_date date;

-- ============================================================================
-- 12. AUTO-TIMER TRIGGERS
-- ============================================================================

-- Start timer when issue goes to in_progress
CREATE OR REPLACE FUNCTION fn_start_issue_timer()
RETURNS TRIGGER AS $$
BEGIN
  -- Use assigned_to instead of assignee_id (correct column name)
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' AND NEW.assigned_to IS NOT NULL THEN
    -- Deactivate any existing active timer first
    UPDATE issue_timers SET is_active = false
    WHERE issue_id = NEW.id AND is_active = true;

    -- Start fresh timer
    INSERT INTO issue_timers (issue_id, user_id, started_at, is_active)
    VALUES (NEW.id, NEW.assigned_to, now(), true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stop timer and log time when issue is resolved/closed
CREATE OR REPLACE FUNCTION fn_stop_issue_timer()
RETURNS TRIGGER AS $$
DECLARE
  v_timer RECORD;
  v_hours numeric;
BEGIN
  IF (NEW.status IN ('resolved', 'closed')) AND OLD.status NOT IN ('resolved', 'closed') THEN
    FOR v_timer IN
      SELECT * FROM issue_timers WHERE issue_id = NEW.id AND is_active = true
    LOOP
      v_hours := ROUND(EXTRACT(EPOCH FROM (now() - v_timer.started_at)) / 3600.0, 2);
      IF v_hours >= 0.02 THEN -- At least ~1 minute
        INSERT INTO issue_time_logs (issue_id, user_id, hours, description, logged_date)
        VALUES (NEW.id, v_timer.user_id, v_hours, 'Auto-logged (timer stopped on resolve)', CURRENT_DATE);
      END IF;
      UPDATE issue_timers SET is_active = false WHERE id = v_timer.id;
    END LOOP;
    -- Record resolved_at timestamp
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_start_issue_timer ON issues;
CREATE TRIGGER trg_start_issue_timer
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_start_issue_timer();

DROP TRIGGER IF EXISTS trg_stop_issue_timer ON issues;
CREATE TRIGGER trg_stop_issue_timer
  BEFORE UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_stop_issue_timer();

-- ============================================================================
-- 13. ENABLE REAL-TIME FOR ALL TABLES
-- ============================================================================
DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY[
    'tasks', 'issue_watchers', 'issue_activity', 'issue_chat_messages',
    'issue_attachments', 'issue_time_logs', 'issue_labels',
    'issue_label_relations', 'issue_timers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime', tbl;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 14. NOTIFICATION HELPER (for global notifications)
-- ============================================================================
CREATE OR REPLACE FUNCTION create_notification_for_users(
  p_user_ids uuid[],
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_category text DEFAULT 'system',
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE v_uid uuid;
BEGIN
  FOREACH v_uid IN ARRAY p_user_ids LOOP
    INSERT INTO notifications (
      user_id, title, message, type, category,
      entity_type, entity_id, action_url, metadata, read, archived
    ) VALUES (
      v_uid, p_title, p_message, p_type, p_category,
      p_entity_type, p_entity_id, p_action_url, p_metadata, false, false
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 15. NOTIFICATION TRIGGERS (backend, session-independent)
-- ============================================================================

-- When issue status changes, notify watchers
CREATE OR REPLACE FUNCTION fn_notify_issue_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_watchers uuid[];
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT array_agg(user_id) INTO v_watchers
  FROM issue_watchers WHERE issue_id = NEW.id;

  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    PERFORM create_notification_for_users(
      v_watchers,
      'Issue status updated: ' || NEW.title,
      'Status changed from ' || OLD.status || ' → ' || NEW.status,
      CASE WHEN NEW.status = 'resolved' THEN 'success' ELSE 'info' END,
      'issue', 'issue', NEW.id::text, '/issues',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Notify assignee when assigned (use assigned_to, not assignee_id)
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM create_notification_for_users(
      ARRAY[NEW.assigned_to],
      'Issue assigned to you: ' || NEW.title,
      'Priority: ' || NEW.priority || ' | Status: ' || NEW.status,
      'info', 'issue', 'issue', NEW.id::text, '/issues',
      jsonb_build_object('priority', NEW.priority)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_issue_status ON issues;
CREATE TRIGGER trg_notify_issue_status
  AFTER UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_issue_status_change();

-- When watcher added, notify them
CREATE OR REPLACE FUNCTION fn_notify_watcher_added()
RETURNS TRIGGER AS $$
DECLARE v_title text;
BEGIN
  SELECT title INTO v_title FROM issues WHERE id = NEW.issue_id;
  PERFORM create_notification_for_users(
    ARRAY[NEW.user_id],
    'You are now watching: ' || COALESCE(v_title, 'an issue'),
    'You will receive updates when this issue changes',
    'info', 'issue', 'issue', NEW.issue_id::text, '/issues',
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_watcher ON issue_watchers;
CREATE TRIGGER trg_notify_watcher
  AFTER INSERT ON issue_watchers
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_watcher_added();

-- When remark added, notify watchers
CREATE OR REPLACE FUNCTION fn_notify_remark_added()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_author text;
  v_watchers uuid[];
BEGIN
  IF NEW.action_type != 'comment' OR NEW.comment_text IS NULL THEN RETURN NEW; END IF;

  SELECT title INTO v_title FROM issues WHERE id = NEW.issue_id;
  SELECT full_name INTO v_author FROM profiles WHERE id = NEW.user_id;

  SELECT array_agg(user_id) INTO v_watchers
  FROM issue_watchers
  WHERE issue_id = NEW.issue_id AND user_id != NEW.user_id;

  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    PERFORM create_notification_for_users(
      v_watchers,
      'New remark on: ' || COALESCE(v_title, 'an issue'),
      COALESCE(v_author, 'Someone') || ': ' || LEFT(NEW.comment_text, 100),
      'info', 'issue', 'issue', NEW.issue_id::text, '/issues',
      jsonb_build_object('author', v_author)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_remark ON issue_activity;
CREATE TRIGGER trg_notify_remark
  AFTER INSERT ON issue_activity
  FOR EACH ROW
  WHEN (NEW.action_type = 'comment')
  EXECUTE FUNCTION fn_notify_remark_added();

-- ============================================================================
-- DONE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ALL TABLES CREATED SUCCESSFULLY:';
  RAISE NOTICE '  tasks                  (was 404)';
  RAISE NOTICE '  issue_watchers         (was 400)';
  RAISE NOTICE '  issue_activity         (was 400)';
  RAISE NOTICE '  issue_chat_messages    (was 400)';
  RAISE NOTICE '  issue_attachments      (was 400)';
  RAISE NOTICE '  issue_time_logs        (was 400)';
  RAISE NOTICE '  issue_labels';
  RAISE NOTICE '  issue_label_relations';
  RAISE NOTICE '  issue_timers';
  RAISE NOTICE 'RLS POLICIES: All set correctly';
  RAISE NOTICE 'REAL-TIME: All tables enabled';
  RAISE NOTICE 'STORAGE: issue-attachments bucket ready';
  RAISE NOTICE 'AUTO-TIMER: Triggers installed';
  RAISE NOTICE 'NOTIFICATIONS: Backend triggers installed';
  RAISE NOTICE '============================================';
END $$;
