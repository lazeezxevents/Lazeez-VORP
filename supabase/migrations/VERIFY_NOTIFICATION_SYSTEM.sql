-- ============================================================================
-- NOTIFICATION SYSTEM VERIFICATION SCRIPT
-- Run this after applying migrations to verify everything works
-- ============================================================================

-- ============================================================================
-- SECTION 1: SYSTEM HEALTH CHECK
-- ============================================================================

-- Check 1: Verify all required tables exist
SELECT 
  'Tables Check' as check_type,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing tables'
  END as status,
  COUNT(*)::text || ' of 4 tables found' as details
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations', 'notifications');

-- Check 2: Verify helper functions exist
SELECT 
  'Helper Functions' as check_type,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing functions'
  END as status,
  COUNT(*)::text || ' functions found' as details
FROM pg_proc
WHERE proname IN (
  'get_user_info',
  'notify_users',
  'get_admin_ids',
  'get_manager_ids',
  'is_admin_or_manager',
  'is_admin'
);

-- Check 3: Verify notification triggers
SELECT 
  'Notification Triggers' as check_type,
  CASE 
    WHEN COUNT(*) >= 8 THEN '✅ PASS'
    ELSE '⚠️  WARNING - Some triggers missing'
  END as status,
  COUNT(*)::text || ' triggers found' as details
FROM pg_trigger
WHERE tgname LIKE '%notification%';

-- Check 4: Check for infinite recursion in policies
SELECT 
  'RLS Policies' as check_type,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS - No recursion detected'
    ELSE '❌ FAIL - Recursion detected'
  END as status,
  'Checking profiles policies' as details
FROM pg_policies
WHERE tablename = 'profiles'
AND policyname = 'HR and Admin can view all profiles'
AND qual LIKE '%SELECT%profiles%profiles%';

-- ============================================================================
-- SECTION 2: USER PROFILE CHECK
-- ============================================================================

-- Check your profile data
SELECT 
  '=== YOUR PROFILE DATA ===' as section,
  '' as blank1,
  'ID: ' || id::text as user_id,
  'Email: ' || COALESCE(email, 'NOT SET') as email,
  'Full Name: ' || COALESCE(full_name, '❌ NOT SET - This causes "User" display') as full_name,
  'Avatar URL: ' || COALESCE(avatar_url, '❌ NOT SET - No avatar will show') as avatar,
  'Main Role: ' || COALESCE(main_role, '❌ NOT SET') as main_role,
  'Designation: ' || COALESCE(designation, '❌ NOT SET') as designation,
  'Approved: ' || COALESCE(is_approved::text, 'false') as is_approved,
  'Approval Status: ' || COALESCE(approval_status, 'pending') as approval_status
FROM profiles
WHERE id = auth.uid();

-- ============================================================================
-- SECTION 3: ROLE ASSIGNMENTS CHECK
-- ============================================================================

-- Check your role assignments
SELECT 
  '=== YOUR ROLE ASSIGNMENTS ===' as section,
  '' as blank1,
  'Main Role: ' || p.main_role as layer_1_role,
  'Designation: ' || COALESCE(cr.display_name, '❌ NO DESIGNATION ASSIGNED') as layer_2_designation,
  'Role Name: ' || COALESCE(cr.name, 'N/A') as role_name,
  'Permissions: ' || COALESCE(cr.permissions::text, '{}') as permissions
FROM profiles p
LEFT JOIN role_assignments ra ON ra.user_id = p.id
LEFT JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.id = auth.uid();

-- ============================================================================
-- SECTION 4: TEST get_user_info FUNCTION
-- ============================================================================

-- Test the notification helper function
SELECT 
  '=== get_user_info() TEST ===' as section,
  '' as blank1,
  CASE 
    WHEN get_user_info(auth.uid()) IS NULL THEN '❌ FAIL - Function returned NULL'
    WHEN get_user_info(auth.uid()) = '{}'::jsonb THEN '❌ FAIL - Function returned empty object'
    WHEN get_user_info(auth.uid())->>'full_name' IS NULL THEN '❌ FAIL - full_name is NULL'
    ELSE '✅ PASS - Function working correctly'
  END as status,
  get_user_info(auth.uid())::text as function_output;

