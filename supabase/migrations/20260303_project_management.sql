-- ============================================================================
-- Project Management Workflow (Jira/Monday Inspired)
-- ============================================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'active', 'completed', 'on_hold'
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  manager_id UUID REFERENCES auth.users(id),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Project Tasks Table
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'review', 'done'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Task Comments
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Task Checklists
CREATE TABLE IF NOT EXISTS public.task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. HR KPI Definitions (Expanded)
CREATE TABLE IF NOT EXISTS public.hr_kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL, -- 'efficiency', 'quality', 'reliability', 'training'
  target_default NUMERIC,
  unit TEXT DEFAULT 'percentage'
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_kpi_definitions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Projects
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view projects" ON public.projects;
  CREATE POLICY "Everyone can view projects" ON public.projects
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage projects" ON public.projects;
  CREATE POLICY "Staff can manage projects" ON public.projects
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Project Tasks
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view tasks" ON public.project_tasks;
  CREATE POLICY "Everyone can view tasks" ON public.project_tasks
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage tasks" ON public.project_tasks;
  CREATE POLICY "Staff can manage tasks" ON public.project_tasks
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Insert default KPI Definitions
INSERT INTO public.hr_kpi_definitions (name, description, category, target_default) VALUES
  ('Task Completion Rate', 'Percentage of assigned tasks completed on time', 'efficiency', 90),
  ('Resolution Speed', 'Average time taken to resolve assigned issues', 'efficiency', 85),
  ('Vendor Response Time', 'Communication speed with assigned vendors', 'quality', 80),
  ('Documentation Accuracy', 'Correctness of MOU and vault documentation', 'quality', 95),
  ('Event Attendance', 'On-site attendance at managed events', 'reliability', 100)
ON CONFLICT (name) DO NOTHING;

-- 8. Triggers for updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
