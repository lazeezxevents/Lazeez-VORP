-- ============================================================================
-- Admin Setup and Automatic Role Promotion System
-- Version: 1.0
-- Date: March 26, 2026
-- Description: Sets up admin account and implements automatic role promotion
-- ============================================================================

-- ============================================================================
-- PART 1: Create Sales Executive designation (exceptional - admin level)
-- ============================================================================

INSERT INTO custom_roles (
  name, 
  display_name, 
  description, 
  main_role, 
  permissions, 
  is_system_role
) VALUES (
  'sales_executive',
  'Sales Executive',
  'Sales team executive with vendor and MOU management (can be assigned to admin)',
  'admin',  -- Exceptional: admin-level designation
  '{
    "vendors": {"view": true, "create": true, "edit": true, "delete": true},
    "mous": {"view": true, "create": true, "edit": true, "delete": true},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "projects": {"view": true, "create": true, "manage": true},
    "analytics": {"view": true, "export": true},
    "finance": {"view": true, "manage_payments": true, "view_reports": true}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- ============================================================================
-- PART 2: Create HR Manager designation (manager level)
-- ============================================================================

INSERT INTO custom_roles (
  name, 
  display_name, 
  description, 
  main_role, 
  permissions, 
  is_system_role
) VALUES (
  'hr_manager',
  'HR Manager',
  'Human Resources Manager with full HR module access',
  'manager',
  '{
    "hr": {"view": true, "manage": true, "approve_leave": true, "manage_appraisals": true, "view_attendance": true, "manage_lifecycle": true, "view_performance": true},
    "users": {"view": true, "manage": true, "approve": true},
    "roles": {"view": true, "assign": true, "create": true},
    "departments": {"view": true, "manage": true},
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "analytics": {"view": true, "export": true}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- ============================================================================
-- PART 3: Setup admin account (highypestudio@gmail.com)
-- ============================================================================

-- Update profile with admin role and full name
UPDATE profiles SET
  full_name = 'Al-Syed A.',
  main_role = 'admin',
  designation = 'Sales Executive',
  is_approved = true,
  approval_status = 'approved',
  admin_approved_by = id,  -- Self-approved
  admin_approved_at = NOW(),
  hr_approved_by = id,     -- Self-approved
  hr_approved_at = NOW()
WHERE email = 'highypestudio@gmail.com';

-- Assign Sales Executive designation to admin
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT 
  p.id as user_id,
  cr.id as role_id,
  p.id as assigned_by
FROM profiles p
CROSS JOIN custom_roles cr
WHERE p.email = 'highypestudio@gmail.com'
  AND cr.name = 'sales_executive'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- PART 4: Automatic Role Promotion System
-- ============================================================================

-- Function to automatically promote employee to manager when assigned manager designation
CREATE OR REPLACE FUNCTION sync_main_role_from_designation()
RETURNS TRIGGER AS $$
DECLARE
  designation_main_role VARCHAR(50);
  user_current_role VARCHAR(50);
BEGIN
  -- Get the main_role from the custom_roles table for the assigned designation
  SELECT main_role INTO designation_main_role
  FROM custom_roles
  WHERE id = NEW.role_id;
  
  -- Get the user's current main_role
  SELECT main_role INTO user_current_role
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- If designation requires manager role and user is currently employee, promote them
  IF designation_main_role = 'manager' AND user_current_role = 'employee' THEN
    UPDATE profiles
    SET main_role = 'manager'
    WHERE id = NEW.user_id;
    
    RAISE NOTICE 'User % promoted from employee to manager due to manager designation assignment', NEW.user_id;
  END IF;
  
  -- Update the designation display name in profiles
  UPDATE profiles
  SET designation = (SELECT display_name FROM custom_roles WHERE id = NEW.role_id)
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic role promotion
DROP TRIGGER IF EXISTS sync_main_role_on_designation_assignment ON role_assignments;
CREATE TRIGGER sync_main_role_on_designation_assignment
  AFTER INSERT ON role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_main_role_from_designation();

-- ============================================================================
-- PART 5: Create additional common designations
-- ============================================================================

-- Finance Manager (manager level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'finance_manager',
  'Finance Manager',
  'Finance department manager with full finance access',
  'manager',
  '{
    "finance": {"view": true, "manage": true, "create_entries": true, "post_entries": true, "view_reports": true, "manage_payments": true},
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "analytics": {"view": true, "export": true}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Accountant (employee level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'accountant',
  'Accountant',
  'Accounting staff with entry creation and reporting access',
  'employee',
  '{
    "finance": {"view": true, "create_entries": true, "view_reports": true},
    "vendors": {"view": true, "create": false, "edit": false, "delete": false}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Department Manager (manager level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'department_manager',
  'Department Manager',
  'Department manager with team oversight',
  'manager',
  '{
    "vendors": {"view": true, "create": true, "edit": true, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "mous": {"view": true, "create": true, "edit": true, "delete": false},
    "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
    "projects": {"view": true, "create": true, "manage": true},
    "analytics": {"view": true, "export": false}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Team Lead (manager level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'team_lead',
  'Team Lead',
  'Team lead with project and team management',
  'manager',
  '{
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "projects": {"view": true, "create": true, "manage": true},
    "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
    "analytics": {"view": true, "export": false}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- ============================================================================
-- PART 6: Verification
-- ============================================================================

DO $
DECLARE
  admin_count INTEGER;
  role_count INTEGER;
  assignment_count INTEGER;
BEGIN
  -- Check admin account
  SELECT COUNT(*) INTO admin_count
  FROM profiles
  WHERE email = 'highypestudio@gmail.com'
    AND main_role = 'admin'
    AND full_name = 'Al-Syed A.'
    AND is_approved = true;
  
  -- Check roles created
  SELECT COUNT(*) INTO role_count
  FROM custom_roles
  WHERE name IN ('sales_executive', 'hr_manager', 'finance_manager', 'accountant', 'department_manager', 'team_lead');
  
  -- Check role assignment
  SELECT COUNT(*) INTO assignment_count
  FROM role_assignments ra
  JOIN profiles p ON p.id = ra.user_id
  JOIN custom_roles cr ON cr.id = ra.role_id
  WHERE p.email = 'highypestudio@gmail.com'
    AND cr.name = 'sales_executive';
  
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE 'Admin account setup: % (expected: 1)', admin_count;
  RAISE NOTICE 'Designations created: % (expected: 6)', role_count;
  RAISE NOTICE 'Admin role assignment: % (expected: 1)', assignment_count;
  RAISE NOTICE 'Automatic role promotion trigger: CREATED';
  
  IF admin_count = 0 THEN
    RAISE WARNING 'Admin account not found - user may need to sign up first';
  END IF;
END $;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION sync_main_role_from_designation IS 'Automatically promotes employee to manager when assigned a manager-level designation';
COMMENT ON TRIGGER sync_main_role_on_designation_assignment ON role_assignments IS 'Triggers automatic role promotion when designation is assigned';

