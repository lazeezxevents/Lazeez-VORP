-- Fix issue triggers that reference wrong column name
-- The triggers were using assignee_id but column is actually assigned_to

-- Drop old triggers
DROP TRIGGER IF EXISTS trg_start_issue_timer ON issues;
DROP TRIGGER IF EXISTS trg_stop_issue_timer ON issues;

-- Drop old functions
DROP FUNCTION IF EXISTS fn_start_issue_timer();
DROP FUNCTION IF EXISTS fn_stop_issue_timer();

-- Recreate with correct column name: assigned_to (not assignee_id)
CREATE OR REPLACE FUNCTION fn_start_issue_timer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only start timer if status changes to in_progress and issue is assigned
  IF NEW.status = 'in_progress' 
     AND OLD.status IS DISTINCT FROM 'in_progress' 
     AND NEW.assigned_to IS NOT NULL THEN
    
    -- Stop any active timers first
    UPDATE issue_timers 
    SET is_active = false, stopped_at = now()
    WHERE issue_id = NEW.id AND is_active = true;

    -- Start new timer
    INSERT INTO issue_timers (issue_id, user_id, started_at, is_active)
    VALUES (NEW.id, NEW.assigned_to, now(), true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION fn_stop_issue_timer()
RETURNS TRIGGER AS $$
DECLARE
  v_timer RECORD;
  v_hours NUMERIC;
BEGIN
  -- Only process when status changes to resolved or closed
  IF NEW.status IN ('resolved', 'closed') 
     AND OLD.status NOT IN ('resolved', 'closed') THEN
    
    -- Process all active timers
    FOR v_timer IN
      SELECT * FROM issue_timers 
      WHERE issue_id = NEW.id AND is_active = true
    LOOP
      -- Calculate hours
      v_hours := ROUND(
        EXTRACT(EPOCH FROM (now() - v_timer.started_at)) / 3600.0, 
        2
      );
      
      -- Only log if at least 1 minute
      IF v_hours >= 0.02 THEN
        INSERT INTO issue_time_logs (
          issue_id, user_id, hours, description, logged_date
        ) VALUES (
          NEW.id, 
          v_timer.user_id, 
          v_hours, 
          'Auto-logged (timer stopped on resolve)', 
          CURRENT_DATE
        );
      END IF;
      
      -- Stop timer
      UPDATE issue_timers 
      SET is_active = false, stopped_at = now()
      WHERE id = v_timer.id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers
CREATE TRIGGER trg_start_issue_timer
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_start_issue_timer();

CREATE TRIGGER trg_stop_issue_timer
  BEFORE UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION fn_stop_issue_timer();
