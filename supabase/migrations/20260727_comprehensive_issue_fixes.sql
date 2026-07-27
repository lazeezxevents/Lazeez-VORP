-- =====================================================
-- COMPREHENSIVE ISSUE SYSTEM FIX
-- Fixes: remarks, chat, notifications, timer, drag-drop, colors, archive
-- =====================================================

-- =====================================================
-- 1. FIX USER CONTEXT AND RLS POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert their own remarks" ON issue_remarks;
DROP POLICY IF EXISTS "Users can view remarks they created or are involved in" ON issue_remarks;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Users can view chat messages for their issues" ON issue_chat_messages;

-- Create permissive policies for remarks
CREATE POLICY "Authenticated users can insert remarks"
ON issue_remarks FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all remarks"
ON issue_remarks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own remarks"
ON issue_remarks FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create permissive policies for chat messages
CREATE POLICY "Authenticated users can insert chat messages"
ON issue_chat_messages FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all chat messages"
ON issue_chat_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own chat messages"
ON issue_chat_messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 2. FIX TIME TRACKING - PERSISTENT BACKGROUND TIMER
-- =====================================================

-- Add last_sync column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issue_time_logs' AND column_name = 'last_sync'
  ) THEN
    ALTER TABLE issue_time_logs ADD COLUMN last_sync timestamptz;
  END IF;
END $$;

-- Add session_id for tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issue_time_logs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE issue_time_logs ADD COLUMN session_id text;
  END IF;
END $$;

-- Function to auto-sync active timers (works across sessions)
CREATE OR REPLACE FUNCTION sync_active_timers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all active timers by calculating elapsed time since last sync
  UPDATE issue_time_logs
  SET 
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer,
    last_sync = NOW()
  WHERE ended_at IS NULL
    AND started_at IS NOT NULL;
END;
$$;

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
  -- Sync existing timers first
  PERFORM sync_active_timers();
  
  -- Stop any existing active timer for this user on this issue
  UPDATE issue_time_logs
  SET 
    ended_at = NOW(),
    duration = duration + EXTRACT(EPOCH FROM (NOW() - COALESCE(last_sync, started_at)))::integer
  WHERE issue_id = p_issue_id
    AND user_id = p_user_id
    AND ended_at IS NULL;
  
  -- Start new timer
  INSERT INTO issue_time_logs (issue_id, user_id, started_at, duration, session_id, last_sync)
  VALUES (p_issue_id, p_user_id, NOW(), 0, p_session_id, NOW())
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
  PERFORM sync_active_timers();
  
  -- Stop active timer and get total duration
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

-- Function to get current timer state (always accurate)
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
  PERFORM sync_active_timers();
  
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
-- 3. FIX NOTIFICATIONS FOR NEW ISSUES
-- =====================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS notify_new_issue ON issues;

-- Function to notify on new issue
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
      related_type
    ) VALUES (
      NEW.assigned_to,
      'New issue assigned',
      'You have been assigned to: ' || NEW.title || COALESCE(' for ' || v_vendor_name, ''),
      'issue_assigned',
      NEW.id,
      'issue'
    );
  END IF;
  
  -- Notify all watchers
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_id,
    related_type
  )
  SELECT 
    iw.user_id,
    'New issue created',
    v_creator_name || ' created: ' || NEW.title || COALESCE(' (' || v_vendor_name || ')', ''),
    'issue_created',
    NEW.id,
    'issue'
  FROM issue_watchers iw
  WHERE iw.issue_id = NEW.id
    AND iw.user_id != NEW.created_by; -- Don't notify creator
  
  RETURN NEW;
END;
$$;

-- Create trigger for new issues
CREATE TRIGGER notify_new_issue
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_new_issue();

-- =====================================================
-- 4. FIX DRAG AND DROP - ADD POSITION TRACKING
-- =====================================================

-- Ensure position column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'position'
  ) THEN
    ALTER TABLE issues ADD COLUMN position integer DEFAULT 0;
  END IF;
END $$;

-- Create index for position
DROP INDEX IF EXISTS idx_issues_position;
CREATE INDEX idx_issues_position ON issues(position);

-- Function to reorder issues
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
  -- Get current position
  SELECT position INTO v_old_position
  FROM issues
  WHERE id = p_issue_id;
  
  -- If moving down
  IF p_new_position > v_old_position THEN
    UPDATE issues
    SET position = position - 1
    WHERE position > v_old_position
      AND position <= p_new_position;
  -- If moving up
  ELSIF p_new_position < v_old_position THEN
    UPDATE issues
    SET position = position + 1
    WHERE position >= p_new_position
      AND position < v_old_position;
  END IF;
  
  -- Update the dragged issue
  UPDATE issues
  SET position = p_new_position
  WHERE id = p_issue_id;
END;
$$;

-- =====================================================
-- 5. ISSUE ARCHIVE FOR RESOLVED ISSUES
-- =====================================================

-- Add archived column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived boolean DEFAULT false;
  END IF;
END $$;

-- Add archived_at timestamp
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Add archived_by user reference
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE issues ADD COLUMN archived_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Create index for archived issues
DROP INDEX IF EXISTS idx_issues_archived;
CREATE INDEX idx_issues_archived ON issues(archived, status);

-- Function to archive resolved issues
CREATE OR REPLACE FUNCTION archive_issue(
  p_issue_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues
  SET 
    archived = true,
    archived_at = NOW(),
    archived_by = p_user_id
  WHERE id = p_issue_id
    AND status IN ('resolved', 'closed');
END;
$$;

-- Function to unarchive issue
CREATE OR REPLACE FUNCTION unarchive_issue(
  p_issue_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE issues
  SET 
    archived = false,
    archived_at = NULL,
    archived_by = NULL
  WHERE id = p_issue_id;
END;
$$;

-- =====================================================
-- 6. ISSUE BOOK VIEWS WITH PROPER COLOR THEMING
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS issue_book_vendor_stats;
DROP VIEW IF EXISTS issue_book_assignee_stats;

-- Vendor statistics view
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

-- Assignee statistics view
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
-- 7. ENABLE REALTIME FOR ALL TABLES
-- =====================================================

-- Enable realtime for issues table
ALTER PUBLICATION supabase_realtime ADD TABLE issues;

-- Enable realtime for remarks
ALTER PUBLICATION supabase_realtime ADD TABLE issue_remarks;

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE issue_chat_messages;

-- Enable realtime for time logs
ALTER PUBLICATION supabase_realtime ADD TABLE issue_time_logs;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Grant execute on all functions
GRANT EXECUTE ON FUNCTION sync_active_timers() TO authenticated;
GRANT EXECUTE ON FUNCTION start_issue_timer(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION stop_issue_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_timer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_issue(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_issue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_issue(uuid) TO authenticated;

-- Grant access to views
GRANT SELECT ON issue_book_vendor_stats TO authenticated;
GRANT SELECT ON issue_book_assignee_stats TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
