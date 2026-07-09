-- ============================================================================
-- Custom Roles and Permissions System
-- ============================================================================

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS public.app_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.app_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- 4. Update profiles to link to custom roles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 5. Enable RLS
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (safe: drop if exists then create)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view permissions" ON public.app_permissions;
  CREATE POLICY "Everyone can view permissions" ON public.app_permissions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage custom roles" ON public.custom_roles;
  CREATE POLICY "Admins can manage custom roles" ON public.custom_roles
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view custom roles" ON public.custom_roles;
  CREATE POLICY "Everyone can view custom roles" ON public.custom_roles
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
  CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.role_permissions;
  CREATE POLICY "Everyone can view role permissions" ON public.role_permissions
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. Insert Initial Permissions (expanded set)
INSERT INTO public.app_permissions (name, slug, module, description) VALUES
  ('View Dashboard', 'dashboard.view', 'general', 'Access to main dashboard'),
  ('View Settings', 'settings.view', 'general', 'Access settings page'),
  ('Manage Settings', 'settings.manage', 'general', 'Modify system settings'),
  ('View Vendors', 'vendors.view', 'vendors', 'View vendor list and details'),
  ('Manage Vendors', 'vendors.manage', 'vendors', 'Create, edit, and delete vendors'),
  ('Manage Vendor Documents', 'vendors.documents', 'vendors', 'Upload and manage vendor docs'),
  ('Manage Vendor Payments', 'vendors.payments', 'vendors', 'Track vendor payments'),
  ('View Issues', 'issues.view', 'issues', 'View issue tracking system'),
  ('Manage Issues', 'issues.manage', 'issues', 'Create and update issues'),
  ('Assign Issues', 'issues.assign', 'issues', 'Assign issues to team members'),
  ('Resolve Issues', 'issues.resolve', 'issues', 'Mark issues as resolved'),
  ('View MOUs', 'mous.view', 'mous', 'View MOU list'),
  ('Manage MOUs', 'mous.manage', 'mous', 'Create and edit MOUs'),
  ('Approve MOUs', 'mous.approve', 'mous', 'Approve pending MOUs'),
  ('Access MOU Vault', 'mous.vault', 'mous', 'Access contract vault'),
  ('View HR Dashboard', 'hr.view', 'hr', 'Access to HR Performance dashboard'),
  ('Manage Team', 'team.manage', 'hr', 'Manage employees and roles'),
  ('Manage Designations', 'designations.manage', 'hr', 'Create and delete designations'),
  ('Assign Vendors', 'assignments.manage', 'hr', 'Assign vendors to employees'),
  ('Manage Departments', 'departments.manage', 'hr', 'Create departments'),
  ('View Analytics', 'analytics.view', 'analytics', 'Access analytics dashboard'),
  ('Export Reports', 'analytics.export', 'analytics', 'Export data as reports'),
  ('View Audit Logs', 'audit.view', 'analytics', 'Access system audit trail'),
  ('Manage Notifications', 'notifications.manage', 'comms', 'Configure notifications'),
  ('View Calendar', 'calendar.view', 'comms', 'Access event calendar'),
  ('Manage Calendar', 'calendar.manage', 'comms', 'Create and edit events')
ON CONFLICT (slug) DO NOTHING;
