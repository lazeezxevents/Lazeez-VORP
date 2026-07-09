-- ============================================================================
-- IMMEDIATE FIX - Run this in Supabase SQL Editor
-- ============================================================================
-- This script fixes your immediate issues:
-- 1. Sets your full name to "Al-Syed A." (fixes "User" display)
-- 2. Sets your role to manager (fixes HR access)
-- 3. Creates HR Manager designation
-- 4. Assigns HR Manager to you
-- ============================================================================

-- ============================================================================
-- FIX 1: Update your profile with correct data
-- ============================================================================

-- Replace 'your-email@example.com' with your actual email
UPDATE profiles 
SET 
  full_name = 'Al-Syed A.',
  main_role = 'manager',
  designation = 'HR Manager',
  is_approved = true,
  approval_status = 'approved'
WHERE email = 'your-email@example.com';  -- CHANGE THIS TO YOUR EMAIL

-- Verify the update worked
SELECT 
  'Profile Updated' as status,
  id,
  email,
  full_name,
  main_role,
  designation,
  is_approved
FROM profiles
WHERE email = 'your-email@example.com';  -- CHANGE THIS TO YOUR EMAIL

-- ============================================================================
-- FIX 2: Create HR Manager designation (if it doesn't exist)
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
    "hr": {
      "view": true,
      "manage": true,
      "approve_leave": true,
      "manage_appraisals": true,
      "view_attendance": true,
      "manage_lifecycle": true,
      "view_performance": true
    },
    "users": {
      "view": true,
      "manage": true,
      "approve": true
    },
    "roles": {
      "view": true,
      "assign": true,
      "create": true
    },
    "departments": {
      "view": true,
      "manage": true
    }
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role,
  display_name = EXCLUDED.display_name;

-- Verify HR Manager role was created
SELECT 
  'HR Manager Role Created' as status,
  id,
  name,
  display_name,
  main_role,
  permissions
FROM custom_roles
WHERE name = 'hr_manager';

-- ============================================================================
-- FIX 3: Assign HR Manager designation to you
-- ============================================================================

-- Replace 'your-email@example.com' with your actual email
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT 
  p.id as user_id,
  cr.id as role_id,
  p.id as assigned_by
FROM profiles p
CROSS JOIN custom_roles cr
WHERE p.email = 'your-email@example.com'  -- CHANGE THIS TO YOUR EMAIL
  AND cr.name = 'hr_manager'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Verify role assignment
SELECT 
  'Role Assignment Complete' as status,
  p.email,
  p.full_name,
  p.main_role,
  cr.display_name as assigned_designation,
  cr.permissions
FROM profiles p
JOIN role_assignments ra ON ra.user_id = p.id
JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.email = 'your-email@example.com';  -- CHANGE THIS TO YOUR EMAIL

-- ============================================================================
-- FIX 4: Create other common designations
-- ============================================================================

-- Sales Executive (can be assigned to admin or employee)
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'sales_executive',
  'Sales Executive',
  'Sales team member with vendor and MOU management',
  'employee',
  '{
    "vendors": {"view": true, "create": true, "edit": true, "manage_payments": true},
    "mous": {"view": true, "create": true, "edit": true},
    "issues": {"view": true, "create": true, "edit": true}
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Finance Manager
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'finance_manager',
  'Finance Manager',
  'Finance department manager with full finance access',
  'manager',
  '{
    "finance": {
      "view": true, "manage": true, "create_entries": true,
      "post_entries": true, "view_reports": true, "manage_payments": true
    }
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Accountant
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'accountant',
  'Accountant',
  'Accounting staff with entry creation and reporting access',
  'employee',
  '{
    "finance": {
      "view": true, "create_entries": true, "view_reports": true
    }
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all designations
SELECT 
  '=== ALL DESIGNATIONS ===' as section,
  display_name,
  main_role,
  (SELECT COUNT(*) FROM role_assignments WHERE role_id = custom_roles.id) as users_assigned
FROM custom_roles
ORDER BY main_role, display_name;

-- Check your complete profile
SELECT 
  '=== YOUR COMPLETE PROFILE ===' as section,
  p.email,
  p.full_name,
  p.main_role,
  p.designation,
  p.is_approved,
  p.department_id,
  p.manager_id,
  COALESCE(
    (SELECT string_agg(cr.display_name, ', ')
     FROM role_assignments ra
     JOIN custom_roles cr ON cr.id = ra.role_id
     WHERE ra.user_id = p.id),
    'No designations assigned'
  ) as all_designations
FROM profiles p
WHERE p.email = 'your-email@example.com';  -- CHANGE THIS TO YOUR EMAIL

-- Test get_user_info function
SELECT 
  '=== get_user_info() TEST ===' as section,
  get_user_info(
    (SELECT id FROM profiles WHERE email = 'your-email@example.com')  -- CHANGE THIS
  ) as user_info;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
  '✅ IMMEDIATE FIX COMPLETE' as status,
  'Your profile has been updated' as message,
  'You should now see "Al-Syed A." instead of "User"' as result,
  'HR Manager role has been assigned' as role_status,
  'Please refresh your browser and re-login' as next_step;
