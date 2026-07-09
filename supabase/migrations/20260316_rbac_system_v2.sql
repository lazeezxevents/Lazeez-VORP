-- RBAC System Migration V2
-- Creates custom roles (designations), role assignments, and permission system
-- This migration implements a two-layer role system:
-- Layer 1: main_role (admin, manager, employee) - base access level
-- Layer 2: designation (custom_roles) - granular permissions based on job role

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add role-related columns to profiles if they don't exist
DO $$ 
BEGIN
  -- Add main_role column (admin, manager, employee)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='main_role') THEN
    ALTER TABLE profiles ADD COLUMN main_role VARCHAR(50) DEFAULT 'employee';
  END IF;
  
  -- Add designation column (links to custom_roles)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='designation') THEN
    ALTER TABLE profiles ADD COLUMN designation VARCHAR(100);
  END IF;
  
  -- Add department_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='department_id') THEN
    ALTER TABLE profiles ADD COLUMN department_id UUID;
  END IF;
  
  -- Add is_approved column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='is_approved') THEN
    ALTER TABLE profiles ADD COLUMN is_approved BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Custom Roles Table (Role-Designations with permissions)
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  main_role VARCHAR(50) NOT NULL DEFAULT 'employee',
  -- Values: 'admin', 'manager', 'employee'
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role Assignments Table (must be created AFTER custom_roles)
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_main_role ON custom_roles(main_role);
CREATE INDEX IF NOT EXISTS idx_profiles_main_role ON profiles(main_role);

