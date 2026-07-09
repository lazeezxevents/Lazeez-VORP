-- ============================================================================
-- Fix Project Management RLS Policies
-- The original policies referenced has_role(uid, 'staff') which doesn't exist
-- in the app_role enum. Fixed to use is_staff() function instead.
-- Also adds INSERT-specific policies for projects and tasks.
-- ============================================================================

-- Fix Projects Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view projects" ON public.projects;
  CREATE POLICY "Everyone can view projects" ON public.projects
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage projects" ON public.projects;
  DROP POLICY IF EXISTS "Staff can insert projects" ON public.projects;
  DROP POLICY IF EXISTS "Staff can update projects" ON public.projects;
  DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
  
  CREATE POLICY "Staff can insert projects" ON public.projects
    FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
  
  CREATE POLICY "Staff can update projects" ON public.projects
    FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
  
  CREATE POLICY "Admins can delete projects" ON public.projects
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix Project Tasks Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view tasks" ON public.project_tasks;
  CREATE POLICY "Everyone can view tasks" ON public.project_tasks
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage tasks" ON public.project_tasks;
  DROP POLICY IF EXISTS "Staff can insert tasks" ON public.project_tasks;
  DROP POLICY IF EXISTS "Staff can update tasks" ON public.project_tasks;
  DROP POLICY IF EXISTS "Admins can delete tasks" ON public.project_tasks;
  
  CREATE POLICY "Staff can insert tasks" ON public.project_tasks
    FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
  
  CREATE POLICY "Staff can update tasks" ON public.project_tasks
    FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
  
  CREATE POLICY "Admins can delete tasks" ON public.project_tasks
    FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix Project Comments Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view comments" ON public.project_comments;
  CREATE POLICY "Everyone can view project comments" ON public.project_comments
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert their comments" ON public.project_comments;
  CREATE POLICY "Users can insert their comments" ON public.project_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix Task Checklists Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view checklists" ON public.task_checklists;
  CREATE POLICY "Everyone can view checklists" ON public.task_checklists
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can manage checklists" ON public.task_checklists;
  CREATE POLICY "Staff can manage checklists" ON public.task_checklists
    FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Fix HR KPI Definitions Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view kpis" ON public.hr_kpi_definitions;
  CREATE POLICY "Everyone can view kpis" ON public.hr_kpi_definitions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage kpis" ON public.hr_kpi_definitions;
  CREATE POLICY "Admins can manage kpis" ON public.hr_kpi_definitions
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add realtime for projects (safe if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
