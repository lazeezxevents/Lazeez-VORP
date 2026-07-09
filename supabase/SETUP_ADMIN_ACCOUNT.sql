-- ============================================================================
-- QUICK ADMIN ACCOUNT SETUP
-- Run this in Supabase SQL Editor to set up your admin account
-- ============================================================================

-- Step 1: Update your profile
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

-- Step 2: Create Sales Executive designation (if not exists)
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
  'Sales team executive with vendor and MOU management',
  'admin',
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
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- Step 3: Assign Sales Executive to your account
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

-- Step 4: Create HR Manager designation (for future use)
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
  main_role = EXCLUDED.main_role,
  permissions = EXCLUDED.permissions;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check your profile
SELECT 
  '=== YOUR ADMIN ACCOUNT ===' as section,
  email,
  full_name,
  main_role,
  designation,
  is_approved,
  approval_status
FROM profiles
WHERE email = 'highypestudio@gmail.com';

-- Check your role assignment
SELECT 
  '=== YOUR DESIGNATION ===' as section,
  p.email,
  cr.display_name as designation,
  cr.main_role as designation_main_role,
  cr.permissions
FROM profiles p
JOIN role_assignments ra ON ra.user_id = p.id
JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.email = 'highypestudio@gmail.com';

-- Check all available designations
SELECT 
  '=== ALL DESIGNATIONS ===' as section,
  display_name,
  main_role,
  (SELECT COUNT(*) FROM role_assignments WHERE role_id = custom_roles.id) as users_assigned
FROM custom_roles
ORDER BY main_role, display_name;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
  '✅ ADMIN ACCOUNT SETUP COMPLETE' as status,
  'Email: highypestudio@gmail.com' as account,
  'Name: Al-Syed A.' as name,
  'Role: admin' as role,
  'Designation: Sales Executive' as designation,
  'Please refresh your browser and re-login' as next_step;

