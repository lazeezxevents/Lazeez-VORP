-- Complete RBAC & Onboarding System Migration
-- Consolidated migration that handles all dependencies correctly
-- Run this AFTER all existing migrations

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PART 1: Add columns to profiles table
-- ============================================================================

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

  -- Add approval columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='approval_status') THEN
    ALTER TABLE profiles ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='rejection_reason') THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='onboarding_type') THEN
    ALTER TABLE profiles ADD COLUMN onboarding_type VARCHAR(20) DEFAULT 'self_signup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='manager_id') THEN
    ALTER TABLE profiles ADD COLUMN manager_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN profiles.approval_status IS 'Values: pending, admin_approved, hr_approved, rejected';
COMMENT ON COLUMN profiles.onboarding_type IS 'Values: self_signup, hr_invitation';
COMMENT ON COLUMN profiles.main_role IS 'User main role: admin, manager, or employee';
COMMENT ON COLUMN profiles.designation IS 'User designation (links to custom_roles.display_name)';

-- ============================================================================
-- PART 2: Create custom_roles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  main_role VARCHAR(50) NOT NULL DEFAULT 'employee',
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PART 3: Create role_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ============================================================================
-- PART 4: Create employee_invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS employee_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role_id UUID REFERENCES custom_roles(id),
  department_id UUID REFERENCES departments(id),
  team_id UUID,
  manager_id UUID REFERENCES profiles(id),
  secondary_manager_id UUID REFERENCES profiles(id),
  start_date DATE,
  employment_type VARCHAR(50) DEFAULT 'full_time',
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- PART 5: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_main_role ON custom_roles(main_role);
CREATE INDEX IF NOT EXISTS idx_profiles_main_role ON profiles(main_role);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);

-- ============================================================================
-- PART 6: Insert system roles
-- ============================================================================

INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role) VALUES
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

