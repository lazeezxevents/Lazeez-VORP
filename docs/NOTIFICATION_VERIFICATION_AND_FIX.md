# Notification System Verification & Fix Guide

## Problems Identified

1. ✅ **Infinite recursion in profiles RLS** - `Failed to load assignment data infinite recursion detected in policy for relation "profiles"`
2. ✅ **Notifications showing "User" instead of names** - Avatar and full_name not displaying
3. ✅ **Role/designation confusion** - Need to clarify 2-layer system
4. ✅ **UI not showing roles** - Even though designations exist in DB

## Solution Applied

Created `supabase/migrations/20260324_fix_infinite_recursion_and_notifications.sql` that:

- Fixes infinite recursion using SECURITY DEFINER functions
- Ensures notifications show user names and avatars
- Adds missing notification triggers
- Provides verification queries

## Step 1: Apply the Fix Migration

```bash
# Apply the fix migration
supabase migration up --to 20260324_fix_infinite_recursion_and_notifications
```

## Step 2: Run Verification Queries

### A. Verify Notification System

```sql
-- Run the verification function
SELECT * FROM verify_notification_system();

-- Expected output:
-- check_name                  | status | details
-- ---------------------------+--------+----------------------------------
-- get_user_info function     | OK     | Returns user full_name and avatar_url
-- notify_users function      | OK     | Sends notifications to multiple users
-- notifications table        | OK     | Stores notification records
-- profiles RLS policies      | OK     | Checks for recursive policy definitions
-- notification triggers      | 8 triggers | Should have multiple notification triggers
```

### B. Test User Info Retrieval

```sql
-- Test if your profile data loads correctly
SELECT 
  id,
  full_name,
  email,
  avatar_url,
  main_role,
  designation,
  is_approved,
  approval_status
FROM profiles
WHERE id = auth.uid();

-- Expected: Should show "Al-Syed A." not "User"
```

### C. Test get_user_info Function

```sql
-- Test the notification helper function
SELECT get_user_info(auth.uid());

-- Expected output:
-- {
--   "full_name": "Al-Syed A.",
--   "avatar_url": "https://..."
-- }
```

### D. Verify Role Assignments

```sql
-- Check your role assignments
SELECT 
  p.full_name,
  p.main_role,
  p.designation,
  cr.display_name as role_display_name,
  cr.permissions
FROM profiles p
LEFT JOIN role_assignments ra ON ra.user_id = p.id
LEFT JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.id = auth.uid();

-- Expected: Should show your HR Manager designation
```

### E. Check All Notification Triggers

```sql
-- List all notification triggers
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname LIKE '%notification%'
ORDER BY tgrelid::regclass::text, tgname;

-- Expected triggers:
-- - vendor_created_notification
-- - issue_created_notification
-- - issue_status_changed_notification
-- - mou_created_notification
-- - mou_status_changed_notification
-- - leave_request_submitted_notification
-- - leave_status_changed_notification
-- - new_user_registration_notification
-- - user_approved_notification
-- - payment_created_notification
```

## Step 3: Fix Role/Designation Data

### Understanding the 2-Layer System

**Layer 1: main_role** (Simple, for basic access control)
- `admin` - Full system access
- `manager` - Department/team management
- `employee` - Standard user

**Layer 2: designation** (Granular, for specific permissions)
- Stored in `custom_roles` table
- Linked via `role_assignments` table
- Contains JSONB permissions
- Examples: "HR Manager", "Sales Executive", "Finance Analyst"

### A. Check Existing Designations

```sql
-- View all custom roles/designations
SELECT 
  id,
  name,
  display_name,
  main_role,
  permissions,
  department_id
FROM custom_roles
ORDER BY main_role, display_name;
```

### B. Create HR Manager Designation (if missing)

```sql
-- Create HR Manager designation
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
  'manager',  -- Layer 1: manager
  '{
    "hr": {
      "view": true,
      "manage": true,
      "approve_leave": true,
      "manage_appraisals": true,
      "view_attendance": true,
      "manage_lifecycle": true
    },
    "users": {
      "view": true,
      "manage": true,
      "approve": true
    },
    "roles": {
      "view": true,
      "assign": true
    }
  }'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  main_role = EXCLUDED.main_role;
```

### C. Assign HR Manager to Your User

