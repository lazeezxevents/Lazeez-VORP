# Finance Module - Role Setup Guide

## Overview

The Finance Module integrates with Lazeez VORP's 2-layer role system. This guide explains how to create finance-specific designations and assign them to users.

## 2-Layer Role System

### Layer 1: Main Role
- **admin**: Full system access, can view audit logs
- **manager**: Department management, receives manager notifications
- **employee**: Standard access, personal notifications

### Layer 2: Designation (Custom Roles)
Custom designations with granular finance permissions created by admins/HR.

## Finance Permission Structure

Finance permissions are stored in `custom_roles.permissions` JSONB field:

```json
{
  "finance": {
    "view": true,              // View financial data
    "manage": true,            // Manage accounts and settings
    "create_entries": true,    // Create journal entries
    "post_entries": true,      // Post journal entries
    "view_reports": true,      // View financial reports
    "manage_payments": true,   // Process payments and payouts
    "view_audit": false        // View audit logs (typically admin only)
  }
}
```

## Recommended Finance Designations

### 1. Finance Manager
**Main Role**: manager  
**Department**: Finance  
**Permissions**:
```sql
INSERT INTO custom_roles (
  name,
  display_name,
  description,
  main_role,
  department_id,
  permissions
) VALUES (
  'finance_manager',
  'Finance Manager',
  'Full finance module access with management capabilities',
  'manager',
  (SELECT id FROM departments WHERE name = 'Finance'),
  '{
    "finance": {
      "view": true,
      "manage": true,
      "create_entries": true,
      "post_entries": true,
      "view_reports": true,
      "manage_payments": true,
      "view_audit": false
    },
    "vendors": {
      "view": true,
      "edit": false
    },
    "analytics": {
      "view": true,
      "export": true
    }
  }'::jsonb
);
```

### 2. Accountant
**Main Role**: employee  
**Department**: Finance  
**Permissions**:
```sql
INSERT INTO custom_roles (
  name,
  display_name,
  description,
  main_role,
  department_id,
  permissions
) VALUES (
  'accountant',
  'Accountant',
  'Create and manage journal entries, view financial reports',
  'employee',
  (SELECT id FROM departments WHERE name = 'Finance'),
  '{
    "finance": {
      "view": true,
      "manage": false,
      "create_entries": true,
      "post_entries": true,
      "view_reports": true,
      "manage_payments": false,
      "view_audit": false
    },
    "vendors": {
      "view": true,
      "edit": false
    }
  }'::jsonb
);
```

### 3. Finance Analyst
**Main Role**: employee  
**Department**: Finance  
**Permissions**:
```sql
INSERT INTO custom_roles (
  name,
  display_name,
  description,
  main_role,
  department_id,
  permissions
) VALUES (
  'finance_analyst',
  'Finance Analyst',
  'View-only access to financial data and reports',
  'employee',
  (SELECT id FROM departments WHERE name = 'Finance'),
  '{
    "finance": {
      "view": true,
      "manage": false,
      "create_entries": false,
      "post_entries": false,
      "view_reports": true,
      "manage_payments": false,
      "view_audit": false
    },
    "analytics": {
      "view": true,
      "export": true
    }
  }'::jsonb
);
```

### 4. Accounts Payable Clerk
**Main Role**: employee  
**Department**: Finance  
**Permissions**:
```sql
INSERT INTO custom_roles (
  name,
  display_name,
  description,
  main_role,
  department_id,
  permissions
) VALUES (
  'ap_clerk',
  'Accounts Payable Clerk',
  'Process vendor payments and manage payables',
  'employee',
  (SELECT id FROM departments WHERE name = 'Finance'),
  '{
    "finance": {
      "view": true,
      "manage": false,
      "create_entries": true,
      "post_entries": false,
      "view_reports": true,
      "manage_payments": true,
      "view_audit": false
    },
    "vendors": {
      "view": true,
      "edit": false
    }
  }'::jsonb
);
```

## Assigning Finance Designations

### Step 1: Create the Designation (Admin/HR)
Use the SQL examples above or create through the UI (when implemented).

### Step 2: Assign to User
```sql
-- Assign designation to user
INSERT INTO role_assignments (user_id, role_id, assigned_by)
VALUES (
  'user-uuid',
  (SELECT id FROM custom_roles WHERE name = 'accountant'),
  auth.uid()
);

-- Update user profile
UPDATE profiles
SET 
  designation = 'Accountant',
  main_role = 'employee',
  department_id = (SELECT id FROM departments WHERE name = 'Finance')
WHERE id = 'user-uuid';
```

### Step 3: Verify Permissions
```sql
-- Check user's finance permissions
SELECT 
  p.full_name,
  p.main_role,
  p.designation,
  cr.permissions->'finance' as finance_permissions
FROM profiles p
LEFT JOIN role_assignments ra ON ra.user_id = p.id
LEFT JOIN custom_roles cr ON cr.id = ra.role_id
WHERE p.id = 'user-uuid';
```

## Permission Checks in Code

