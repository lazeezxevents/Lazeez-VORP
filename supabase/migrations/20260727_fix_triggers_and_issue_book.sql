-- ============================================================================
-- Fix issue deletion null constraint + safe triggers + Issue Book view
-- ============================================================================

-- 1. Fix log_issue_changes trigger — wrap every INSERT in BEGIN/EXCEPTION so a
--    null actor_id (e.g. no assignee and reported_by somehow null) never crashes
--    a legitimate UPDATE or DELETE.

CREATE OR REPLACE FUNCTION log_issue_changes()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
BEGIN
  -- Determine who made the change; fall back gracefully
  actor_id := COALESCE(NEW.assigned_to, NEW.reported_by);

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    BEGIN
      INSERT INTO issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (NEW.id, actor_id, 'status_change', OLD.status, NEW.status);
    EXCEPTION WHEN not_null_violation THEN
      NULL; -- skip logging if actor cannot be determined
    END;
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    BEGIN
      INSERT INTO issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (NEW.id, actor_id, 'priority_change', OLD.priority, NEW.priority);
    EXCEPTION WHEN not_null_violation THEN
      NULL;
    END;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    BEGIN
      INSERT INTO issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (
        NEW.id,
        COALESCE(NEW.reported_by, NEW.assigned_to),
        'assignment',
        (SELECT email FROM profiles WHERE id = OLD.assigned_to),
        (SELECT email FROM profiles WHERE id = NEW.assigned_to)
      );
    EXCEPTION WHEN not_null_violation THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS issue_changes_log ON issues;
CREATE TRIGGER issue_changes_log
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
  )
  EXECUTE FUNCTION log_issue_changes();

-- 2. Fix log_issue_creation trigger — also guard against null reported_by
CREATE OR REPLACE FUNCTION log_issue_creation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reported_by IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    INSERT INTO issue_activity (issue_id, user_id, action_type, new_value)
    VALUES (NEW.id, NEW.reported_by, 'created', NEW.title);
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS issue_creation_log ON issues;
CREATE TRIGGER issue_creation_log
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION log_issue_creation();

-- 3. Fix issue_activity RLS — allow cascade-delete to work without constraint
--    errors when an issue is deleted (all child rows are cascade-deleted by
--    the FK, but we also need INSERT policies to be clean).

DROP POLICY IF EXISTS "Admins can delete issue activity" ON issue_activity;
CREATE POLICY "Admins can delete issue activity"
  ON issue_activity FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
    OR auth.uid() = user_id
  );

-- 4. Make user_id nullable so system-generated activity rows (e.g. from
--    background jobs without an auth session) don't violate the NOT NULL
--    constraint. Existing rows are unaffected.
DO $$
BEGIN
  -- Only alter if the column is currently NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'issue_activity'
      AND column_name = 'user_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE issue_activity ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END$$;

-- 5. Issue Book: view of resolved/closed issues with analytics
-- Drop existing views first to allow column type changes
DROP VIEW IF EXISTS issue_book CASCADE;
DROP VIEW IF EXISTS issue_analytics CASCADE;
DROP VIEW IF EXISTS vendor_issue_stats CASCADE;
DROP VIEW IF EXISTS assignee_issue_stats CASCADE;

CREATE VIEW issue_book AS
SELECT
  i.id,
  i.title,
  i.description,
  i.status,
  i.priority,
  i.created_at,
  i.updated_at,
  i.resolved_at,
  i.due_date,
  -- Resolution time in hours
  CASE
    WHEN i.resolved_at IS NOT NULL AND i.created_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600.0, 2)
    ELSE NULL
  END AS resolution_hours,
  -- SLA hours (time from creation to due date)
  CASE
    WHEN i.due_date IS NOT NULL AND i.created_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (i.due_date::timestamptz - i.created_at)) / 3600.0, 2)
    ELSE NULL
  END AS sla_hours,
  -- Was it resolved on time?
  CASE
    WHEN i.resolved_at IS NOT NULL AND i.due_date IS NOT NULL
    THEN i.resolved_at <= i.due_date::timestamptz
    ELSE NULL
  END AS resolved_on_time,
  v.id    AS vendor_id,
  v.name  AS vendor_name,
  v.category AS vendor_category,
  rp.full_name AS reporter_name,
  rp.email     AS reporter_email,
  ap.full_name AS assignee_name,
  ap.email     AS assignee_email,
  -- Time logged on the issue
  COALESCE((
    SELECT SUM(hours) FROM issue_time_logs tl WHERE tl.issue_id = i.id
  ), 0) AS total_hours_logged,
  -- Comment count
  COALESCE((
    SELECT COUNT(*) FROM issue_activity ia
    WHERE ia.issue_id = i.id AND ia.action_type = 'comment'
  ), 0) AS comment_count,
  -- Attachment count
  COALESCE((
    SELECT COUNT(*) FROM issue_attachments att WHERE att.issue_id = i.id
  ), 0) AS attachment_count,
  -- Watcher count
  COALESCE((
    SELECT COUNT(*) FROM issue_watchers iw WHERE iw.issue_id = i.id
  ), 0) AS watcher_count
