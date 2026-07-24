-- ============================================================================
-- Issue Ticketing Enhancement - Phase 1: Foundation
-- Created: 2026-07-24
-- ============================================================================

-- 1. Issue Attachments Table
CREATE TABLE IF NOT EXISTS public.issue_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Issue Activity Log Table
CREATE TABLE IF NOT EXISTS public.issue_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'comment', 'status_change', 'priority_change', 'assignment', 'attachment', 'created'
  old_value TEXT,
  new_value TEXT,
  comment_text TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Issue Watchers Table
CREATE TABLE IF NOT EXISTS public.issue_watchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

-- 4. Issue Labels Table
CREATE TABLE IF NOT EXISTS public.issue_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'blue',
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Issue Label Relations Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.issue_label_relations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.issue_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(issue_id, label_id)
);

-- 6. Issue Time Logs Table
CREATE TABLE IF NOT EXISTS public.issue_time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  hours DECIMAL(5,2) NOT NULL,
  description TEXT,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Issue Templates Table
CREATE TABLE IF NOT EXISTS public.issue_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  title_template TEXT NOT NULL,
  description_template TEXT,
  default_priority issue_priority NOT NULL DEFAULT 'medium',
  default_labels UUID[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Add columns to issues table
ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS sla_response_target_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS sla_resolution_target_hours INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 9. Enable RLS on new tables
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_label_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_templates ENABLE ROW LEVEL SECURITY;

-- This migration may be run manually after a partial deployment. Remove the
-- policies first so a previously-created policy does not abort the entire run.
DO $$
BEGIN
  DROP POLICY IF EXISTS "All authenticated can view attachments" ON public.issue_attachments;
  DROP POLICY IF EXISTS "All authenticated can upload attachments" ON public.issue_attachments;
  DROP POLICY IF EXISTS "Users can delete own attachments" ON public.issue_attachments;
  DROP POLICY IF EXISTS "All authenticated can view activity" ON public.issue_activity;
  DROP POLICY IF EXISTS "System can create activity" ON public.issue_activity;
  DROP POLICY IF EXISTS "All authenticated can view watchers" ON public.issue_watchers;
  DROP POLICY IF EXISTS "All authenticated can add watchers" ON public.issue_watchers;
  DROP POLICY IF EXISTS "Users can remove themselves as watcher" ON public.issue_watchers;
  DROP POLICY IF EXISTS "All authenticated can view labels" ON public.issue_labels;
  DROP POLICY IF EXISTS "Staff can manage labels" ON public.issue_labels;
  DROP POLICY IF EXISTS "Staff can update labels" ON public.issue_labels;
  DROP POLICY IF EXISTS "Staff can delete labels" ON public.issue_labels;
  DROP POLICY IF EXISTS "All authenticated can view label relations" ON public.issue_label_relations;
  DROP POLICY IF EXISTS "All authenticated can add labels to issues" ON public.issue_label_relations;
  DROP POLICY IF EXISTS "All authenticated can remove labels from issues" ON public.issue_label_relations;
  DROP POLICY IF EXISTS "All authenticated can view time logs" ON public.issue_time_logs;
  DROP POLICY IF EXISTS "All authenticated can log time" ON public.issue_time_logs;
  DROP POLICY IF EXISTS "Users can update own time logs" ON public.issue_time_logs;
  DROP POLICY IF EXISTS "Users can delete own time logs" ON public.issue_time_logs;
  DROP POLICY IF EXISTS "All authenticated can view templates" ON public.issue_templates;
  DROP POLICY IF EXISTS "Staff can manage templates" ON public.issue_templates;
  DROP POLICY IF EXISTS "Staff can update templates" ON public.issue_templates;
  DROP POLICY IF EXISTS "Staff can delete templates" ON public.issue_templates;
  DROP POLICY IF EXISTS "Authenticated users can view issue attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own attachments from storage" ON storage.objects;
END $$;

-- 10. RLS Policies - Attachments
CREATE POLICY "All authenticated can view attachments"
  ON public.issue_attachments FOR SELECT USING (true);

CREATE POLICY "All authenticated can upload attachments"
  ON public.issue_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own attachments"
  ON public.issue_attachments FOR DELETE
  USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));

-- 11. RLS Policies - Activity
CREATE POLICY "All authenticated can view activity"
  ON public.issue_activity FOR SELECT USING (true);

CREATE POLICY "System can create activity"
  ON public.issue_activity FOR INSERT
  WITH CHECK (true);

-- 12. RLS Policies - Watchers
CREATE POLICY "All authenticated can view watchers"
  ON public.issue_watchers FOR SELECT USING (true);

CREATE POLICY "All authenticated can add watchers"
  ON public.issue_watchers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can remove themselves as watcher"
  ON public.issue_watchers FOR DELETE
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 13. RLS Policies - Labels
CREATE POLICY "All authenticated can view labels"
  ON public.issue_labels FOR SELECT USING (true);

