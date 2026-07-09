-- ============================================================================
-- Enterprise HR ERP Foundation
-- ============================================================================

-- 1. Organization Hierarchy
CREATE TABLE IF NOT EXISTS public.business_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    head_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update departments to link to business units
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(name, department_id)
);

-- Link profiles to teams
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 2. Time Intelligence & Attendance
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'present', -- 'present', 'late', 'absent', 'on_leave'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL, -- 'annual', 'sick', 'maternity', 'unpaid'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reason TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Appraisal & Feedback (360 Degree)
CREATE TABLE IF NOT EXISTS public.appraisal_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
    review_type TEXT NOT NULL, -- 'manager', 'peer', 'self', 'subordinate'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Scores (1-5)
    collaboration_score INTEGER CHECK (collaboration_score >= 1 AND collaboration_score <= 5),
    reliability_score INTEGER CHECK (reliability_score >= 1 AND reliability_score <= 5),
    quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
    innovation_score INTEGER CHECK (innovation_score >= 1 AND innovation_score <= 5),
    
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. KPI Weights Configuration (Per Department)
CREATE TABLE IF NOT EXISTS public.department_kpi_weights (
    department_id UUID PRIMARY KEY REFERENCES public.departments(id) ON DELETE CASCADE,
    output_weight NUMERIC DEFAULT 0.30,
    efficiency_weight NUMERIC DEFAULT 0.15,
    quality_weight NUMERIC DEFAULT 0.15,
    reliability_weight NUMERIC DEFAULT 0.10,
    behavioral_weight NUMERIC DEFAULT 0.20,
    contextual_weight NUMERIC DEFAULT 0.10, -- (Vendor/CS score)
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Workforce Lifecycle (Transfers/Promotions)
CREATE TABLE IF NOT EXISTS public.employee_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'hire', 'transfer', 'promotion', 'disciplinary', 'offboard'
    previous_data JSONB,
    new_data JSONB,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appraisal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_kpi_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Viewable by everyone, Manageable by Admin/HR)
-- [Simplified for now, will refine as needed]

CREATE POLICY "View business units" ON public.business_units FOR SELECT USING (true);
CREATE POLICY "View teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "View attendance" ON public.attendance_logs FOR SELECT USING (auth.uid() = employee_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "View leave requests" ON public.leave_requests FOR SELECT USING (auth.uid() = employee_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "View appraisals" ON public.appraisal_reviews FOR SELECT USING (auth.uid() = employee_id OR reviewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Initial Business Units
INSERT INTO public.business_units (name, description) VALUES
  ('Corporate', 'Executive and strategic head office'),
  ('Events & Operations', 'Field divisions for event execution'),
  ('Technology & Product', 'Platform and engineering units')
ON CONFLICT (name) DO NOTHING;