-- Insert System Roles (Role-Designations)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role) VALUES
-- Admin Roles
('system_admin', 'System Administrator', 'Full system access with all permissions', 'admin', '{
  "vendors": {"view": true, "create": true, "edit": true, "delete": true},
  "issues": {"view": true, "create": true, "edit": true, "delete": true},
  "mous": {"view": true, "create": true, "edit": true, "delete": true},
  "hr": {"view_all": true, "manage_employees": true, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
  "finance": {"view": true, "manage_payments": true, "view_reports": true},
  "projects": {"view": true, "create": true, "manage": true},
  "analytics": {"view": true, "export": true},
  "admin": {"manage_users": true, "manage_roles": true, "system_settings": true}
}', true),

-- Manager Roles
('hr_manager', 'HR Manager', 'Human Resources management with employee oversight', 'manager', '{
  "vendors": {"view": true, "create": false, "edit": false, "delete": false},
  "issues": {"view": true, "create": true, "edit": true, "delete": false},
  "mous": {"view": true, "create": false, "edit": false, "delete": false},
  "hr": {"view_all": true, "manage_employees": true, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
  "finance": {"view": false, "manage_payments": false, "view_reports": false},
  "projects": {"view": true, "create": false, "manage": false},
  "analytics": {"view": true, "export": true},
  "admin": {"manage_users": false, "manage_roles": true, "system_settings": false}
}', true),

('department_manager', 'Department Manager', 'Department manager with team oversight', 'manager', '{
  "vendors": {"view": true, "create": true, "edit": true, "delete": false},
  "issues": {"view": true, "create": true, "edit": true, "delete": false},
  "mous": {"view": true, "create": true, "edit": true, "delete": false},
  "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
  "finance": {"view": false, "manage_payments": false, "view_reports": false},
  "projects": {"view": true, "create": true, "manage": true},
  "analytics": {"view": true, "export": false},
  "admin": {"manage_users": false, "manage_roles": false, "system_settings": false}
}', true),

('vendor_manager', 'Vendor Manager', 'Vendor operations and MOU management', 'manager', '{
  "vendors": {"view": true, "create": true, "edit": true, "delete": true},
  "issues": {"view": true, "create": true, "edit": true, "delete": false},
  "mous": {"view": true, "create": true, "edit": true, "delete": false},
  "hr": {"view_all": false, "manage_employees": false, "manage_attendance": false, "manage_leave": false, "manage_appraisals": false},
  "finance": {"view": true, "manage_payments": true, "view_reports": true},
  "projects": {"view": true, "create": false, "manage": false},
  "analytics": {"view": true, "export": true},
  "admin": {"manage_users": false, "manage_roles": false, "system_settings": false}
}', true),

-- Employee Roles
('standard_employee', 'Employee', 'Standard employee with self-service access', 'employee', '{
  "vendors": {"view": true, "create": false, "edit": false, "delete": false},
  "issues": {"view": true, "create": true, "edit": false, "delete": false},
  "mous": {"view": true, "create": false, "edit": false, "delete": false},
  "hr": {"view_all": false, "manage_employees": false, "manage_attendance": false, "manage_leave": false, "manage_appraisals": false},
  "finance": {"view": false, "manage_payments": false, "view_reports": false},
  "projects": {"view": true, "create": false, "manage": false},
  "analytics": {"view": false, "export": false},
  "admin": {"manage_users": false, "manage_roles": false, "system_settings": false}
}', true),

('senior_employee', 'Senior Employee', 'Senior employee with extended access', 'employee', '{
  "vendors": {"view": true, "create": true, "edit": false, "delete": false},
  "issues": {"view": true, "create": true, "edit": true, "delete": false},
  "mous": {"view": true, "create": false, "edit": false, "delete": false},
  "hr": {"view_all": false, "manage_employees": false, "manage_attendance": false, "manage_leave": false, "manage_appraisals": false},
  "finance": {"view": false, "manage_payments": false, "view_reports": false},
  "projects": {"view": true, "create": true, "manage": false},
  "analytics": {"view": true, "export": false},
  "admin": {"manage_users": false, "manage_roles": false, "system_settings": false}
}', true)
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_roles

-- All authenticated users can view roles
CREATE POLICY "Anyone can view roles"
ON custom_roles FOR SELECT
TO authenticated
USING (true);

-- Only HR and Admin can create roles
CREATE POLICY "HR and Admin can create roles"
ON custom_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Only HR and Admin can update non-system roles
CREATE POLICY "HR and Admin can update roles"
ON custom_roles FOR UPDATE
TO authenticated
USING (
  is_system_role = false AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
)
WITH CHECK (
  is_system_role = false AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Only Admin can delete non-system roles
CREATE POLICY "Admin can delete roles"
ON custom_roles FOR DELETE
TO authenticated
USING (
  is_system_role = false AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role = 'admin'
  )
);

-- RLS Policies for role_assignments

-- Users can view their own role assignments
CREATE POLICY "Users can view own assignments"
ON role_assignments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- HR and Admin can view all assignments
CREATE POLICY "HR and Admin can view all assignments"
ON role_assignments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Only HR and Admin can assign roles
CREATE POLICY "HR and Admin can assign roles"
ON role_assignments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Only HR and Admin can update role assignments
CREATE POLICY "HR and Admin can update assignments"
ON role_assignments FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Only HR and Admin can delete role assignments
CREATE POLICY "HR and Admin can delete assignments"
ON role_assignments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_permissions JSONB := '{}';
  role_perms JSONB;
BEGIN
  -- Aggregate all permissions from assigned roles
  SELECT COALESCE(jsonb_object_agg(key, value), '{}')
  INTO user_permissions
  FROM (
    SELECT key, value
    FROM role_assignments ra
    JOIN custom_roles cr ON ra.role_id = cr.id
    CROSS JOIN LATERAL jsonb_each(cr.permissions)
    WHERE ra.user_id = user_uuid
  ) AS perms;
  
  RETURN user_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, permission_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  parts TEXT[];
  category TEXT;
  action TEXT;
  user_perms JSONB;
BEGIN
  -- Split permission path (e.g., 'vendors.create')
  parts := string_to_array(permission_path, '.');
  IF array_length(parts, 1) != 2 THEN
    RETURN false;
  END IF;
  
  category := parts[1];
  action := parts[2];
  
  -- Get user permissions
  user_perms := get_user_permissions(user_uuid);
  
  -- Check if permission exists and is true
  RETURN COALESCE((user_perms->category->>action)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to custom_roles
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON custom_roles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE custom_roles IS 'Stores custom role-designations with granular permissions. main_role determines base access level (admin/manager/employee)';
COMMENT ON TABLE role_assignments IS 'Maps users to their assigned role-designations';
COMMENT ON COLUMN custom_roles.main_role IS 'Base role level: admin, manager, or employee';
COMMENT ON COLUMN profiles.main_role IS 'User main role: admin, manager, or employee';
COMMENT ON COLUMN profiles.designation IS 'User designation (links to custom_roles.display_name)';
COMMENT ON FUNCTION get_u