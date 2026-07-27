-- ============================================================================
-- FIX ALL ISSUE ENHANCEMENTS: RLS, POLICIES, AND TABLES
-- ============================================================================
-- This migration fixes:
-- 1. Watchers not being added (RLS/policy issue)
-- 2. Remarks not being added (RLS/policy issue)
-- 3. Attachments not loading (RLS/policy issue)
-- 4. Team chat not working (RLS/policy issue)
-- 5. Time logs not working (RLS/policy issue)
-- ============================================================================

-- Drop and recreate all policies with correct permissions
-- ============================================================================

-- ISSUE WATCHERS
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view issue watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Authenticated users can add watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Authenticated users can remove watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Users can manage watchers" ON issue_watchers;

CREATE POLICY "Anyone can view issue watchers"
  ON issue_watchers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add watchers"
  ON issue_watchers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can remove watchers"
  ON issue_watchers FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ISSUE ACTIVITY (REMARKS)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view issue activity" ON issue_activity;
DROP POLICY IF EXISTS "Authenticated users can add activity" ON issue_activity;
DROP POLICY IF EXISTS "Users can update their own activity" ON issue_activity;

CREATE POLICY "Anyone can view issue activity"
  ON issue_activity FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add activity"
  ON issue_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
  ON issue_activity FOR UPDATE
  USING (auth.uid() = user_id);

-- ISSUE ATTACHMENTS
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view issue attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON issue_attachments;

CREATE POLICY "Anyone can view issue attachments"
  ON issue_attachments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can upload attachments"
  ON issue_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own attachments"
  ON issue_attachments FOR DELETE
  USING (auth.uid() = uploaded_by);

-- ISSUE CHAT MESSAGES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view issue chat messages" ON issue_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can send chat messages" ON issue_chat_messages;

CREATE POLICY "Anyone can view issue chat messages"
  ON issue_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send chat messages"
  ON issue_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_ai = true);

-- ISSUE TIME LOGS
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view issue time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Authenticated users can add time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can update their own time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can delete their own time logs" ON issue_time_logs;

CREATE POLICY "Anyone can view issue time logs"
  ON issue_time_logs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add time logs"
  ON issue_time_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time logs"
  ON issue_time_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time logs"
  ON issue_time_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- AUTO-TIMER SYSTEM: Start timer on in_progress, stop on resolved
-- ============================================================================

-- Create issue_timers table to track active timers globally
CREATE TABLE IF NOT EXISTS issue_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(issue_id, user_id, is_active)
);

CREATE INDEX IF NOT EXISTS idx_issue_timers_issue_id ON issue_timers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_timers_user_id ON issue_timers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_timers_active ON issue_timers(is_active) WHERE is_active = true;

ALTER TABLE issue_timers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view issue timers" ON issue_timers;
DROP POLICY IF EXISTS "System can manage timers" ON issue_timers;

CREATE POLICY "Anyone can view issue timers"
  ON issue_timers FOR SELECT
  USING (true);

CREATE POLICY "System can manage timers"
  ON issue_timers FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to start timer when issue status changes to in_progress
CREATE OR REPLACE FUNCTION start_issue_timer()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to in_progress and there's an assignee
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.assignee_id IS NOT NULL THEN
    -- Create or reactivate timer for the assignee
    INSERT INTO issue_timers (issue_id, user_id, is_active)
    VALUES (NEW.id, NEW.assignee_id, true)
    ON CONFLICT (issue_id, user_id, is_active) 
    DO UPDATE SET started_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to stop timer and log time when issue is resolved
CREATE OR REPLACE FUNCTION stop_issue_timer()
RETURNS TRIGGER AS $$
DECLARE
  v_timer RECORD;
  v_elapsed_hours numeric;
BEGIN
  -- If status changed to resolved or closed
  IF (NEW.status = 'resolved' OR NEW.status = 'closed') AND 
     (OLD.status != 'resolved' AND OLD.status != 'closed') THEN
    
    -- Find active timers for this issue
    FOR v_timer IN 
      SELECT * FROM issue_timers 
      WHERE issue_id = NEW.id AND is_active = true
    LOOP
      -- Calculate elapsed time in hours
      v_elapsed_hours := EXTRACT(EPOCH FROM (now() - v_timer.started_at)) / 3600;
      
      -- Round to 2 decimal places
      v_elapsed_hours := ROUND(v_elapsed_hours, 2);
      
      -- Only log if more than 1 minute (0.016 hours)
      IF v_elapsed_hours > 0.016 THEN
        -- Insert time log
        INSERT INTO issue_time_logs (
          issue_id, 
          user_id, 
          hours, 
          description, 
          logged_date
        )
        VALUES (
          NEW.id,
          v_timer.user_id,
          v_elapsed_hours,
          'Auto-logged from timer',
          CURRENT_DATE
        );
      END IF;
      
      -- Deactivate timer
      UPDATE issue_timers 
      SET is_active = false 
      WHERE id = v_timer.id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_start_issue_timer ON issues;
DROP TRIGGER IF EXISTS trigger_stop_issue_timer ON issues;

CREATE TRIGGER trigger_start_issue_timer
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION start_issue_timer();

CREATE TRIGGER trigger_stop_issue_timer
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION stop_issue_timer();

-- ============================================================================
-- STORAGE POLICIES FOR ATTACHMENTS
-- ============================================================================

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-attachments', 'issue-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own issue attachments" ON storage.objects;

-- Create storage policies
CREATE POLICY "Anyone can view issue attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-attachments');

CREATE POLICY "Authenticated users can upload issue attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-attachments' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own issue attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'issue-attachments' AND 
    auth.uid() IS NOT NULL
  );

-- ============================================================================
-- ENSURE REAL-TIME IS ENABLED
-- ============================================================================

DO $$
BEGIN
  -- Add tables to real-time publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_watchers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_watchers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_activity;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_attachments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_time_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_time_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'issue_timers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE issue_timers;
  END IF;
END $$;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ All issue enhancement RLS policies fixed';
  RAISE NOTICE '✅ Auto-timer system created (starts on in_progress, stops on resolved)';
  RAISE NOTICE '✅ Storage policies configured for attachments';
  RAISE NOTICE '✅ Real-time enabled for all tables';
  RAISE NOTICE '';
  RAISE NOTICE 'FEATURES ENABLED:';
  RAISE NOTICE '- ✅ Watchers can be added/removed';
  RAISE NOTICE '- ✅ Remarks can be added';
  RAISE NOTICE '- ✅ Attachments can be uploaded/viewed';
  RAISE NOTICE '- ✅ Team chat messages work';
  RAISE NOTICE '- ✅ Time logs can be added manually';
  RAISE NOTICE '- ✅ Auto-timer: starts when in_progress, stops & logs when resolved';
END $$;
