# Error Fix Guide - "missing FROM-clause entry for table old"

## Error Explained

The error `ERROR: 42P01: missing FROM-clause entry for table "old"` occurs when you try to use `OLD` or `NEW` references in RLS policy `WITH CHECK` clauses. These special variables are only available in **triggers**, not in **policies**.

## What Caused It

In the profiles UPDATE policy, we tried to use:
```sql
WITH CHECK (
  id = auth.uid() AND
  (OLD.main_role = NEW.main_role OR NEW.main_role IS NULL) AND ...
)
```

This doesn't work because RLS policies don't have access to OLD/NEW - only triggers do.

## The Fix

We've created **3 migration files** to fix this:

### Option 1: Simple Fix (RECOMMENDED)
**File**: `supabase/migrations/20260325_simple_fix_no_recursion.sql`

This is the cleanest solution:
- Removes ALL problematic policies
- Creates simple helper functions with SECURITY DEFINER
- Creates simple policies without OLD/NEW references
- Uses a trigger to prevent self-role-escalation

**Apply it**:
```bash
supabase migration up --to 20260325_simple_fix_no_recursion
```

### Option 2: Updated Fix Migration
**File**: `supabase/migrations/20260324_fix_infinite_recursion_and_notifications.sql` (v2.0)

This has been updated to remove the OLD/NEW references and use a simpler trigger approach.

### Option 3: Updated Ultimate Master Migration
**File**: `supabase/migrations/20260323_final_master_migration.sql`

The ultimate master migration has also been updated with the fix.

## Immediate Data Fix

**File**: `supabase/IMMEDIATE_FIX.sql`

This SQL script fixes your immediate issues:

1. ✅ Sets your full name to "Al-Syed A." (fixes "User" display)
2. ✅ Sets your role to manager (fixes HR access)
3. ✅ Creates HR Manager designation
4. ✅ Assigns HR Manager to you
5. ✅ Creates other common designations (Sales Executive, Finance Manager, Accountant)

**How to use**:
1. Open Supabase SQL Editor
2. Copy the entire content of `supabase/IMMEDIATE_FIX.sql`
3. **IMPORTANT**: Replace `'your-email@example.com'` with your actual email (appears 5 times)
4. Run the script
5. Refresh your browser and re-login

## Step-by-Step Fix Process

### Step 1: Apply the Simple Fix Migration
```bash
supabase migration up --to 20260325_simple_fix_no_recursion
```

### Step 2: Run the Immediate Fix SQL
1. Open `supabase/IMMEDIATE_FIX.sql`
2. Replace ALL instances of `'your-email@example.com'` with your actual email
3. Copy and paste into Supabase SQL Editor
4. Run it

### Step 3: Verify Everything Works
```sql
-- Check your profile
SELECT id, email, full_name, main_role, designation, is_approved
FROM profiles
WHERE email = 'your-actual-email@example.com';

-- Should show:
-- full_name: Al-Syed A.
-- main_role: manager
-- designation: HR Manager
-- is_approved: true

-- Check your role assignments
SELECT p.full_name, cr.display_name, cr.permissions
FROM profiles p
JOIN role_assignments ra ON ra.user_id = p.id
JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.email = 'your-actual-email@example.com';

-- Should show: HR Manager with full permissions
```

### Step 4: Test the System
1. Refresh browser
2. Re-login
3. Check if you see "Al-Syed A." instead of "User"
4. Check if HR module loads without errors
5. Check if you can view all profiles

## What Each Migration Does

### 20260325_simple_fix_no_recursion.sql
- **Drops**: All existing profiles policies
- **Creates**: `is_admin_or_manager()` and `is_admin()` helper functions
- **Creates**: 4 simple policies without OLD/NEW
- **Creates**: `check_profile_update()` trigger to prevent self-role-escalation
- **Result**: No more infinite recursion, no more OLD/NEW errors

### IMMEDIATE_FIX.sql
- **Updates**: Your profile with correct name and role
- **Creates**: HR Manager designation with full permissions
- **Assigns**: HR Manager role to you
- **Creates**: Other common designations (Sales Executive, Finance Manager, Accountant)
- **Result**: You can immediately use the system

## Understanding the Solution

### Why SECURITY DEFINER Works
```sql
CREATE FUNCTION is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND main_role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

The `SECURITY DEFINER` keyword makes the function run with the privileges of the function owner (superuser), not the calling user. This breaks the recursion loop because:

1. Policy checks if user is admin/manager
2. Policy calls `is_admin_or_manager(auth.uid())`
3. Function runs with superuser privileges (bypasses RLS)
4. Function queries profiles table directly
5. No recursion!

### Why Triggers Work for OLD/NEW
```sql
CREATE TRIGGER check_profile_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_update();
```

Triggers have access to OLD and NEW because they run **during** the update operation, not **before** like policies. The trigger can:
- Read OLD values (before update)
- Read NEW values (after update)
- Modify NEW values before they're saved
- Prevent the update entirely

## Common Issues After Fix

### Issue 1: Still seeing "User"
**Solution**: Run the IMMEDIATE_FIX.sql script with your email

### Issue 2: Still getting recursion error
**Solution**: 
```bash
# Clear all migrations and start fresh
supabase db reset
supabase migration up --to 20260325_simple_fix_no_recursion
```

### Issue 3: Can't update profiles
**Solution**: Check if trigger is enabled:
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'check_profile_update_trigger';
```

### Issue 4: Role not showing in UI
**Solution**: Check role assignment:
```sql
SELECT * FROM role_assignments WHERE user_id = auth.uid();
```

## Verification Checklist

After applying fixes, verify:

- [ ] Can login without errors
- [ ] See "Al-Syed A." not "User"
- [ ] See "HR Manager" role in UI
- [ ] Can view all profiles in HR module
- [ ] Can assign roles to other users
- [ ] Notifications show correct names
- [ ] No infinite recursion errors
- [ ] No OLD/NEW errors

## Next Steps

1. Apply the simple fix migration
2. Run the immediate fix SQL
3. Verify everything works
4. Continue with Finance Module implementation
5. Create additional designations as needed

## Support

If you still have issues:
1. Check Supabase logs for errors
2. Run verification queries
3. Share specific error messages
4. Check that all migrations applied: `SELECT * FROM supabase_migrations.schema_migrations;`