### TypeScript Helper Function
```typescript
// Check if user has specific finance permission
export function hasFinancePermission(
  userId: string, 
  permission: 'view' | 'manage' | 'create_entries' | 'post_entries' | 'view_reports' | 'manage_payments'
): Promise<boolean> {
  return supabase
    .from('profiles')
    .select(`
      main_role,
      role_assignments!inner(
        custom_roles!inner(
          permissions
        )
      )
    `)
    .eq('id', userId)
    .single()
    .then(({ data }) => {
      // Admins have all permissions
      if (data?.main_role === 'admin') return true;
      
      // Check designation permissions
      const financePerms = data?.role_assignments?.[0]?.custom_roles?.permissions?.finance;
      return financePerms?.[permission] === true;
    });
}
```

### React Component Example
```tsx
import { useAuth } from '@/contexts/AuthContext';

function FinanceActions() {
  const { hasPermission } = useAuth();
  const canManagePayments = hasPermission('finance.manage_payments');
  const canPostEntries = hasPermission('finance.post_entries');
  
  return (
    <div>
      {canPostEntries && (
        <Button onClick={handlePostEntry}>Post Entry</Button>
      )}
      {canManagePayments && (
        <Button onClick={handleProcessPayment}>Process Payment</Button>
      )}
    </div>
  );
}
```

## RLS Policy Behavior

### Finance Tables Access
- **finance_accounts**: Requires `finance.view` or admin
- **finance_journal_entries**: Requires `finance` permission or admin
- **finance_ledger_entries**: Requires `finance` permission or admin
- **finance_transactions**: Requires `finance` permission or admin (users can view own expenses)
- **finance_audit_log**: Requires `main_role = 'admin'` only

### Example RLS Check
```sql
-- User with finance.view permission can view accounts
SELECT * FROM finance_accounts;
-- ✅ Works if user has finance permission in their designation

-- User without finance permission
SELECT * FROM finance_accounts;
-- ❌ Returns empty result set (RLS blocks access)
```

## UI Implementation

### Role Badge Display
```tsx
// Show main role (Layer 1)
<Badge variant={mainRole === 'admin' ? 'destructive' : 'default'}>
  {mainRole}
</Badge>

// Show designation (Layer 2)
<span className="text-sm text-muted-foreground">
  {designation || 'No designation'}
</span>
```

### Permission-Based Navigation
```tsx
const financeMenuItems = [
  {
    label: 'Dashboard',
    path: '/finance',
    permission: 'finance.view'
  },
  {
    label: 'Journal Entries',
    path: '/finance/journal',
    permission: 'finance.create_entries'
  },
  {
    label: 'Payments',
    path: '/finance/payments',
    permission: 'finance.manage_payments'
  },
  {
    label: 'Reports',
    path: '/finance/reports',
    permission: 'finance.view_reports'
  }
].filter(item => hasPermission(item.permission));
```

## Best Practices

### 1. Start Restrictive
- Begin with minimal permissions
- Add permissions as needed based on job requirements
- Regular permission audits

### 2. Department Alignment
- Link finance designations to Finance department
- Allows department-specific reporting
- Enables manager oversight

### 3. Separation of Duties
- Different designations for AP and AR
- Separate entry creation from posting
- Payment processing requires specific permission

### 4. Audit Trail
- All finance actions logged in `finance_audit_log`
- Only admins can view audit logs
- Immutable audit records

### 5. Testing Permissions
- Test each designation thoroughly
- Verify RLS policies work correctly
- Check UI elements show/hide properly

## Troubleshooting

### User Can't Access Finance Module
1. Check `main_role` is set (admin, manager, or employee)
2. Verify designation is assigned in `role_assignments`
3. Check `custom_roles.permissions` has `finance` object
4. Confirm RLS policies are enabled on tables

### Permission Check Fails
1. Verify user has active role assignment
2. Check JSONB structure in `permissions` column
3. Ensure permission key matches exactly (case-sensitive)
4. Test with admin user to rule out RLS issues

### Can't Create Designation
1. Ensure you're logged in as admin or HR
2. Check `custom_roles` table exists
3. Verify department_id is valid (if specified)
4. Check JSONB permissions format is valid

## Migration from Old System

If you have users with text-based "Finance Manager" designations:

```sql
-- Create custom role for existing designation
INSERT INTO custom_roles (name, display_name, main_role, permissions)
SELECT 
  'finance_manager',
  'Finance Manager',
  'manager',
  '{"finance": {"view": true, "manage": true, "create_entries": true, "post_entries": true, "view_reports": true, "manage_payments": true}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM custom_roles WHERE name = 'finance_manager');

-- Assign to users with that designation
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT 
  p.id,
  cr.id,
  (SELECT id FROM profiles WHERE main_role = 'admin' LIMIT 1)
FROM profiles p
CROSS JOIN custom_roles cr
WHERE p.designation = 'Finance Manager'
  AND cr.name = 'finance_manager'
  AND NOT EXISTS (
    SELECT 1 FROM role_assignments 
    WHERE user_id = p.id AND role_id = cr.id
  );
```

## Summary

The Finance Module uses the 2-layer role system for flexible, granular access control:
- **Layer 1 (main_role)**: Determines notification routing and basic access
- **Layer 2 (designation)**: Provides fine-grained finance permissions

Create custom finance designations through SQL or UI, assign to users, and the RLS policies automatically enforce access control based on permissions.
