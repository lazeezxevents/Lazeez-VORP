-- ============================================================================
-- HR Module — Complete Production-Ready Migration
-- Tables: reporting_lines, manager_audit_access, time_logs, units,
--         resource_allocations, capacity_forecasts, hr_notifications
-- Audit triggers on: attendance_logs, leave_requests, appraisal_reviews, employee_history
-- Enhanced RLS with manager-scoped visibility
-- ============================================================================

-- ===========================================
-- 1. Units (sub-departments)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(name, department_id)
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View units" ON public.units FOR SELECT USING (true);
CREATE POLICY "Staff manage units" ON public.units FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update units" ON public.units FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete units" ON public.units FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Link profiles to units
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;

-- ===========================================
-- 2. Reporting Lines (multi-manager support)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.reporting_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL DEFAULT 'direct_manager',
    -- 'direct_manager', 'project_manager', 'dotted_line'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(employee_id, manager_id, relationship_type)
);

ALTER TABLE public.reporting_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View reporting lines" ON public.reporting_lines FOR SELECT USING (true);
CREATE POLICY "Staff manage reporting lines" ON public.reporting_lines FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update reporting lines" ON public.reporting_lines FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete reporting lines" ON public.reporting_lines FOR DELETE USING (public.is_staff(auth.uid()));

-- ===========================================
-- 3. Manager Audit Access (audit log visibility assignments)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.manager_audit_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(manager_id, employee_id)
);

ALTER TABLE public.manager_audit_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View audit access" ON public.manager_audit_access FOR SELECT
    USING (
        auth.uid() = manager_id
        OR public.has_role(auth.uid(), 'admin')
        OR public.is_staff(auth.uid())
    );
CREATE POLICY "Admin manage audit access" ON public.manager_audit_access FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_staff(auth.uid()));
CREATE POLICY "Admin update audit access" ON public.manager_audit_access FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin') OR public.is_staff(auth.uid()));
CREATE POLICY "Admin delete audit access" ON public.manager_audit_access FOR DELETE
    USING (public.has_role(auth.uid(), 'admin') OR public.is_staff(auth.uid()));

-- ===========================================
-- 4. Time Logs (per-employee task-scoped time tracking)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID,  -- optional FK to project_tasks
    project_id UUID, -- optional FK to projects
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- computed on end
    is_idle BOOLEAN DEFAULT false,
    log_type TEXT NOT NULL DEFAULT 'work',
    -- 'work', 'break', 'meeting', 'review', 'idle'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees view own time logs" ON public.time_logs FOR SELECT
    USING (
        auth.uid() = employee_id
        OR public.is_staff(auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
            SELECT 1 FROM public.manager_audit_access
            WHERE manager_id = auth.uid() AND employee_id = time_logs.employee_id
        )
        OR EXISTS (
            SELECT 1 FROM public.reporting_lines
            WHERE manager_id = auth.uid() AND employee_id = time_logs.employee_id
        )
    );
CREATE POLICY "Employees insert own time logs" ON public.time_logs FOR INSERT
    WITH CHECK (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "Employees update own time logs" ON public.time_logs FOR UPDATE
    USING (auth.uid() = employee_id OR public.is_staff(auth.uid()));
CREATE POLICY "Staff delete time logs" ON public.time_logs FOR DELETE
    USING (public.is_staff(auth.uid()));

-- ===========================================
-- 5. Resource Allocations (employee → project hours)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.resource_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    allocated_hours_per_week NUMERIC(5,1) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'completed', 'paused'
    allocated_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(employee_id, project_id)
);

ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View allocations" ON public.resource_allocations FOR SELECT USING (true);
CREATE POLICY "Staff manage allocations" ON public.resource_allocations FOR INSERT
    WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update allocations" ON public.resource_allocations FOR UPDATE
    USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete allocations" ON public.resource_allocations FOR DELETE
    USING (public.is_staff(auth.uid()));

-- ===========================================
-- 6. Capacity Forecasts
-- ===========================================
CREATE TABLE IF NOT EXISTS public.capacity_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    forecast_period TEXT NOT NULL, -- 'Q1-2026', 'Q2-2026', etc.
    total_demand_hours NUMERIC(10,1) DEFAULT 0,
    total_capacity_hours NUMERIC(10,1) DEFAULT 0,
    deficit_hours NUMERIC(10,1) DEFAULT 0,
    recommended_hires INTEGER DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capacity_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View forecasts" ON public.capacity_forecasts FOR SELECT USING (true);
CREATE POLICY "Staff manage forecasts" ON public.capacity_forecasts FOR INSERT
    WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update forecasts" ON public.capacity_forecasts FOR UPDATE
    USING (public.is_staff(auth.uid()));

