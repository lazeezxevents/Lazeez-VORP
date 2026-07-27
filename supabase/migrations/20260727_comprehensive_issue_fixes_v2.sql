-- =====================================================
-- COMPREHENSIVE ISSUE SYSTEM FIX V2
-- Creates all tables, fixes remarks, chat, notifications, timer, drag-drop, colors, archive
-- =====================================================

-- =====================================================
-- 1. CREATE MISSING TABLES
-- =====================================================

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

-- Enable RLS
ALTER TABLE issue_remarks ENABLE ROW LEVEL SECURITY;

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

-- Enable RLS
ALTER TABLE issue_chat_messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. FIX RLS POLICIES - GLOBAL, NOT SESSION-DEPENDENT
-- =====================================================

-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "Users can insert their own remarks" ON issue_remarks;
DROP POLICY IF EXISTS "Users can view remarks they created or are involved in" ON issue_remarks;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Users can view chat messages for their issues" ON issue_chat_messages;
DROP POLICY IF EXISTS "Users can update their own remarks" ON issue_remarks;
DROP POLICY IF EXISTS "Users can update their own chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can insert remarks" ON issue_remarks;
DROP POLICY IF EXISTS "Authenticated users can view all remarks" ON issue_remarks;
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can view all chat messages" ON issue_chat_messages;

-- Global policies - no session dependency
CREATE POLICY "Global access to remarks"
ON issue_remarks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Global access to chat messages"
ON issue_chat_messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- 3. FIX TIME TRACKING - SESSION-INDEPENDENT, ALWAYS RUNNING
-- =====================================================

-- Add columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issue_time_logs' AND column_name = 'last_sync'
  ) THEN
    ALTER TABLE issue_time_logs ADD COLUMN last_sync timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issue_time_logs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE issue_time_logs ADD COLUMN session_id text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issue_time_logs' AND column_name = 'auto_tracked'
  ) THEN
    ALTER TABLE issue_time_logs ADD COLUMN auto_tracked boolean DEFAULT false;
  END IF;
END $$;

-- Function to sync ALL active timers globally (no user/session filter)
CREATE OR REPLACE FUNCTION sync_all_active_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update ALL active timers across all users and sessions
  UPDATE issue_time_logs
  SET 
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer,
    last_sync = NOW()
  WHERE ended_at IS NULL
    AND started_at IS NOT NULL;
END;
$$;

-- Schedule sync every minute (simulated via trigger on any issue update)
CREATE OR REPLACE FUNCTION trigger_timer_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM sync_all_active_timers();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_timers_on_issue_update ON issues;
CREATE TRIGGER sync_timers_on_issue_update
AFTER UPDATE ON issues
FOR EACH ROW
EXECUTE FUNCTION trigger_timer_sync();

-- Function to start timer (session-independent)
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
  -- Sync all timers first
  PERFORM sync_all_active_timers();
  
  -- Stop any existing active timer for this user on this issue
  UPDATE issue_time_logs
  SET 
    ended_at = NOW(),
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer
  WHERE issue_id = p_issue_id
    AND user_id = p_user_id
    AND ended_at IS NULL;
  
  -- Start new timer
  INSERT INTO issue_time_logs (issue_id, user_id, started_at, duration, session_id, last_sync, auto_tracked)
  VALUES (p_issue_id, p_user_id, NOW(), 0, p_session_id, NOW(), true)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to stop timer
CREATE OR REPLACE FUNCTION stop_issue_timer(
  p_issue_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_duration integer;
BEGIN
  -- Sync first
  PERFORM sync_all_active_timers();
  
  -- Stop active timer
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

-- Function to get timer state (always accurate, no session dependency)
CREATE OR REPLACE FUNCTION get_active_timer(
  p_issue_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  log_id uuid,
  started_at timestamptz,
  current_duration integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sync first
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

-- Function to get ALL active timers (global monitoring)
CREATE OR REPLACE FUNCTION get_all_active_timers()
RETURNS TABLE (
  log_id uuid,
  issue_id uuid,
  user_id uuid,
  started_at timestamptz,
  current_duration integer,
  session_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM sync_all_active_timers();
  
  RETURN QUERY
  SELECT 
    id,
    issue_time_logs.issue_id,
    issue_time_logs.user_id,
    issue_time_logs.started_at,
    duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, issue_time_logs.started_at)))::integer,
    issue_time_logs.session_id
  FROM issue_time_logs
  WHERE ended_at IS NULL;
