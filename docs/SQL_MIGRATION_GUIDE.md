# SQL Migration Guide - Master Consolidated System

## Overview

The master migration file `20260320_master_consolidated_system.sql` implements a **2-layer role system** with RBAC, Onboarding, and Notifications.

## Two-Layer Role Architecture

### Layer 1: Main Role (Simple)
**Purpose**: Basic access control, notification routing, UI badges

**Three roles only:**
- `admin` - Full system access, user management
- `manager` - Department/team management, approvals
- `employee` - Standard employee access

**Stored in**: `profiles.main_role`

**Used for**:
- Determining who receives notifications
- Basic RLS policy checks
- Simple role badges in UI
- High-level access control

### Layer 2: Designation (Granular)
**Purpose**: Fine-grained permissions, department-specific roles

**Characteristics:**
- **Dynamically created** by admins/HR through UI
- **Department-specific** (optional department_id)
- **Manager-assigned** to employees
- **Custom permissions** per designation

**Stored in**: `custom_roles` table, linked via `role_assignments`

**Examples of designations:**
- "Senior Developer" (employee, Engineering dept)
- "HR Lead" (manager, HR dept)
- "Finance Manager" (manager, Finance dept)
- "Junior Designer" (employee, Design dept)
- "Operations Lead" (manager, Operations dept)

**Used for**:
- Granular permission checks (vendors.create, issues.edit, etc.)
- Department-specific access control
- Custom role management
- Permission inheritance

## Schema Structure

### profiles table
```sql
main_role VARCHAR(50)        -- Layer 1: 'admin', 'manager', 'employee'
designation VARCHAR(100)     -- Layer 2: Display name from custom_roles
department_id UUID           -- Department assignment
manager_id UUID              -- Reporting manager
```

### custom_roles table (Layer 2)
```sql
id UUID
name VARCHAR(100)            -- Unique identifier (e.g., "senior_developer")
display_name VARCHAR(100)    -- Human-readable (e.g., "Senior Developer")
description TEXT
main_role VARCHAR(50)        -- Links to Layer 1: 'admin', 'manager', 'employee'
permissions JSONB            -- Granular permissions
department_id UUID           -- Optional: Restrict to department
created_by UUID              -- Who created this designation
```

### role_assignments table
```sql
user_id UUID                 -- Employee
role_id UUID                 -- Designation (custom_roles)
assigned_by UUID             -- Manager who assigned
```

## Permission System

### Permission Structure (JSONB)
```json
{
  "vendors": {"view": true, "create": false, "edit": false, "delete": false},
  "issues": {"view": true, "create": true, "edit": true, "delete": false},
  "mous": {"view": true, "create": false, "edit": false, "delete": false},
  "hr": {"view_all": false, "manage_employees": false, "manage_attendance": true, "manage_leave": true, "manage_appraisals": false},
  "finance": {"view": false, "manage_payments": false, "view_reports": false},
  "projects": {"view": true, "create": true, "manage": false},
  "analytics": {"view": false, "export": false},
  "admin": {"manage_users": false, "manage_roles": false, "system_settings": false}
}
```

### Checking Permissions
```sql
-- Check if user has permission
SELECT has_permission(user_id, 'vendors.create');

-- Get all user permissions
SELECT get_user_permissions(user_id);
```


## What This Migration Does

### 1. Cleanup Phase
- Drops all existing conflicting policies and triggers
- Ensures idempotent execution (can be run multiple times safely)

### 2. Schema Updates
- Adds Layer 1 columns to profiles (main_role: admin/manager/employee)
- Adds Layer 2 support (designation, department_id, manager_id)
- Adds onboarding columns (approval_status, admin_approved_by, hr_approved_by, etc.)
- Creates custom_roles table for Layer 2 designations
- Creates role_assignments table for user-designation mapping
- Creates employee_invitations table for HR-initiated onboarding
- Creates notifications table for real-time notifications

### 3. No Pre-Configured Roles
**Important**: This migration does NOT insert any pre-configured roles. All designations are created dynamically through the UI by admins/HR.

The system supports:
- Custom designation creation
- Department-specific roles
- Manager-assigned designations
- Granular permission configuration

### 4. Security (RLS Policies)
- Custom roles: View (all), Create/Update (HR/Admin), Delete (Admin only)
- Role assignments: View own (users), Manage (HR/Admin)
- Employee invitations: Full management (HR/Admin only)
- Notifications: View/update own (users), Insert (system)
- Profiles: Limited self-update, full management (HR/Admin)


### 5. Helper Functions
- `get_user_info(user_id)`: Returns user name and avatar
- `notify_users(...)`: Sends notifications to multiple users
- `get_admin_ids()`: Returns all Layer 1 admin user IDs
- `get_manager_ids()`: Returns all Layer 1 manager user IDs (admin + manager)
- `get_user_permissions(user_id)`: Returns aggregated Layer 2 permissions
- `has_permission(user_id, path)`: Checks specific Layer 2 permission

### 6. Notification Triggers
Automatically creates notifications for:
- **Vendors**: Created
- **Issues**: Created, assigned
- **MOUs**: Created
- **Leave Requests**: Submitted
- **Users**: New registration, approved

### 7. Real-Time
- Enables Supabase real-time subscriptions for notifications table

## How to Run

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `supabase/migrations/20260320_master_consolidated_system.sql`
4. Paste and run

### Option 2: Supabase CLI
```bash
supabase db push
```

## Fixes Applied

### Policy Conflicts
- All existing policies are dropped before recreation
- Prevents "policy already exists" errors

### Trigger Conflicts
- All notification triggers are dropped before recreation
- Prevents "trigger already exists" errors

