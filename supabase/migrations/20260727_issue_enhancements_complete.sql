-- Complete Issue Management Enhancement System
-- Date: July 27, 2026
-- Features: Watchers, Attachments, Activity, Time Tracking, Drag & Drop

-- ============================================================================
-- PART 1: CREATE TABLES
-- ============================================================================

-- Issue Activity (comments, status changes, etc.)
CREATE TABLE IF NOT EXISTS issue_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'comment', 'status_change', 'priority_change', 'assignment',
    'created', 'label_added', 'label_removed', 'watcher_added',
    'watcher_removed', 'attachment_added', 'attachment_removed', 'time_logged'
  )),
  old_value TEXT,
  new_value TEXT,
  comment_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Issue Attachments
CREATE TABLE IF NOT EXISTS issue_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Issue Watchers
CREATE TABLE IF NOT EXISTS issue_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

-- Issue Time Logs
CREATE TABLE IF NOT EXISTS issue_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours DECIMAL(10, 2) NOT NULL CHECK (hours > 0),
  description TEXT,
  logged_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Issue Labels (for future categorization)
CREATE TABLE IF NOT EXISTS issue_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Issue Label Relations (many-to-many)
CREATE TABLE IF NOT EXISTS issue_label_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(issue_id, label_id)
);

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_created_at ON issue_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue_id ON issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user_id ON issue_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_issue_id ON issue_time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_user_id ON issue_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_logged_date ON issue_time_logs(logged_date DESC);
CREATE INDEX IF NOT EXISTS idx_issue_label_relations_issue_id ON issue_label_relations(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_label_relations_label_id ON issue_label_relations(label_id);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE issue_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_label_relations ENABLE ROW LEVEL SECURITY;

-- Issue Activity Policies
DROP POLICY IF EXISTS "Anyone can view issue activity" ON issue_activity;
DROP POLICY IF EXISTS "Authenticated users can add issue activity" ON issue_activity;
CREATE POLICY "Anyone can view issue activity"
  ON issue_activity FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can add issue activity"
  ON issue_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Issue Attachments Policies
DROP POLICY IF EXISTS "Anyone can view issue attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON issue_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments or admins can delete any" ON issue_attachments;
CREATE POLICY "Anyone can view issue attachments"
  ON issue_attachments FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can upload attachments"
  ON issue_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can delete their own attachments or admins can delete any"
  ON issue_attachments FOR DELETE
  USING (
    auth.uid() = uploaded_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
  );

-- Issue Watchers Policies
DROP POLICY IF EXISTS "Anyone can view issue watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Authenticated users can add watchers" ON issue_watchers;
DROP POLICY IF EXISTS "Users can remove themselves or added_by can remove" ON issue_watchers;
CREATE POLICY "Anyone can view issue watchers"
  ON issue_watchers FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can add watchers"
  ON issue_watchers FOR INSERT
  WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Users can remove themselves or added_by can remove"
  ON issue_watchers FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = added_by);

-- Issue Time Logs Policies
DROP POLICY IF EXISTS "Anyone can view issue time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Authenticated users can log time" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can update their own time logs" ON issue_time_logs;
DROP POLICY IF EXISTS "Users can delete their own time logs" ON issue_time_logs;
CREATE POLICY "Anyone can view issue time logs"
  ON issue_time_logs FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can log time"
  ON issue_time_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time logs"
  ON issue_time_logs FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own time logs"
  ON issue_time_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Issue Labels Policies
DROP POLICY IF EXISTS "Anyone can view issue labels" ON issue_labels;
DROP POLICY IF EXISTS "Admins and staff can create labels" ON issue_labels;
CREATE POLICY "Anyone can view issue labels"
  ON issue_labels FOR SELECT
  USING (true);
CREATE POLICY "Admins and staff can create labels"
  ON issue_labels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND main_role IN ('admin', 'staff')
    )
  );

-- Issue Label Relations Policies
DROP POLICY IF EXISTS "Anyone can view issue label relations" ON issue_label_relations;
DROP POLICY IF EXISTS "Authenticated users can add label relations" ON issue_label_relations;
DROP POLICY IF EXISTS "Authenticated users can remove label relations" ON issue_label_relations;
CREATE POLICY "Anyone can view issue label relations"
  ON issue_label_relations FOR SELECT
  USING (true);
CREATE POLICY "Authenticated users can add label relations"
  ON issue_label_relations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can remove label relations"
  ON issue_label_relations FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- PART 4: STORAGE BUCKET FOR ATTACHMENTS
