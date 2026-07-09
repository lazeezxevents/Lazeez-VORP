-- ============================================================================
-- HR & Performance Features
-- ============================================================================

-- 1. Create departments table if not exists (handled by initial schema but reinforcing)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Add department_id to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 3. Create employee_kpis table
CREATE TABLE IF NOT EXISTS public.employee_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kpi_name TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'percentage',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create performance_logs table
CREATE TABLE IF NOT EXISTS public.performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES auth.users(id),
  log_type TEXT NOT NULL, -- 'review', 'warning', 'feedback', 'milestone'
  content TEXT NOT NULL,
  score INTEGER CHECK (score >= 1 AND score <= 5),
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.employee_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Departments Policies (safe: drop if exists before create)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;
  CREATE POLICY "Everyone can view departments" ON public.departments
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
  CREATE POLICY "Admins can manage departments" ON public.departments
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- KPI Policies (safe: drop if exists before create)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own KPIs" ON public.employee_kpis;
  CREATE POLICY "Users can view own KPIs" ON public.employee_kpis
    FOR SELECT TO authenticated USING (
      auth.uid() = employee_id OR 
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.departments d ON p.department_id = d.id
        WHERE p.id = employee_kpis.employee_id AND d.manager_id = auth.uid()
      ) OR
      public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Managers can update own department KPIs" ON public.employee_kpis;
  CREATE POLICY "Managers can update own department KPIs" ON public.employee_kpis
    FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.departments d ON p.department_id = d.id
        WHERE p.id = employee_kpis.employee_id AND d.manager_id = auth.uid()
      ) OR
      public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Performance Logs Policies (safe: drop if exists before create)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own performance logs" ON public.performance_logs;
  CREATE POLICY "Users can view own performance logs" ON public.performance_logs
    FOR SELECT TO authenticated USING (
      auth.uid() = employee_id OR 
      manager_id = auth.uid() OR
      public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Managers and Admins can create performance logs" ON public.performance_logs;
  CREATE POLICY "Managers and Admins can create performance logs" ON public.performance_logs
    FOR INSERT TO authenticated WITH CHECK (
      manager_id = auth.uid() OR 
      public.has_role(auth.uid(), 'admin')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Trigger for updated_at on departments and kpis
DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_kpis_updated_at ON public.employee_kpis;
CREATE TRIGGER update_employee_kpis_updated_at BEFORE UPDATE ON public.employee_kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Insert default departments
INSERT INTO public.departments (name, description) VALUES
  ('Sales', 'Handles vendor acquisition and client sales'),
  ('Operations', 'Vendor management and event coordination'),
  ('Finance', 'Financial reconciliation and vendor payments'),
  ('HR', 'Human resources and performance management'),
  ('IT', 'Technical support and platform maintenance')
ON CONFLICT (name) DO NOTHING;