### Idempotency
- Uses `IF NOT EXISTS` for columns
- Uses `CREATE TABLE IF NOT EXISTS` for tables
- Uses `CREATE INDEX IF NOT EXISTS` for indexes
- Uses `ON CONFLICT DO NOTHING` for role inserts


## Verification

After running the migration, verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('custom_roles', 'role_assignments', 'employee_invitations', 'notifications');

-- Check NO pre-configured roles exist (should return 0)
SELECT COUNT(*) FROM custom_roles WHERE is_system_role = true;

-- Check custom_roles table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'custom_roles'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations', 'notifications');

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name LIKE '%notification%';
```

## Usage Examples

### Creating a Designation (via UI/API)
```sql
-- Example: Create "Senior Developer" designation
INSERT INTO custom_roles (name, display_name, description, main_role, department_id, permissions, created_by)
VALUES (
  'senior_developer',
  'Senior Developer',
  'Senior software developer with code review and mentoring responsibilities',
  'employee',  -- Layer 1 role
  (SELECT id FROM departments WHERE name = 'Engineering'),
  '{
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "projects": {"view": true, "create": true, "manage": false},
    "analytics": {"view": true, "export": false}
  }'::jsonb,
  auth.uid()
);
```

### Assigning Designation to Employee
```sql
-- Assign "Senior Developer" to an employee
INSERT INTO role_assignments (user_id, role_id, assigned_by)
VALUES (
  'employee-uuid',
  (SELECT id FROM custom_roles WHERE name = 'senior_developer'),
  auth.uid()  -- Manager assigning the role
);

-- Update employee profile
UPDATE profiles
SET 
  designation = 'Senior Developer',
  main_role = 'employee'
WHERE id = 'employee-uuid';
```

## Rollback

If you need to rollback:

```sql
-- Drop tables (cascades to dependent objects)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS employee_invitations CASCADE;
DROP TABLE IF EXISTS role_assignments CASCADE;
DROP TABLE IF EXISTS custom_roles CASCADE;

-- Remove columns from profiles
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS main_role,
  DROP COLUMN IF EXISTS designation,
  DROP COLUMN IF EXISTS department_id,
  DROP COLUMN IF EXISTS is_approved,
  DROP COLUMN IF EXISTS approval_status,
  DROP COLUMN IF EXISTS admin_approved_by,
  DROP COLUMN IF EXISTS admin_approved_at,
  DROP COLUMN IF EXISTS hr_approved_by,
  DROP COLUMN IF EXISTS hr_approved_at,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS onboarding_type,
  DROP COLUMN IF EXISTS manager_id;
```

## Next Steps

After successful migration:

1. **Test RBAC**: Assign roles to users and verify permissions
2. **Test Notifications**: Create a vendor/issue and check notifications appear
3. **Test Real-Time**: Subscribe to notifications in your React app
4. **Update Frontend**: Ensure hooks use the new notification schema

## Troubleshooting

### Migration Dependencies and Ordering

**CRITICAL**: Some migrations have dependencies on other migrations. Always apply migrations in the correct order to avoid errors.

#### Dependency Chain

```
20260320_master_consolidated_system.sql (MUST BE FIRST)
  ↓
20260321_finance_module_core.sql
  ↓
Future module migrations that use role system
```

**Master Migration Creates**:
- `custom_roles` table (Layer 2 designations)
- `role_assignments` table (user-designation mapping)
- `employee_invitations` table (HR onboarding)
- `notifications` table (real-time notifications)
- Helper functions for permissions and notifications

**Finance Migration Depends On**:
- `role_assignments` table (for RLS policies)
- `custom_roles` table (for permission checks)
- `employee_invitations` table (for onboarding integration)

#### Checking Migration Status

Before applying Finance Module migration, verify the master migration has been applied:

```sql
-- Check if role system tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('role_assignments', 'custom_roles', 'employee_invitations');

-- Expected result: 3 rows (all three tables)
-- If you get 0 rows, apply master migration first
```

#### Applying Migrations in Order

**Step 1: Apply Master Migration**
```bash
# Using Supabase CLI
supabase db push

# Or using psql directly
psql -d your_database -f supabase/migrations/20260320_master_consolidated_system.sql
```

**Step 2: Verify Master Migration Success**
```sql
-- Should return 3 tables
SELECT COUNT(*) FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations');
```

**Step 3: Apply Finance Migration**
```bash
# Using Supabase CLI
supabase db push

# Or using psql directly
psql -d your_database -f supabase/migrations/20260321_finance_module_core.sql
```

### Error: "relation does not exist"

**Symptom**: 
```
ERROR: 42P01: relation "role_assignments" does not exist
```

**Cause**: Finance Module migration was applied before master migration

**Solution**:
1. Check if master migration has been applied:
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename = 'role_assignments';
   ```

2. If table doesn't exist, apply master migration first:
   ```bash
   psql -d your_database -f supabase/migrations/20260320_master_consolidated_system.sql
   ```

3. Then apply Finance migration:
   ```bash
   psql -d your_database -f supabase/migrations/20260321_finance_module_core.sql
   ```

### Error: "relation does not exist"
- Ensure the profiles table exists before running
- Check that departments table exists (referenced by employee_invitations)

### Error: "function already exists"
- The migration drops functions before recreating them
- If error persists, manually drop the function:
  ```sql
  DROP FUNCTION IF EXISTS function_name CASCADE;
  ```

### Error: "publication does not exist"
- Create the publication first:
  ```sql
  CREATE PUBLICATION supabase_realtime;
  ```

## Support

For issues or questions, check:
- Supabase logs in dashboard
- PostgreSQL error messages
- RLS policy violations in auth logs