END;
$$;

-- =====================================================
-- 4. FIX NOTIFICATIONS - GLOBAL, ALWAYS WORKING
-- =====================================================

-- Update notifications trigger to be session-independent
CREATE OR REPLACE FUNCTION notify_new_issue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_name text;
  v_creator_name text;
BEGIN
  -- Get vendor name
  SELECT name INTO v_vendor_name
  FROM vendors
  WHERE id = NEW.vendor_id;
  
  -- Get creator name
  SELECT full_name INTO v_creator_name
  FROM users
  WHERE id = NEW.created_by;
  
  -- Notify assigned user if exists
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      related_id,
      related_type,
      created_at
    ) VALUES (
      NEW.assigned_to,
      'New issue assigned',
      'You have been assigned to: ' || NEW.title || COALESCE(' for ' || v_vendor_name, ''),
      'issue_assigned',
      NEW.id,
      'issue',
      NOW()
    );
  END IF;
  
  -- Notify all watchers
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_id,
    related_type,
    created_at
  )
  SELECT 
    iw.user_id,
    'New issue created',
    v_creator_name || ' created: ' || NEW.title || COALESCE(' (' || v_vendor_name || ')', ''),
    'issue_created',
    NEW.id,
    'issue',
    NOW()
  FROM issue_watchers iw
  WHERE iw.issue_id = NEW.id
    AND iw.user_id != NEW.created_by;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_issue ON issues;
CREATE TRIGGER notify_new_issue
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_new_issue();

-- =====================================================
-- 5. FIX DRAG AND DROP
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'position'
  ) THEN
    ALTER TABLE issues ADD COLUMN position integer DEFAULT 0;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_issues_position;
CREATE INDEX idx_issues_position ON issues(position);

CREATE OR REPLACE FUNCTION reorder_issue(
  p_issue_id uuid,
  p_new_position integer
)
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

-- =====================================================
-- 6. ARCHIVE SYSTEM
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived_at timestamptz;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived_by uuid REFERENCES users(id);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_issues_archived;
CREATE INDEX idx_issues_archived ON issues(archived, status);

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
-- 7. ISSUE BOOK VIEWS
-- =====================================================

DROP VIEW IF EXISTS issue_book_vendor_stats;
DROP VIEW IF EXISTS issue_book_assignee_stats;

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
HAVING COUNT(DISTINCT i.id) > 0
ORDER BY total_issues DESC;

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
  COALESCE(SUM(itl.duration), 0) / 3600.0 AS total_hours_logged,
  COALESCE(AVG(
    CASE 
      WHEN i.status = 'resolved'
      THEN EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 3600
    END
  ), 0) AS avg_resolution_hours
FROM users u
LEFT JOIN issues i ON i.assigned_to = u.id
LEFT JOIN issue_time_logs itl ON itl.issue_id = i.id AND itl.user_id = u.id
GROUP BY u.id, u.full_name
HAVING COUNT(DISTINCT i.id) > 0
ORDER BY total_assigned DESC;

-- =====================================================
-- 8. ENABLE REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issues;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_remarks;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS issue_time_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS notifications;

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION sync_all_active_timers() TO authenticated;
GRANT EXECUTE ON FUNCTION start_issue_timer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_issue_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_active_timers() TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_issue(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_issue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_issue(uuid) TO authenticated;

GRANT SELECT ON issue_book_vendor_stats TO authenticated;
GRANT SELECT ON issue_book_assignee_stats TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
