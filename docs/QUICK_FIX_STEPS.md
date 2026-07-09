# Quick Fix Steps - Get Your System Working Now

## Your Issues

1. ❌ Login works but shows "User" instead of "Al-Syed A."
2. ❌ HR module doesn't load - infinite recursion error
3. ❌ Role not showing even though HR Manager exists in DB
4. ❌ Can't see employee data

## The Fix (3 Simple Steps)

### Step 1: Apply the Fix Migration

Open your terminal and run:
```bash
supabase migration up --to 20260325_simple_fix_no_recursion
```

This fixes the infinite recursion error.

### Step 2: Fix Your Profile Data

Open Supabase SQL Editor and run this (replace the email):

```sql
-- CHANGE 'your-email@example.com' to your actual email in ALL 3 places below

-- Update your profile
UPDATE profiles 
SET 
  full_name = 'Al-Syed A.',
  main_role = 'manager',
  designation = 'HR Manager',
  is_approved = true,
  approval_status = 'approved'
WHERE email = 'your-email@example.com';

-- Create HR Manager designation
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, is_system_role)
VALUES (
  'hr_manager',
  'HR Manager',
  'Human Resources Manager with full HR module access',
  'manager',
  '{"hr": {"view": true, "manage": true, "approve_leave": true, "manage_appraisals": true}, "users": {"view": true, "manage": true, "approve": true}, "roles": {"view": true, "assign": true}}'::jsonb,
  false
) ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Assign HR Manager to you
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT p.id, cr.id, p.id
FROM profiles p
CROSS JOIN custom_roles cr
WHERE p.email = 'your-email@example.com'
  AND cr.name = 'hr_manager'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

### Step 3: Refresh and Re-login

1. Close your browser tab
2. Open a new tab
3. Login again
4. Check if you see "Al-Syed A." and "HR Manager"

## Verification

Run this in Supabase SQL Editor (replace email):

```sql
-- Check your profile
SELECT 
  email,
  full_name,
  main_role,
  designation,
  is_approved
FROM profiles
WHERE email = 'your-email@example.com';

-- Expected output:
-- email: your-email@example.com
-- full_name: Al-Syed A.
-- main_role: manager
-- designation: HR Manager
-- is_approved: true
```

## If It Still Doesn't Work

### Option A: Nuclear Reset (Clean Slate)

```bash
# WARNING: This deletes ALL data
supabase db reset

# Then apply migrations in order
supabase migration up --to 20260325_simple_fix_no_recursion
```

Then run Step 2 again to set up your profile.

### Option B: Check for Errors

Run the complete verification:
```bash
# In Supabase SQL Editor, run:
# Copy and paste content from: supabase/COMPLETE_VERIFICATION.sql
```

This will show you exactly what's wrong.

## What Should Work After Fix

✅ Login without errors  
✅ See "Al-Syed A." everywhere (not "User")  
✅ See "HR Manager" role badge  
✅ HR module loads all employee data  
✅ Can view all profiles  
✅ Can assign roles to other users  
✅ Notifications show correct names and avatars  

## Files to Use

1. **Migration**: `supabase/migrations/20260325_simple_fix_no_recursion.sql`
2. **Data Fix**: `supabase/IMMEDIATE_FIX.sql` (remember to change email!)
3. **Verification**: `supabase/COMPLETE_VERIFICATION.sql`
4. **Full Guide**: `docs/ERROR_FIX_GUIDE.md`

## Understanding the 2-Layer System

**Layer 1: main_role** (Basic)
- `admin` - Full access
- `manager` - Department management
- `employee` - Standard user

**Layer 2: designation** (Specific)
- "HR Manager" - Full HR access
- "Sales Executive" - Vendor/MOU management
- "Finance Manager" - Finance module access

**Example**: You are a `manager` (Layer 1) with "HR Manager" designation (Layer 2).

An admin could have "Sales Executive" designation. An employee could have "Accountant" designation. The main_role provides basic access, the designation provides specific permissions.

## Need Help?

If you're still stuck:
1. Share the output of `COMPLETE_VERIFICATION.sql`
2. Share any error messages from Supabase logs
3. Confirm which migrations have been applied
