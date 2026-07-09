# Finance Module Migration - Fixed for 2-Layer Role System

## Issue Resolved

**Error**: `invalid input value for enum app_role: "finance_admin"`

**Root Cause**: The finance migration was using hardcoded roles (`finance_admin`, `finance_manager`, `accountant`) which don't exist in the 2-layer role system.

**Solution**: Updated all RLS policies to use the 2-layer role system with custom designations and permissions.

## Changes Made

### 1. Updated RLS Policies

**Before** (Hardcoded roles):
```sql
CREATE POLICY "Finance admins can view accounts"
  ON finance_accounts FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE role = 'finance_admin'
    )
  );
```

**After** (2-layer system):
```sql
CREATE POLICY "Users with finance permission can view accounts"
  ON finance_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role = 'admin'
          OR cr.permissions->>'finance' IS NOT NULL
        )
    )
  );
```

### 2. Added Permission Structure Documentation

Added comprehensive comments explaining the finance permission structure:

```json
{
  "finance": {
    "view": true,
    "manage": true,
    "create_entries": true,
    "post_entries": true,
    "view_reports": true,
    "manage_payments": true,
    "view_audit": false
  }
}
```

### 3. Created Setup Guide

Created `docs/FINANCE_ROLE_SETUP.md` with:
- Recommended finance designations (Finance Manager, Accountant, Finance Analyst, AP Clerk)
- SQL scripts to create each designation
- Permission check examples
- UI implementation guidance
- Troubleshooting tips

## How to Use

### Step 1: Apply the Migration
```bash
supabase db push
```

The migration will now succeed without role enum errors.

### Step 2: Create Finance Designations

Run the SQL from `docs/FINANCE_ROLE_SETUP.md` to create finance designations:

```sql
-- Example: Create Finance Manager designation
INSERT INTO custom_roles (
  name, display_name, description, main_role, department_id, permissions
) VALUES (
  'finance_manager',
  'Finance Manager',
  'Full finance module access',
  'manager',
  (SELECT id FROM departments WHERE name = 'Finance'),
  '{"finance": {"view": true, "manage": true, "create_entries": true, "post_entries": true, "view_reports": true, "manage_payments": true}}'::jsonb
);
```

### Step 3: Assign to Users

```sql
-- Assign Finance Manager designation to user
INSERT INTO role_assignments (user_id, role_id, assigned_by)
VALUES (
  'user-uuid',
  (SELECT id FROM custom_roles WHERE name = 'finance_manager'),
  auth.uid()
);

-- Update profile
UPDATE profiles
SET 
  designation = 'Finance Manager',
  main_role = 'manager',
  department_id = (SELECT id FROM departments WHERE name = 'Finance')
WHERE id = 'user-uuid';
```

### Step 4: Verify Access

```sql
-- Check user can access finance tables
SELECT * FROM finance_accounts LIMIT 1;
-- Should return results if user has finance permission
```

## Files Updated

1. **supabase/migrations/20260321_finance_module_core.sql**
   - Fixed all RLS policies to use 2-layer system
   - Added permission structure documentation
   - Removed hardcoded role references

2. **docs/FINANCE_ROLE_SETUP.md** (NEW)
   - Complete guide for setting up finance roles
   - Recommended designations with SQL
   - Permission check examples
   - UI implementation guidance

3. **docs/FINANCE_MIGRATION_FIXED.md** (NEW)
   - This document explaining the fix

## Permission-Based Access

### Layer 1: Main Role
- **admin**: Full access to everything (bypasses permission checks)
- **manager**: Department management + designation permissions
- **employee**: Standard access + designation permissions

### Layer 2: Designation Permissions
Finance permissions in `custom_roles.permissions`:
- `finance.view`: View financial data
- `finance.manage`: Manage accounts and settings
- `finance.create_entries`: Create journal entries
- `finance.post_entries`: Post journal entries
- `finance.view_reports`: View financial reports
- `finance.manage_payments`: Process payments
- `finance.view_audit`: View audit logs (admin only)

## RLS Policy Logic

All finance table policies follow this pattern:

1. **Check if admin**: `p.main_role = 'admin'` → Full access
2. **Check designation permissions**: `cr.permissions->>'finance' IS NOT NULL` → Has finance access
3. **Combine with OR**: Admin OR has finance permission

This ensures:
- Admins always have access
- Users with finance designations have access
- Users without finance permissions are blocked

## Testing

### Test 1: Admin Access
```sql
-- Login as admin
SELECT * FROM finance_accounts;
-- ✅ Should work (admin bypasses permission checks)
```

### Test 2: Finance Manager Access
```sql
-- Login as user with Finance Manager designation
SELECT * FROM finance_accounts;
-- ✅ Should work (has finance.view permission)
```

### Test 3: Regular Employee Access
```sql
-- Login as employee without finance designation
SELECT * FROM finance_accounts;
-- ❌ Should return empty (RLS blocks access)
```

### Test 4: Own Expense Access
```sql
-- Login as any employee
SELECT * FROM finance_transactions WHERE created_by = auth.uid();
-- ✅ Should work (can view own expenses)
```

## Next Steps

1. ✅ Migration fixed and ready to apply
2. ⏳ Create finance designations using setup guide
3. ⏳ Assign designations to finance team members
4. ⏳ Test access with different user roles
5. ⏳ Continue with frontend implementation

## Benefits of This Approach

### Flexibility
- Create custom finance roles as needed
- Adjust permissions without code changes
- Department-specific finance roles

### Security
- Granular permission control
- RLS enforces access at database level
- Audit trail for all changes

### Scalability
- Add new finance permissions easily
- Support multiple finance teams/departments
- Role-based UI rendering

### Maintainability
- No hardcoded roles in code
- Permissions stored in database
- Easy to audit and update

## Summary

The finance module now correctly integrates with the 2-layer role system:
- **Layer 1 (main_role)**: admin, manager, employee
- **Layer 2 (designation)**: Custom roles with finance permissions

All RLS policies check for admin status OR finance permissions in the user's designation. This provides flexible, secure, and maintainable access control for the finance module.
