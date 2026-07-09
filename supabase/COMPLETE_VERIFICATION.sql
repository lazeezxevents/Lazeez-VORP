-- ============================================================================
-- COMPLETE SYSTEM VERIFICATION
-- Run this after applying fixes to verify everything works
-- ============================================================================

-- ============================================================================
-- SECTION 1: SYSTEM HEALTH
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   SYSTEM HEALTH CHECK' as section;
SELECT '========================================' as divider;

-- Check 1: Required tables
SELECT 
  'Required Tables' as check_name,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  COUNT(*)::text || ' of 4 tables' as details
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations', 'notifications');

-- Check 2: Helper functions
SELECT 
  'Helper Functions' as check_name,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  COUNT(*)::text || ' functions' as details
FROM pg_proc
WHERE proname IN ('get_user_info', 'notify_users', 'is_admin_or_manager', 'is_admin');

-- Check 3: Notification triggers
SELECT 
  'Notification Triggers' as check_name,
  CASE 
    WHEN COUNT(*) >= 6 THEN '✅ PASS'
    ELSE '⚠️  WARNING'
  END as status,
  COUNT(*)::text || ' triggers' as details
FROM pg_trigger
WHERE tgname LIKE '%notification%';

-- Check 4: Profiles policies (should not have recursion)
SELECT 
  'Profiles Policies' as check_name,
  COUNT(*)::text || ' policies' as status,
  'Should have 4 policies' as details
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================================================
-- SECTION 2: YOUR PROFILE DATA
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   YOUR PROFILE DATA' as section;
SELECT '========================================' as divider;

SELECT 
  'Email' as field,
  COALESCE(email, '❌ NOT SET') as value,
  CASE WHEN email IS NOT NULL THEN '✅' ELSE '❌' END as status
FROM profiles WHERE id = auth.uid()
UNION ALL
SELECT 
  'Full Name' as field,
  COALESCE(full_name, '❌ NOT SET - This causes "User" display') as value,
  CASE WHEN full_name IS NOT NULL AND full_name != '' THEN '✅' ELSE '❌' END as status
FROM profiles WHERE id = auth.uid()
UNION ALL
SELECT 
  'Avatar URL' as field,
  COALESCE(avatar_url, '❌ NOT SET - No avatar will show') as value,
  CASE WHEN avatar_url IS NOT NULL THEN '✅' ELSE '❌' END as status
FROM profiles WHERE id = auth.uid()
UNION ALL
SELECT 
  'Main Role' as field,
  COALESCE(main_role, '❌ NOT SET') as value,
  CASE WHEN main_role IN ('admin', 'manager', 'employee') THEN '✅' ELSE '❌' END as status
FROM profiles WHERE id = auth.uid()
UNION ALL
SELECT 
  'Designation' as field,
  COALESCE(designation, '⚠️  NOT SET') as value,
  CASE WHEN designation IS NOT NULL THEN '✅' ELSE '⚠️' END as status
FROM profiles WHERE id = auth.uid()
UNION ALL
SELECT 
  'Approved' as field,
  COALESCE(is_approved::text, 'false') as value,
  CASE WHEN is_approved = true THEN '✅' ELSE '❌' END as status
FROM profiles WHERE id = auth.uid();

-- ============================================================================
-- SECTION 3: ROLE ASSIGNMENTS
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   YOUR ROLE ASSIGNMENTS' as section;
SELECT '========================================' as divider;

SELECT 
  cr.display_name as designation,
  cr.main_role as layer_1_role,
  cr.permissions::text as permissions,
  ra.assigned_at::date as assigned_date
FROM role_assignments ra
JOIN custom_roles cr ON cr.id = ra.role_id
WHERE ra.user_id = auth.uid()
ORDER BY ra.assigned_at DESC;

-- If no results, show message
SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM role_assignments WHERE user_id = auth.uid())
    THEN '⚠️  NO DESIGNATIONS ASSIGNED - Run IMMEDIATE_FIX.sql'
    ELSE '✅ Designations assigned'
  END as assignment_status;