FROM issues i
LEFT JOIN vendors  v  ON v.id  = i.vendor_id
LEFT JOIN profiles rp ON rp.id = i.reported_by
LEFT JOIN profiles ap ON ap.id = i.assigned_to
WHERE i.status IN ('resolved', 'closed');

GRANT SELECT ON issue_book TO authenticated;

-- 6. Weekly analytics aggregation (used by Issue Book charts)
CREATE VIEW issue_analytics AS
SELECT
  DATE_TRUNC('week', created_at)::date AS week,
  COUNT(*)                              AS total_created,
  COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
  COUNT(*) FILTER (WHERE priority = 'critical')            AS critical_count,
  COUNT(*) FILTER (WHERE priority = 'high')                AS high_count,
  COUNT(*) FILTER (WHERE priority = 'medium')              AS medium_count,
  COUNT(*) FILTER (WHERE priority = 'low')                 AS low_count,
  ROUND(AVG(
    CASE WHEN resolved_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0
    END
  )::numeric, 2) AS avg_resolution_hours
FROM issues
GROUP BY DATE_TRUNC('week', created_at)::date
ORDER BY week DESC;

GRANT SELECT ON issue_analytics TO authenticated;

-- 7. Vendor issue stats (Issue Book vendor insights)
CREATE VIEW vendor_issue_stats AS
SELECT
  v.id             AS vendor_id,
  v.name           AS vendor_name,
  v.category,
  v.status         AS vendor_status,
  COUNT(i.id)      AS total_issues,
  COUNT(i.id) FILTER (WHERE i.status IN ('resolved', 'closed')) AS resolved_issues,
  COUNT(i.id) FILTER (WHERE i.status IN ('open', 'in_progress')) AS open_issues,
  COUNT(i.id) FILTER (WHERE i.priority = 'critical')             AS critical_issues,
  ROUND(
    COUNT(i.id) FILTER (WHERE i.status IN ('resolved', 'closed'))::numeric
    / NULLIF(COUNT(i.id), 0) * 100, 1
  ) AS resolution_rate,
  ROUND(AVG(
    CASE WHEN i.resolved_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600.0
    END
  )::numeric, 2) AS avg_resolution_hours
FROM vendors v
LEFT JOIN issues i ON i.vendor_id = v.id
GROUP BY v.id, v.name, v.category, v.status;

GRANT SELECT ON vendor_issue_stats TO authenticated;

-- 8. Assignee performance stats (Issue Book employee insights)
CREATE VIEW assignee_issue_stats AS
SELECT
  p.id              AS user_id,
  p.full_name,
  p.email,
  p.main_role,
  COUNT(i.id)       AS total_assigned,
  COUNT(i.id) FILTER (WHERE i.status IN ('resolved', 'closed')) AS total_resolved,
  COUNT(i.id) FILTER (WHERE i.status IN ('open', 'in_progress')) AS currently_open,
  COUNT(i.id) FILTER (WHERE i.priority = 'critical')             AS critical_handled,
  ROUND(
    COUNT(i.id) FILTER (WHERE i.status IN ('resolved', 'closed'))::numeric
    / NULLIF(COUNT(i.id), 0) * 100, 1
  ) AS resolution_rate,
  ROUND(AVG(
    CASE WHEN i.resolved_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600.0
    END
  )::numeric, 2) AS avg_resolution_hours,
  ROUND(COALESCE((
    SELECT SUM(tl.hours) FROM issue_time_logs tl WHERE tl.user_id = p.id
  ), 0)::numeric, 2) AS total_hours_logged
FROM profiles p
LEFT JOIN issues i ON i.assigned_to = p.id
GROUP BY p.id, p.full_name, p.email, p.main_role
HAVING COUNT(i.id) > 0;

GRANT SELECT ON assignee_issue_stats TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '✅ Trigger fixes + Issue Book views created successfully';
  RAISE NOTICE '📊 Views: issue_book, issue_analytics, vendor_issue_stats, assignee_issue_stats';
END $$;