-- ============================================================================
-- SECTION 5: RECENT NOTIFICATIONS CHECK
-- ============================================================================

-- Check recent notifications
SELECT 
  '=== RECENT NOTIFICATIONS ===' as section,
  '' as blank1,
  'Total Notifications: ' || COUNT(*)::text as total_count,
  'Unread: ' || SUM(CASE WHEN NOT read THEN 1 ELSE 0 END)::text as unread_count,
  'With Metadata: ' || SUM(CASE WHEN metadata != '{}'::jsonb THEN 1 ELSE 0 END)::text as with_metadata
FROM notifications
WHERE user_id = auth.uid();

-- Show last 5 notifications with creator info
SELECT 
  '=== LAST 5 NOTIFICATIONS ===' as section,
  '' as blank1,
  n.title,
  n.message,
  n.category,
  n.type,
  COALESCE(p.full_name, '❌ Creator name missing') as created_by_name,
  n.metadata->>'avatar_url' as creator_avatar,
  n.created_at::text as created_at
FROM notifications n
LEFT JOIN profiles p ON p.id = n.created_by
WHERE n.user_id = auth.uid()
ORDER BY n.created_at DESC
LIMIT 5;

-- ============================================================================
-- SECTION 6: AVAILABLE DESIGNATIONS
-- ============================================================================

-- List all available designations
SELECT 
  '=== AVAILABLE DESIGNATIONS ===' as section,
  '' as blank1,
  cr.display_name,
  cr.main_role as layer_1_role,
  cr.description,
  (SELECT COUNT(*) FROM role_assignments WHERE role_id = cr.id)::text || ' users' as assigned_count
FROM custom_roles cr
ORDER BY cr.main_role, cr.display_name;

-- ============================================================================
-- SECTION 7: NOTIFICATION TRIGGERS LIST
-- ============================================================================

-- List all notification triggers
SELECT 
  '=== NOTIFICATION TRIGGERS ===' as section,
  '' as blank1,
  tgrelid::regclass::text as table_name,
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN '✅ Enabled'
    WHEN 'D' THEN '❌ Disabled'
    ELSE '⚠️  Unknown'
  END as status
FROM pg_trigger
WHERE tgname LIKE '%notification%'
ORDER BY tgrelid::regclass::text, tgname;

-- ============================================================================
-- SECTION 8: QUICK FIXES (Run if needed)
-- ============================================================================

-- Uncomment and run these if you have issues:

-- Fix 1: Set your full name if missing
-- UPDATE profiles 
-- SET full_name = 'Al-Syed A.' 
-- WHERE id = auth.uid() AND (full_name IS NULL OR full_name = '');

-- Fix 2: Set your main role to manager
-- UPDATE profiles 
-- SET main_role = 'manager', is_approved = true, approval_status = 'approved'
-- WHERE id = auth.uid();

-- Fix 3: Create HR Manager designation if missing
-- INSERT INTO custom_roles (name, display_name, description, main_role, permissions)
-- VALUES (
--   'hr_manager',
--   'HR Manager',
--   'Human Resources Manager with full HR module access',
--   'manager',
--   '{"hr": {"view": true, "manage": true, "approve_leave": true}}'::jsonb
-- ) ON CONFLICT (name) DO NOTHING;

-- Fix 4: Assign HR Manager designation to yourself
-- INSERT INTO role_assignments (user_id, role_id, assigned_by)
-- SELECT auth.uid(), cr.id, auth.uid()
-- FROM custom_roles cr
-- WHERE cr.name = 'hr_manager'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================

SELECT 
  '=== VERIFICATION COMPLETE ===' as section,
  '' as blank1,
  'Review the results above' as instruction,
  'All checks should show ✅ PASS' as expected_result,
  'If any checks fail, see QUICK FIXES section' as if_failed;