-- ============================================================================
-- SECTION 4: TEST get_user_info FUNCTION
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   get_user_info() FUNCTION TEST' as section;
SELECT '========================================' as divider;

SELECT 
  get_user_info(auth.uid()) as function_output,
  CASE 
    WHEN get_user_info(auth.uid())->>'full_name' IS NOT NULL 
    THEN '✅ PASS - Returns full_name'
    ELSE '❌ FAIL - full_name is NULL'
  END as status;

-- ============================================================================
-- SECTION 5: RECENT NOTIFICATIONS
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   RECENT NOTIFICATIONS' as section;
SELECT '========================================' as divider;

SELECT 
  n.title,
  n.message,
  n.category,
  n.type,
  n.metadata->>'avatar_url' as creator_avatar,
  p.full_name as created_by_name,
  n.created_at::timestamp(0) as created_at,
  CASE WHEN n.read THEN '✅ Read' ELSE '📬 Unread' END as read_status
FROM notifications n
LEFT JOIN profiles p ON p.id = n.created_by
WHERE n.user_id = auth.uid()
ORDER BY n.created_at DESC
LIMIT 5;

-- Show count
SELECT 
  COUNT(*) as total_notifications,
  SUM(CASE WHEN NOT read THEN 1 ELSE 0 END) as unread_count,
  SUM(CASE WHEN metadata->>'avatar_url' IS NOT NULL THEN 1 ELSE 0 END) as with_avatar_count
FROM notifications
WHERE user_id = auth.uid();

-- ============================================================================
-- SECTION 6: AVAILABLE DESIGNATIONS
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   AVAILABLE DESIGNATIONS' as section;
SELECT '========================================' as divider;

SELECT 
  cr.display_name,
  cr.main_role as layer_1_role,
  cr.description,
  (SELECT COUNT(*) FROM role_assignments WHERE role_id = cr.id) as users_assigned
FROM custom_roles cr
ORDER BY cr.main_role, cr.display_name;

-- ============================================================================
-- SECTION 7: NOTIFICATION TRIGGERS
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   NOTIFICATION TRIGGERS' as section;
SELECT '========================================' as divider;

SELECT 
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
-- SECTION 8: RLS POLICIES CHECK
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   PROFILES RLS POLICIES' as section;
SELECT '========================================' as divider;

SELECT 
  policyname as policy_name,
  cmd as command,
  CASE 
    WHEN qual LIKE '%profiles%profiles%' THEN '❌ RECURSION DETECTED'
    WHEN qual LIKE '%OLD.%' OR qual LIKE '%NEW.%' THEN '❌ OLD/NEW IN POLICY'
    ELSE '✅ OK'
  END as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- SECTION 9: FINAL SUMMARY
-- ============================================================================

SELECT '========================================' as divider;
SELECT '   VERIFICATION SUMMARY' as section;
SELECT '========================================' as divider;

SELECT 
  'System Status' as category,
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND full_name IS NOT NULL AND main_role IS NOT NULL)
    THEN '✅ READY'
    ELSE '❌ NEEDS SETUP'
  END as status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND full_name IS NOT NULL AND main_role IS NOT NULL)
    THEN 'System is ready to use'
    ELSE 'Run IMMEDIATE_FIX.sql to complete setup'
  END as message;

-- ============================================================================
-- QUICK ACTIONS (Uncomment to run)
-- ============================================================================

-- If you need to quickly set your name:
-- UPDATE profiles SET full_name = 'Al-Syed A.' WHERE id = auth.uid();

-- If you need to quickly set your role:
-- UPDATE profiles SET main_role = 'manager', designation = 'HR Manager' WHERE id = auth.uid();

-- If you need to test get_user_info:
-- SELECT get_user_info(auth.uid());

-- ============================================================================
-- END OF VERIFICATION
-- ============================================================================
