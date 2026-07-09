-- RBAC & Onboarding Complete Migration (Fixed)
-- This migration adds all RBAC and onboarding features
-- Run AFTER existing migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Add all profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS main_role VARCHAR(50) DEFAULT 'employee';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_type VARCHAR(20) DEFAULT 'self_signup';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id);

-- Step 2: Create custom_roles table
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

-- Step 3: Create role_assignments table
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Step 4: Create employee_invitations table
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

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_main_role ON custom_roles(main_role);
CREATE INDEX IF NOT EXISTS idx_profiles_main_role ON profiles(main_role);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);