-- ============================================================================

-- Create storage bucket for issue attachments (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-attachments', 'issue-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Drop existing policies first to avoid conflicts on re-run
DROP POLICY IF EXISTS "Anyone can view issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Storage Policy: Anyone can view
CREATE POLICY "Anyone can view issue attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-attachments');

-- Storage Policy: Authenticated users can upload
CREATE POLICY "Authenticated users can upload issue attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'issue-attachments' AND
    auth.role() = 'authenticated'
  );

-- Storage Policy: Users can delete their own files or admins can delete any
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'issue-attachments' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin')
    )
  );

-- ============================================================================
-- PART 5: REAL-TIME SUBSCRIPTIONS
-- ============================================================================

-- Enable real-time for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE issue_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE issue_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE issue_watchers;
ALTER PUBLICATION supabase_realtime ADD TABLE issue_time_logs;

-- ============================================================================
-- PART 6: TRIGGER FOR AUTO-CREATING "CREATED" ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION log_issue_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO issue_activity (
    issue_id,
    user_id,
    action_type,
    new_value
  ) VALUES (
    NEW.id,
    NEW.reported_by,
    'created',
    NEW.title
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS issue_creation_log ON issues;
CREATE TRIGGER issue_creation_log
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION log_issue_creation();

-- ============================================================================
-- PART 7: TRIGGER FOR AUTO-LOGGING STATUS/PRIORITY CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION log_issue_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO issue_activity (
      issue_id,
      user_id,
      action_type,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      COALESCE(NEW.assigned_to, NEW.reported_by),
      'status_change',
      OLD.status,
      NEW.status
    );
  END IF;

  -- Log priority changes
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO issue_activity (
      issue_id,
      user_id,
      action_type,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      COALESCE(NEW.assigned_to, NEW.reported_by),
      'priority_change',
      OLD.priority,
      NEW.priority
    );
  END IF;

  -- Log assignment changes
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO issue_activity (
      issue_id,
      user_id,
      action_type,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      NEW.reported_by,
      'assignment',
      (SELECT email FROM profiles WHERE id = OLD.assigned_to),
      (SELECT email FROM profiles WHERE id = NEW.assigned_to)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
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

-- ============================================================================
-- PART 8: HELPER FUNCTIONS
-- ============================================================================

-- Get total time logged for an issue
CREATE OR REPLACE FUNCTION get_issue_total_hours(issue_id_param UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(hours), 0)
  FROM issue_time_logs
  WHERE issue_id = issue_id_param;
$$ LANGUAGE SQL STABLE;

-- Get watcher count for an issue
CREATE OR REPLACE FUNCTION get_issue_watcher_count(issue_id_param UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM issue_watchers
  WHERE issue_id = issue_id_param;
$$ LANGUAGE SQL STABLE;

-- Get attachment count for an issue
CREATE OR REPLACE FUNCTION get_issue_attachment_count(issue_id_param UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM issue_attachments
  WHERE issue_id = issue_id_param;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE issue_activity IS 'Activity log for issues (comments, status changes, etc.)';
COMMENT ON TABLE issue_attachments IS 'File attachments for issues';
COMMENT ON TABLE issue_watchers IS 'Users watching specific issues';
COMMENT ON TABLE issue_time_logs IS 'Time tracking logs for issues';
COMMENT ON TABLE issue_labels IS 'Labels/tags for categorizing issues';
COMMENT ON TABLE issue_label_relations IS 'Many-to-many relationship between issues and labels';

COMMENT ON FUNCTION log_issue_creation IS 'Automatically logs issue creation in activity timeline';
COMMENT ON FUNCTION log_issue_changes IS 'Automatically logs status, priority, and assignment changes';
COMMENT ON FUNCTION get_issue_total_hours IS 'Returns total hours logged for an issue';
COMMENT ON FUNCTION get_issue_watcher_count IS 'Returns number of watchers for an issue';
COMMENT ON FUNCTION get_issue_attachment_count IS 'Returns number of attachments for an issue';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Issue Enhancement System installed successfully!';
  RAISE NOTICE '📊 Tables created: issue_activity, issue_attachments, issue_watchers, issue_time_logs, issue_labels';
  RAISE NOTICE '🔒 RLS policies applied';
  RAISE NOTICE '📁 Storage bucket configured: issue-attachments';
  RAISE NOTICE '🔄 Real-time subscriptions enabled';
  RAISE NOTICE '⚡ Auto-logging triggers activated';
END $$;
