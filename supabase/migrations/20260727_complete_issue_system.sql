-- =====================================================
-- COMPLETE ISSUE SYSTEM - ALL TABLES AND FIXES
-- Run this migration FIRST before any other issue-related migrations
-- =====================================================

-- =====================================================
-- 1. CREATE ALL BASE TABLES
-- =====================================================

-- Issues table (if not exists)
CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  position integer DEFAULT 0,
  archived boolean DEFAULT false,
  archived_at timestamptz,
  archived_by uuid REFERENCES users(id),
  project_id uuid,
  project_task_id uuid
);

CREATE INDEX IF NOT EXISTS idx_issues_vendor_id ON issues(vendor_id);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_position ON issues(position);
CREATE INDEX IF NOT EXISTS idx_issues_archived ON issues(archived, status);

ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to issues" ON issues;
CREATE POLICY "Global access to issues"
ON issues FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue remarks table
CREATE TABLE IF NOT EXISTS issue_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_remarks_issue_id ON issue_remarks(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_remarks_user_id ON issue_remarks(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_remarks_created_at ON issue_remarks(created_at DESC);

ALTER TABLE issue_remarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to remarks" ON issue_remarks;
CREATE POLICY "Global access to remarks"
ON issue_remarks FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue chat messages table
CREATE TABLE IF NOT EXISTS issue_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_issue_id ON issue_chat_messages(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_chat_messages_created_at ON issue_chat_messages(created_at DESC);

ALTER TABLE issue_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to chat messages" ON issue_chat_messages;
CREATE POLICY "Global access to chat messages"
ON issue_chat_messages FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue watchers table
CREATE TABLE IF NOT EXISTS issue_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue_id ON issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user_id ON issue_watchers(user_id);

ALTER TABLE issue_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to watchers" ON issue_watchers;
CREATE POLICY "Global access to watchers"
ON issue_watchers FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue time logs table
CREATE TABLE IF NOT EXISTS issue_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz,
  ended_at timestamptz,
  duration integer DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  last_sync timestamptz,
  session_id text,
  auto_tracked boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_issue_time_logs_issue_id ON issue_time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_user_id ON issue_time_logs(user_id);

ALTER TABLE issue_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to time logs" ON issue_time_logs;
CREATE POLICY "Global access to time logs"
ON issue_time_logs FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue attachments table
CREATE TABLE IF NOT EXISTS issue_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);

ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to attachments" ON issue_attachments;
CREATE POLICY "Global access to attachments"
ON issue_attachments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Issue activity table
CREATE TABLE IF NOT EXISTS issue_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_created_at ON issue_activity(created_at DESC);

ALTER TABLE issue_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global access to activity" ON issue_activity;
CREATE POLICY "Global access to activity"
ON issue_activity FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- =====================================================
-- 2. SESSION-INDEPENDENT TIMER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION sync_all_active_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issue_time_logs
  SET 
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer,
    last_sync = NOW()
  WHERE ended_at IS NULL AND started_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION start_issue_timer(
  p_issue_id uuid,
  p_user_id uuid,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  PERFORM sync_all_active_timers();
  
  UPDATE issue_time_logs
  SET 
    ended_at = NOW(),
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer
  WHERE issue_id = p_issue_id
    AND user_id = p_user_id
    AND ended_at IS NULL;
  
  INSERT INTO issue_time_logs (issue_id, user_id, started_at, duration, session_id, last_sync, auto_tracked)
  VALUES (p_issue_id, p_user_id, NOW(), 0, p_session_id, NOW(), true)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION stop_issue_timer(p_issue_id uuid, p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_duration integer;
BEGIN
  PERFORM sync_all_active_timers();
  
  UPDATE issue_time_logs
  SET 
    ended_at = NOW(),
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer
  WHERE issue_id = p_issue_id
    AND user_id = p_user_id
    AND ended_at IS NULL
  RETURNING duration INTO v_total_duration;
  
  RETURN COALESCE(v_total_duration, 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_active_timer(p_issue_id uuid, p_user_id uuid)
RETURNS TABLE (log_id uuid, started_at timestamptz, current_duration integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM sync_all_active_timers();
  
  RETURN QUERY
  SELECT 
    id,
    issue_time_logs.started_at,
    duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, issue_time_logs.started_at)))::integer
  FROM issue_time_logs
  WHERE issue_id = p_issue_id
    AND user_id = p_user_id
    AND ended_at IS NULL
  LIMIT 1;
END;
$$;

-- =====================================================
-- 3. DRAG & DROP AND ARCHIVE
-- =====================================================

CREATE OR REPLACE FUNCTION reorder_issue(p_issue_id uuid, p_new_position integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_position integer;
BEGIN
  SELECT position INTO v_old_position FROM issues WHERE id = p_issue_id;
  
  IF p_new_position > v_old_position THEN
    UPDATE issues SET position = position - 1
    WHERE position > v_old_position AND position <= p_new_position;
  ELSIF p_new_position < v_old_position THEN
    UPDATE issues SET position = position + 1
    WHERE position >= p_new_position AND position < v_old_position;
  END IF;
  
  UPDATE issues SET position = p_new_position WHERE id = p_issue_id;
END;
$$;

CREATE OR REPLACE FUNCTION archive_issue(p_issue_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues
  SET archived = true, archived_at = NOW(), archived_by = p_user_id
  WHERE id = p_issue_id AND status IN ('resolved', 'closed');
END;
$$;

CREATE OR REPLACE FUNCTION unarchive_issue(p_issue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues
  SET archived = false, archived_at = NULL, archived_by = NULL
  WHERE id = p_issue_id;
END;
$$;

-- =====================================================
-- 4. NOTIFICATION TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name text;
  v_creator_name text;
BEGIN
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;
  SELECT full_name INTO v_creator_name FROM users WHERE id = NEW.created_by;
  
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, related_id, related_type, created_at)
    VALUES (
      NEW.assigned_to,
      'New issue assigned',
      'You have been assigned to: ' || NEW.title || COALESCE(' for ' || v_vendor_name, ''),
      'issue_assigned',
      NEW.id,
      'issue',
      NOW()
    );
  END IF;
  
  INSERT INTO notifications (user_id, title, message, type, related_id, related_type, created_at)
  SELECT 
    iw.user_id,
    'New issue created',
    v_creator_name || ' created: ' || NEW.title || COALESCE(' (' || v_vendor_name || ')', ''),
    'issue_created',
    NEW.id,
    'issue',
    NOW()
  FROM issue_watchers iw
  WHERE iw.issue_id = NEW.id AND iw.user_id != NEW.created_by;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_issue ON issues;
CREATE TRIGGER notify_new_issue
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_new_issue();

-- =====================================================
-- 5. ISSUE BOOK VIEWS
-- =====================================================

DROP VIEW IF EXISTS issue_book_vendor_stats;
CREATE VIEW issue_book_vendor_stats AS
SELECT 
  v.id AS vendor_id,
  v.name AS vendor_name,
  COUNT(DISTINCT i.id) AS total_issues,
  COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.id END) AS total_resolved,
  COUNT(DISTINCT CASE WHEN i.archived = true THEN i.id END) AS total_archived,
  COALESCE(AVG(
    CASE 
      WHEN i.status = 'resolved' AND i.created_at IS NOT NULL AND i.updated_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 3600
    END
  ), 0) AS avg_resolution_hours,
  COUNT(DISTINCT CASE WHEN i.priority = 'critical' THEN i.id END) AS critical_count,
  COUNT(DISTINCT CASE WHEN i.priority = 'high' THEN i.id END) AS high_count,
  COUNT(DISTINCT CASE WHEN i.priority = 'medium' THEN i.id END) AS medium_count,
  COUNT(DISTINCT CASE WHEN i.priority = 'low' THEN i.id END) AS low_count
FROM vendors v
LEFT JOIN issues i ON i.vendor_id = v.id
GROUP BY v.id, v.name
HAVING COUNT(DISTINCT i.id) > 0;

DROP VIEW IF EXISTS issue_book_assignee_stats;
CREATE VIEW issue_book_assignee_stats AS
SELECT 
  u.id AS user_id,
  u.full_name AS assignee_name,
  COUNT(DISTINCT i.id) AS total_assigned,
  COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.id END) AS total_resolved,
  COUNT(DISTINCT CASE WHEN i.archived = true THEN i.id END) AS total_archived,
  COALESCE(
    ROUND(
      (COUNT(DISTINCT CASE WHEN i.status = 'resolved' THEN i.id END)::numeric / 
       NULLIF(COUNT(DISTINCT i.id), 0) * 100),
      2
    ),
    0
  ) AS resolution_rate,
  COALESCE(SUM(itl.duration), 0) / 3600.0 AS total_hours_logged
FROM users u
LEFT JOIN issues i ON i.assigned_to = u.id
LEFT JOIN issue_time_logs itl ON itl.issue_id = i.id AND itl.user_id = u.id
GROUP BY u.id, u.full_name
HAVING COUNT(DISTINCT i.id) > 0;

-- =====================================================
-- 6. ENABLE REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issues;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_remarks;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_time_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS notifications;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION sync_all_active_timers() TO authenticated;
GRANT EXECUTE ON FUNCTION start_issue_timer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_issue_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_issue(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_issue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_issue(uuid) TO authenticated;

GRANT SELECT ON issue_book_vendor_stats TO authenticated;
GRANT SELECT ON issue_book_assignee_stats TO authenticated;

-- =====================================================
-- COMPLETE - ALL TABLES AND FUNCTIONS CREATED
-- =====================================================
