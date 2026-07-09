-- ============================================================================
-- Lightweight PM System Enhancement: Sprints, Milestones, Activity Feed
-- Following Operational Minimalism — only high-impact features
-- ============================================================================

-- 1. Sprints Table
CREATE TABLE IF NOT EXISTS public.sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'active', 'completed'
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Link tasks to sprints (optional FK on project_tasks)
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(5,1) DEFAULT 0;

-- 3. Milestones Table
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'missed'
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Activity Feed Table (cross-module)
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'task', 'project', 'sprint', 'milestone', 'issue', 'vendor', 'mou'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'assigned', 'commented', 'completed'
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Sprints Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view sprints" ON public.sprints;
  CREATE POLICY "Everyone can view sprints" ON public.sprints
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage sprints" ON public.sprints;
  CREATE POLICY "Staff can manage sprints" ON public.sprints
    FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can update sprints" ON public.sprints;
  CREATE POLICY "Staff can update sprints" ON public.sprints
    FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can delete sprints" ON public.sprints;
  CREATE POLICY "Admins can delete sprints" ON public.sprints
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Milestones Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view milestones" ON public.milestones;
  CREATE POLICY "Everyone can view milestones" ON public.milestones
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage milestones" ON public.milestones;
  CREATE POLICY "Staff can manage milestones" ON public.milestones
    FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can update milestones" ON public.milestones;
  CREATE POLICY "Staff can update milestones" ON public.milestones
    FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can delete milestones" ON public.milestones;
  CREATE POLICY "Admins can delete milestones" ON public.milestones
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Activity Feed Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view activity" ON public.activity_feed;
  CREATE POLICY "Everyone can view activity" ON public.activity_feed
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "System can insert activity" ON public.activity_feed;
  CREATE POLICY "System can insert activity" ON public.activity_feed
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Triggers
DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_sprints_updated_at ON public.sprints;
  CREATE TRIGGER update_sprints_updated_at
    BEFORE UPDATE ON public.sprints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_milestones_updated_at ON public.milestones;
  CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON public.milestones
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Auto-log task changes to activity feed
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed (entity_type, entity_id, action, description, user_id, metadata)
    VALUES ('task', NEW.id, 'created', 'Task created: ' || NEW.title, NEW.created_by,
      jsonb_build_object('project_id', NEW.project_id, 'priority', NEW.priority, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.activity_feed (entity_type, entity_id, action, description, user_id, metadata)
      VALUES ('task', NEW.id, 'status_changed',
        'Task "' || NEW.title || '" moved to ' || NEW.status,
        auth.uid(),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'project_id', NEW.project_id));
    END IF;
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.activity_feed (entity_type, entity_id, action, description, user_id, metadata)
      VALUES ('task', NEW.id, 'assigned',
        'Task "' || NEW.title || '" assigned',
        auth.uid(),
        jsonb_build_object('assignee', NEW.assigned_to, 'project_id', NEW.project_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS task_activity_trigger ON public.project_tasks;
  CREATE TRIGGER task_activity_trigger
    AFTER INSERT OR UPDATE ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Auto-log project changes to activity feed
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_feed (entity_type, entity_id, action, description, user_id)
    VALUES ('project', NEW.id, 'created', 'Project created: ' || NEW.name, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_feed (entity_type, entity_id, action, description, user_id, metadata)
    VALUES ('project', NEW.id, 'status_changed',
      'Project "' || NEW.name || '" status changed to ' || NEW.status,
      auth.uid(),
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS project_activity_trigger ON public.projects;
  CREATE TRIGGER project_activity_trigger
    AFTER INSERT OR UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.log_project_activity();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON public.sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity ON public.activity_feed(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON public.activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_tasks_sprint ON public.project_tasks(sprint_id);

-- Enable realtime (safe if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sprints;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