-- ===========================================
-- 7. HR Notifications (employee-scoped)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.hr_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    triggered_by UUID REFERENCES public.profiles(id),
    category TEXT NOT NULL,
    -- 'attendance', 'leave', 'appraisal', 'lifecycle', 'time_tracking', 'audit_access', 'resource'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own hr notifications" ON public.hr_notifications FOR SELECT
    USING (auth.uid() = target_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System insert hr notifications" ON public.hr_notifications FOR INSERT
    WITH CHECK (true); -- Triggers will insert
CREATE POLICY "Users update own hr notifications" ON public.hr_notifications FOR UPDATE
    USING (auth.uid() = target_user_id);

-- ===========================================
-- 8. Audit Triggers on HR Tables
-- ===========================================

-- Attendance audit trigger
CREATE OR REPLACE FUNCTION public.log_attendance_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
        VALUES ('attendance', NEW.id, 'created', to_jsonb(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
        VALUES ('attendance', NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER attendance_audit_trigger
    AFTER INSERT OR UPDATE ON public.attendance_logs
    FOR EACH ROW EXECUTE FUNCTION public.log_attendance_changes();

-- Leave request audit trigger
CREATE OR REPLACE FUNCTION public.log_leave_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
        VALUES ('leave_request', NEW.id, 'created', to_jsonb(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, old_values, new_values, user_id,
            metadata)
        VALUES ('leave_request', NEW.id,
            CASE WHEN OLD.status != NEW.status THEN 'status_changed' ELSE 'updated' END,
            to_jsonb(OLD), to_jsonb(NEW), auth.uid(),
            jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leave_audit_trigger
    AFTER INSERT OR UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.log_leave_changes();

-- Appraisal review audit trigger
CREATE OR REPLACE FUNCTION public.log_appraisal_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id)
        VALUES ('appraisal', NEW.id, 'created', to_jsonb(NEW), NEW.reviewer_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER appraisal_audit_trigger
    AFTER INSERT ON public.appraisal_reviews
    FOR EACH ROW EXECUTE FUNCTION public.log_appraisal_changes();

-- Employee history audit trigger
CREATE OR REPLACE FUNCTION public.log_employee_history_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (entity_type, entity_id, action, new_values, user_id,
            metadata)
        VALUES ('employee_lifecycle', NEW.id, NEW.event_type, to_jsonb(NEW), auth.uid(),
            jsonb_build_object('employee_id', NEW.employee_id, 'event_type', NEW.event_type));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER employee_history_audit_trigger
    AFTER INSERT ON public.employee_history
    FOR EACH ROW EXECUTE FUNCTION public.log_employee_history_changes();

-- ===========================================
-- 9. HR Notification Triggers
-- ===========================================

-- Notify manager when leave request submitted
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS TRIGGER AS $$
DECLARE
    mgr_id UUID;
    emp_name TEXT;
BEGIN
    -- Get employee name
    SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.employee_id;

    -- Notify all managers of this employee
    FOR mgr_id IN
        SELECT manager_id FROM public.reporting_lines WHERE employee_id = NEW.employee_id
    LOOP
        INSERT INTO public.hr_notifications (target_user_id, triggered_by, category, title, message, entity_type, entity_id)
        VALUES (mgr_id, NEW.employee_id, 'leave',
            'Leave Request Submitted',
            COALESCE(emp_name, 'An employee') || ' submitted a ' || NEW.leave_type || ' leave request',
            'leave_request', NEW.id);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leave_request_notification
    AFTER INSERT ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_leave_request();

-- Notify employee when leave approved/rejected
CREATE OR REPLACE FUNCTION public.notify_leave_decision()
RETURNS TRIGGER AS $$
DECLARE
    approver_name TEXT;
BEGIN
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
        SELECT full_name INTO approver_name FROM public.profiles WHERE id = NEW.approved_by;

        INSERT INTO public.hr_notifications (target_user_id, triggered_by, category, title, message, entity_type, entity_id)
        VALUES (NEW.employee_id, NEW.approved_by, 'leave',
            'Leave Request ' || initcap(NEW.status),
            'Your ' || NEW.leave_type || ' leave has been ' || NEW.status || ' by ' || COALESCE(approver_name, 'management'),
            'leave_request', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER leave_decision_notification
    AFTER UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_leave_decision();

-- Notify employee when appraisal review submitted
CREATE OR REPLACE FUNCTION public.notify_appraisal_review()
RETURNS TRIGGER AS $$
DECLARE
    reviewer_name TEXT;
BEGIN
    SELECT full_name INTO reviewer_name FROM public.profiles WHERE id = NEW.reviewer_id;

    INSERT INTO public.hr_notifications (target_user_id, triggered_by, category, title, message, entity_type, entity_id)
    VALUES (NEW.employee_id, NEW.reviewer_id, 'appraisal',
        'New Performance Review',
        COALESCE(reviewer_name, 'A reviewer') || ' submitted a ' || NEW.review_type || ' review for you',
        'appraisal', NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER appraisal_review_notification
    AFTER INSERT ON public.appraisal_reviews
    FOR EACH ROW EXECUTE FUNCTION public.notify_appraisal_review();

-- Notify on audit access assignment
CREATE OR REPLACE FUNCTION public.notify_audit_access()
RETURNS TRIGGER AS $$
DECLARE
    mgr_name TEXT;
    emp_name TEXT;
BEGIN
    SELECT full_name INTO mgr_name FROM public.profiles WHERE id = NEW.manager_id;
    SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.employee_id;

    -- Notify manager
    INSERT INTO public.hr_notifications (target_user_id, triggered_by, category, title, message, entity_type, entity_id)
    VALUES (NEW.manager_id, NEW.granted_by, 'audit_access',
        'Audit Access Granted',
        'You now have audit visibility for ' || COALESCE(emp_name, 'an employee'),
        'audit_access', NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_access_notification
    AFTER INSERT ON public.manager_audit_access
    FOR EACH ROW EXECUTE FUNCTION public.notify_audit_access();

-- ===========================================
-- 10. Add HR tables to Supabase Realtime
-- ===========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.reporting_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.manager_audit_access;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appraisal_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_allocations;

-- ===========================================
-- 11. Indexes for performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_reporting_lines_employee ON public.reporting_lines(employee_id);
CREATE INDEX IF NOT EXISTS idx_reporting_lines_manager ON public.reporting_lines(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_audit_employee ON public.manager_audit_access(employee_id);
CREATE INDEX IF NOT EXISTS idx_manager_audit_manager ON public.manager_audit_access(manager_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_employee ON public.time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON public.time_logs(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_employee ON public.resource_allocations(employee_id);
CREATE INDEX IF NOT EXISTS idx_resource_alloc_project ON public.resource_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_hr_notifications_user ON public.hr_notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_hr_notifications_date ON public.hr_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_logs(check_in DESC);

-- ===========================================
-- 12. Enhanced attendance RLS (manager-scoped)
-- ===========================================

-- Drop and recreate attendance view policy to include manager scoping
DROP POLICY IF EXISTS "View attendance" ON public.attendance_logs;
CREATE POLICY "View attendance scoped" ON public.attendance_logs FOR SELECT
    USING (
        auth.uid() = employee_id
        OR public.has_role(auth.uid(), 'admin')
        OR public.is_staff(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.manager_audit_access
            WHERE manager_id = auth.uid() AND employee_id = attendance_logs.employee_id
        )
        OR EXISTS (
            SELECT 1 FROM public.reporting_lines
            WHERE manager_id = auth.uid() AND employee_id = attendance_logs.employee_id
        )
    );

-- Allow employees to insert own attendance (self check-in)
DROP POLICY IF EXISTS "Employees self check-in" ON public.attendance_logs;
CREATE POLICY "Employees self check-in" ON public.attendance_logs FOR INSERT
    WITH CHECK (auth.uid() = employee_id OR public.is_staff(auth.uid()));

-- Allow staff to update attendance
DROP POLICY IF EXISTS "Staff update attendance" ON public.attendance_logs;
CREATE POLICY "Staff update attendance" ON public.attendance_logs FOR UPDATE
    USING (public.is_staff(auth.uid()));

-- Enhanced leave request RLS
DROP POLICY IF EXISTS "View leave requests" ON public.leave_requests;
CREATE POLICY "View leave requests scoped" ON public.leave_requests FOR SELECT
    USING (
        auth.uid() = employee_id
        OR public.has_role(auth.uid(), 'admin')
        OR public.is_staff(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.reporting_lines
            WHERE manager_id = auth.uid() AND employee_id = leave_requests.employee_id
        )
    );

-- Allow any authenticated user to submit leave
DROP POLICY IF EXISTS "Submit leave" ON public.leave_requests;
CREATE POLICY "Submit leave" ON public.leave_requests FOR INSERT
    WITH CHECK (auth.uid() = employee_id);

-- Managers can approve/reject their reports' leave
DROP POLICY IF EXISTS "Staff update leave" ON public.leave_requests;
CREATE POLICY "Staff update leave" ON public.leave_requests FOR UPDATE
    USING (
        public.is_staff(auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
            SELECT 1 FROM public.reporting_lines
            WHERE manager_id = auth.uid() AND employee_id = leave_requests.employee_id
        )
    );

-- Enhanced appraisal RLS (keep existing + add manager scope)
DROP POLICY IF EXISTS "View appraisals" ON public.appraisal_reviews;
CREATE POLICY "View appraisals scoped" ON public.appraisal_reviews FOR SELECT
    USING (
        auth.uid() = employee_id
        OR auth.uid() = reviewer_id
        OR public.has_role(auth.uid(), 'admin')
        OR public.is_staff(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.reporting_lines
            WHERE manager_id = auth.uid() AND employee_id = appraisal_reviews.employee_id
        )
    );

-- Allow authenticated users to submit reviews
DROP POLICY IF EXISTS "Submit review" ON public.appraisal_reviews;
CREATE POLICY "Submit review" ON public.appraisal_reviews FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id);