```sql
-- First, update your main_role to 'manager'
UPDATE profiles
SET 
  main_role = 'manager',
  designation = 'HR Manager',
  is_approved = true,
  approval_status = 'approved'
WHERE email = 'your-email@example.com';  -- Replace with your email

-- Then, assign the HR Manager designation
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT 
  p.id,
  cr.id,
  p.id  -- Self-assigned for initial setup
FROM profiles p
CROSS JOIN custom_roles cr
WHERE p.email = 'your-email@example.com'  -- Replace with your email
  AND cr.name = 'hr_manager'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### D. Create Sales Executive Designation (Example)

```sql
-- Create Sales Executive designation for admin
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
  'Sales team member with vendor and MOU management access',
  'admin',  -- Layer 1: admin (can also be 'employee' or 'manager')
  '{
    "vendors": {
      "view": true,
      "create": true,
      "edit": true,
      "manage_payments": true
    },
    "mous": {
      "view": true,
      "create": true,
      "edit": true
    },
    "issues": {
      "view": true,
      "create": true,
      "edit": true
    }
  }'::jsonb,
  false
) ON CONFLICT (name) DO NOTHING;
```

## Step 4: Test Notifications

### A. Create a Test Notification

```sql
-- Manually create a test notification
INSERT INTO notifications (
  user_id,
  type,
  category,
  title,
  message,
  created_by
) VALUES (
  auth.uid(),
  'info',
  'test',
  'Test Notification',
  'This is a test notification to verify the system works',
  auth.uid()
);

-- Check if it appears
SELECT 
  id,
  type,
  category,
  title,
  message,
  read,
  created_at,
  metadata
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

### B. Test Notification with User Info

```sql
-- Test creating a vendor (should trigger notification with your name and avatar)
-- Do this from the UI, then check:

SELECT 
  n.id,
  n.title,
  n.message,
  n.metadata->>'avatar_url' as creator_avatar,
  n.created_at,
  p.full_name as creator_name
FROM notifications n
LEFT JOIN profiles p ON p.id = n.created_by
WHERE n.category = 'vendor'
ORDER BY n.created_at DESC
LIMIT 5;

-- Should show your full name and avatar URL
```

## Step 5: Fix Common Issues

### Issue: "User" instead of name in notifications

**Cause**: `full_name` is NULL in profiles table

**Fix**:
```sql
-- Update your profile with full name
UPDATE profiles
SET full_name = 'Al-Syed A.'
WHERE id = auth.uid() AND (full_name IS NULL OR full_name = '');
```

### Issue: No avatar showing

**Cause**: `avatar_url` is NULL

**Fix**:
```sql
-- Update avatar URL (use your actual avatar URL)
UPDATE profiles
SET avatar_url = 'https://your-avatar-url.com/image.jpg'
WHERE id = auth.uid();

-- Or use Gravatar
UPDATE profiles
SET avatar_url = 'https://www.gravatar.com/avatar/' || md5(lower(email))
WHERE id = auth.uid();
```

### Issue: Role not showing in UI

**Cause**: Frontend not reading from correct fields

**Check**:
```sql
-- Verify all role data is present
SELECT 
  id,
  email,
  full_name,
  main_role,
  designation,
  is_approved,
  approval_status,
  (SELECT COUNT(*) FROM role_assignments WHERE user_id = profiles.id) as role_count
FROM profiles
WHERE id = auth.uid();
```

## Step 6: Complete Verification Checklist

Run all these queries to ensure everything works:

```sql
-- 1. Notification system check
SELECT * FROM verify_notification_system();

-- 2. Your profile data
SELECT id, full_name, email, main_role, designation, is_approved 
FROM profiles WHERE id = auth.uid();

-- 3. Your role assignments
SELECT cr.display_name, cr.main_role, cr.permissions
FROM role_assignments ra
JOIN custom_roles cr ON cr.id = ra.role_id
WHERE ra.user_id = auth.uid();

-- 4. Recent notifications
SELECT title, message, metadata, created_at
FROM notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- 5. Notification triggers
SELECT COUNT(*) as trigger_count
FROM pg_trigger
WHERE tgname LIKE '%notification%';

-- Expected: At least 8 triggers
```

## Expected Results After Fix

✅ **Login works** - No infinite recursion errors  
✅ **Name displays** - Shows "Al-Syed A." instead of "User"  
✅ **Avatar shows** - Profile picture displays in notifications  
✅ **Role visible** - "HR Manager" designation shows in UI  
✅ **Notifications work** - All user actions trigger notifications with correct user info  
✅ **HR data loads** - No more "Failed to load assignment data" errors  

## Troubleshooting

If issues persist after applying the fix:

1. **Clear browser cache** - Old policies may be cached
2. **Re-login** - Refresh authentication token
3. **Check Supabase logs** - Look for policy errors
4. **Run diagnostics** - Use the verification queries above
5. **Check RLS is enabled** - `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;`

## Next Steps

After verification passes:
1. Continue with Finance Module implementation
2. Create additional designations as needed
3. Assign roles to other users
4. Test notification system across all modules