CREATE POLICY "Staff can manage labels"
  ON public.issue_labels FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update labels"
  ON public.issue_labels FOR UPDATE
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete labels"
  ON public.issue_labels FOR DELETE
  USING (public.is_staff(auth.uid()));

-- 14. RLS Policies - Label Relations
CREATE POLICY "All authenticated can view label relations"
  ON public.issue_label_relations FOR SELECT USING (true);

CREATE POLICY "All authenticated can add labels to issues"
  ON public.issue_label_relations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "All authenticated can remove labels from issues"
  ON public.issue_label_relations FOR DELETE
  USING (true);

-- 15. RLS Policies - Time Logs
CREATE POLICY "All authenticated can view time logs"
  ON public.issue_time_logs FOR SELECT USING (true);

CREATE POLICY "All authenticated can log time"
  ON public.issue_time_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time logs"
  ON public.issue_time_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own time logs"
  ON public.issue_time_logs FOR DELETE
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- 16. RLS Policies - Templates
CREATE POLICY "All authenticated can view templates"
  ON public.issue_templates FOR SELECT USING (true);

CREATE POLICY "Staff can manage templates"
  ON public.issue_templates FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update templates"
  ON public.issue_templates FOR UPDATE
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete templates"
  ON public.issue_templates FOR DELETE
  USING (public.is_staff(auth.uid()));

-- 17. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_id ON public.issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON public.issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_created_at ON public.issue_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue_id ON public.issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user_id ON public.issue_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_label_relations_issue_id ON public.issue_label_relations(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_label_relations_label_id ON public.issue_label_relations(label_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_issue_id ON public.issue_time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_time_logs_user_id ON public.issue_time_logs(user_id);

-- 18. Trigger to log issue activity automatically
CREATE OR REPLACE FUNCTION public.log_issue_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.issue_activity (issue_id, user_id, action_type, new_value)
    VALUES (NEW.id, NEW.reported_by, 'created', 'Issue created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'status_change', OLD.status, NEW.status);
    END IF;
    IF OLD.priority != NEW.priority THEN
      INSERT INTO public.issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'priority_change', OLD.priority, NEW.priority);
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO public.issue_activity (issue_id, user_id, action_type, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'assignment', 
              COALESCE(OLD.assigned_to::text, 'unassigned'), 
              COALESCE(NEW.assigned_to::text, 'unassigned'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS issue_activity_trigger ON public.issues;
CREATE TRIGGER issue_activity_trigger
  AFTER INSERT OR UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.log_issue_activity();

-- 19. Storage bucket for issue attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-attachments', 'issue-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 20. Storage policies for attachments
CREATE POLICY "Authenticated users can view issue attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'issue-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload issue attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own attachments from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'issue-attachments' AND auth.uid() IS NOT NULL);

-- 21. Insert default labels
INSERT INTO public.issue_labels (name, color, description) VALUES
  ('bug', 'red', 'Something isn''t working'),
  ('enhancement', 'blue', 'New feature or request'),
  ('documentation', 'purple', 'Improvements or additions to documentation'),
  ('urgent', 'orange', 'Requires immediate attention'),
  ('question', 'yellow', 'Further information is requested'),
  ('duplicate', 'gray', 'This issue already exists')
ON CONFLICT (name) DO NOTHING;

-- 22. Insert default templates
INSERT INTO public.issue_templates (name, title_template, description_template, default_priority) VALUES
  ('Vendor Delay', 'Vendor Delivery Delay - [Vendor Name]', 'The vendor has not delivered on time.\n\nExpected delivery: [Date]\nActual status: [Status]\nImpact: [Impact description]', 'high'),
  ('Quality Issue', 'Quality Concern - [Vendor Name]', 'There is a quality issue with the vendor''s service/product.\n\nIssue details: [Description]\nEvidence: [Attach photos]\nImpact: [Impact on operations]', 'high'),
  ('Payment Dispute', 'Payment Dispute - [Vendor Name]', 'There is a disagreement regarding payment terms or amounts.\n\nInvoice number: [Number]\nAmount in question: [Amount]\nDetails: [Explanation]', 'medium'),
  ('Communication Gap', 'Communication Issue - [Vendor Name]', 'Vendor is not responding or communication is unclear.\n\nLast contact: [Date]\nAttempts made: [Number]\nUrgency: [Level]', 'medium'),
  ('Contract Clarification', 'MOU/Contract Question - [Vendor Name]', 'Need clarification on contract terms or MOU details.\n\nClause in question: [Clause]\nQuestion: [Your question]\nContext: [Background]', 'low')
ON CONFLICT (name) DO NOTHING;

-- 23. Enable realtime for new tables (safe to re-run after a partial deployment)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'issue_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_activity;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'issue_attachments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_attachments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'issue_watchers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_watchers;
  END IF;
END $$;

-- ============================================================================
-- Migration Complete!
-- ============================================================================



