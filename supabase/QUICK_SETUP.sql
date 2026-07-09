-- ============================================================================
-- QUICK SETUP - Run this in Supabase SQL Editor
-- ============================================================================
-- This sets up:
-- 1. Your admin account (highypestudio@gmail.com)
-- 2. Role promotion trigger
-- 3. Common designations
-- ============================================================================

-- ============================================================================
-- PART 1: Create designations
-- ============================================================================

-- Sales Executive (admin-level, exceptional case)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'sales_executive',
  'Sales Executive',
  'Sales team executive with vendor and MOU management',
  'admin',
  '{"vendors": {"view": true, "create": true, "edit": true, "delete": true}, "mous": {"view": true, "create": true, "edit": true, "delete": true}, "issues": {"view": true, "create": true, "edit": true, "delete": false}, "projects": {"view": true, "create": true, "manage": true}, "analytics": {"view": true, "export": true}, "finance": {"view": true, "manage_payments": true, "view_reports": true}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- HR Manager (manager-level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'hr_manager',
  'HR Manager',
  'Human Resources Manager with full HR module access',
  'manager',
  '{"hr": {"view": true, "manage": true, "approve_leave": true, "manage_appraisals": true, "view_attendance": true, "manage_lifecycle": true, "view_performance": true}, "users": {"view": true, "manage": true, "approve": true}, "roles": {"view": true, "assign": true, "create": true}, "departments": {"view": true, "manage": true}, "vendors": {"view": true, "create": false, "edit": false, "delete": false}, "issues": {"view": true, "create": true, "edit": true, "delete": false}, "analytics": {"view": true, "export": true}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- Finance Manager (manager-level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'finance_manager',
  'Finance Manager',
  'Finance department manager with full finance access',
  'manager',
  '{"finance": {"view": true, "manage": true, "create_entries": true, "post_entries": true, "view_reports": true, "manage_payments": true}, "vendors": {"view": true, "create": false, "edit": false, "delete": false}, "analytics": {"view": true, "export": true}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Accountant (employee-level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'accountant',
  'Accountant',
  'Accounting staff with entry creation and reporting access',
  'employee',
  '{"finance": {"view": true, "create_entries": true, "view_reports": true}, "vendors": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Department Manager (manager-level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'department_manager',
  'Department Manager',
  'Department manager with team oversight',
  'manager',
  '{"vendors": {"view": true, "create": true, "edit": true, "delete": false}, "issues": {"view": true, "create": true, "edit": true, "delete": false}, "mous": {"view": true, "create": true, "edit": true, "delete": false}, "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true}, "projects": {"view": true, "create": true, "manage": true}, "analytics": {"view": true, "export": false}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- Team Lead (manager-level)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'team_lead',
  'Team Lead',
  'Team lead with project and team management',
  'manager',
  '{"vendors": {"view": true, "create": false, "edit": false, "delete": false}, "issues": {"view": true, "create": true, "edit": true, "delete": false}, "projects": {"view": true, "create": true, "manage": true}, "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true}, "analytics": {"view": true, "export": false}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;

-- ============================================================================
-- PART 2: Setup admin account
-- ============================================================================

UPDATE profiles SET
  full_name = 'Al-Syed A.',
  main_role = 'admin',
  designation = 'Sales Executive',
  is_approved = true,
  approval_status = 'approved',
  admin_approved_by = id,
  admin_approved_at = NOW(),
  hr_approved_by = id,
  hr_approved_at = NOW()
WHERE email = 'highypestudio@gmail.com';

-- Assign Sales Executive designation
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
-- PART 3: Create role promotion trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_main_role_from_designation()
RETURNS TRIGGER AS $$
DECLARE
  designation_main_role VARCHAR(50);
  user_current_role VARCHAR(50);
BEGIN
  -- Get the main_role from the custom_roles table
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
    
    RAISE NOTICE 'User % promoted from employee to manager', NEW.user_id;
  END IF;
  
  -- If designation requires employee role and user is currently manager, demote them
  IF designation_main_role = 'employee' AND user_current_role = 'manager' THEN
    UPDATE profiles
    SET main_role = 'employee'
    WHERE id = NEW.user_id;
    
    RAISE NOTICE 'User % demoted from manager to employee', NEW.user_id;
  END IF;
  
  -- Update the designation display name in profiles
  UPDATE profiles
  SET designation = (SELECT display_name FROM custom_roles WHERE id = NEW.role_id)
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sync_main_role_on_designation_assignment ON role_assignments;
CREATE TRIGGER sync_main_role_on_designation_assignment
  AFTER INSERT ON role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_main_role_from_designation();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT '✅ SETUP COMPLETE' as status;

-- Check admin account
SELECT 
  '=== ADMIN ACCOUNT ===' as section,
  email,
  full_name,
  main_role,
  designation,
  is_approved
FROM profiles
WHERE email = 'highypestudio@gmail.com';

-- Check designations
SELECT 
  '=== DESIGNATIONS ===' as section,
  display_name,
  main_role,
  (SELECT COUNT(*) FROM role_assignments WHERE role_id = custom_roles.id) as users_assigned
FROM custom_roles
ORDER BY main_role, display_name;

SELECT 'Please refresh your browser and re-login' as next_step;

