# Two-Layer Role System Architecture

## Overview

Lazeez VORP implements a sophisticated 2-layer role system that separates basic access control from granular permissions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: MAIN ROLE                       │
│                  (Simple, Notification-based)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐         │
│  │  ADMIN   │      │ MANAGER  │      │ EMPLOYEE │         │
│  └──────────┘      └──────────┘      └──────────┘         │
│                                                              │
│  • Notifications   • Notifications   • Notifications        │
│  • Basic RLS       • Basic RLS       • Basic RLS            │
│  • UI Badges       • UI Badges       • UI Badges            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  LAYER 2: DESIGNATION                        │
│              (Granular, Permission-based)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Custom Designations (Created by Admin/HR):                 │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │ "Senior Developer" (employee)              │            │
│  │ • Department: Engineering                  │            │
│  │ • Permissions: projects.create, issues.edit│            │
│  │ • Assigned by: Engineering Manager         │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │ "HR Lead" (manager)                        │            │
│  │ • Department: HR                           │            │
│  │ • Permissions: hr.manage_employees, etc.   │            │
│  │ • Assigned by: HR Director                 │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
│  ┌────────────────────────────────────────────┐            │
│  │ "Finance Manager" (manager)                │            │
│  │ • Department: Finance                      │            │
│  │ • Permissions: finance.*, vendors.view     │            │
│  │ • Assigned by: CFO                         │            │
│  └────────────────────────────────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Main Role

### Purpose
- **Notification routing**: Determines who receives system notifications
- **Basic access control**: High-level RLS policies
- **UI display**: Simple role badges and indicators
- **Organizational hierarchy**: Admin → Manager → Employee

### Three Roles

#### 1. Admin
- **Access**: Full system access
- **Capabilities**: 
  - User management and approvals
  - System settings
  - Create/manage designations
  - View all data
- **Notifications**: All system-wide notifications
- **Example users**: CEO, CTO, System Administrator

#### 2. Manager
- **Access**: Department/team management
- **Capabilities**:
  - Manage team members
  - Approve leave requests
  - Assign designations to employees
  - View department data
- **Notifications**: Department-specific notifications
- **Example users**: Department Heads, Team Leads, HR Managers

#### 3. Employee
- **Access**: Standard employee access
- **Capabilities**:
  - Self-service (leave requests, profile updates)
  - View assigned tasks
  - Create issues
  - Limited data access
- **Notifications**: Personal notifications only
- **Example users**: Developers, Designers, Staff

### Storage
```sql
profiles.main_role VARCHAR(50)  -- 'admin', 'manager', 'employee'
```

## Layer 2: Designation

### Purpose
- **Granular permissions**: Fine-grained access control per module
- **Department-specific roles**: Roles tied to specific departments
- **Custom role creation**: Admins/HR create roles as needed
- **Permission inheritance**: Employees inherit permissions from designation

### Characteristics

#### Dynamic Creation
- **No pre-configured roles**: All designations created through UI
- **Admin/HR control**: Only admins and HR can create designations
- **Flexible structure**: Adapt to organizational needs

#### Department-Specific
- **Optional department link**: Designations can be department-specific
- **Manager assignment**: Department managers assign designations
- **Scoped access**: Permissions can be limited to department data

#### Permission-Based
- **Granular control**: Per-module, per-action permissions
- **JSONB structure**: Flexible permission schema
- **Aggregation**: Multiple designations = combined permissions

### Storage
```sql
-- Designation definition
custom_roles (
  id UUID,
  name VARCHAR(100),           -- e.g., "senior_developer"
  display_name VARCHAR(100),   -- e.g., "Senior Developer"
  description TEXT,
  main_role VARCHAR(50),       -- Links to Layer 1
  permissions JSONB,           -- Granular permissions
  department_id UUID,          -- Optional department restriction
  created_by UUID
)

-- User-designation mapping
role_assignments (
  user_id UUID,
  role_id UUID,
  assigned_by UUID
)

-- User profile
profiles.designation VARCHAR(100)  -- Display name from custom_roles
```

## Permission Structure

### JSONB Schema
```json
{
  "vendors": {
    "view": true,
    "create": false,
    "edit": false,
    "delete": false
  },
  "issues": {
    "view": true,
    "create": true,
    "edit": true,
    "delete": false
  },
  "mous": {
    "view": true,
    "create": false,
    "edit": false,
    "delete": false
  },
  "hr": {
    "view_all": false,
    "manage_employees": false,
    "manage_attendance": true,
    "manage_leave": true,
    "manage_appraisals": false
  },
  "finance": {
    "view": false,
    "manage_payments": false,
    "view_reports": false
  },
  "projects": {
    "view": true,
    "create": true,
    "manage": false
  },
  "analytics": {
    "view": false,
    "export": false
  },
  "admin": {
    "manage_users": false,
    "manage_roles": false,
    "system_settings": false
  }
}
```

### Permission Modules

#### Vendors
- `view`: View vendor list and details
- `create`: Create new vendors
- `edit`: Edit vendor information
- `delete`: Delete vendors

#### Issues
- `view`: View issues
- `create`: Create new issues
- `edit`: Edit issues
- `delete`: Delete issues

#### MOUs
- `view`: View MOUs
- `create`: Create new MOUs
- `edit`: Edit MOUs
- `delete`: Delete MOUs

#### HR
- `view_all`: View all employee data
- `manage_employees`: Manage employee profiles
- `manage_attendance`: Manage attendance records
- `manage_leave`: Approve/reject leave requests
- `manage_appraisals`: Conduct performance reviews

#### Finance
- `view`: View financial data
- `manage_payments`: Process payments
- `view_reports`: View financial reports

#### Projects
- `view`: View projects
- `create`: Create new projects
- `manage`: Manage project settings

#### Analytics
- `view`: View analytics dashboards
- `export`: Export analytics data

#### Admin
- `manage_users`: User management
- `manage_roles`: Role/designation management
- `system_settings`: System configuration

## Workflow Examples

### Example 1: Creating a "Senior Developer" Designation

**Step 1**: Admin creates designation
```sql
INSERT INTO custom_roles (name, display_name, description, main_role, department_id, permissions)
VALUES (
  'senior_developer',
  'Senior Developer',
  'Senior software developer with code review responsibilities',
  'employee',  -- Layer 1: employee
  (SELECT id FROM departments WHERE name = 'Engineering'),
  '{
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "projects": {"view": true, "create": true, "manage": false},
    "analytics": {"view": true, "export": false}
  }'::jsonb
);
```

**Step 2**: Engineering Manager assigns to employee
```sql
-- Assign designation
INSERT INTO role_assignments (user_id, role_id, assigned_by)
VALUES (
  'john-doe-uuid',
  (SELECT id FROM custom_roles WHERE name = 'senior_developer'),
  'manager-uuid'
);

-- Update profile
UPDATE profiles
SET 
  designation = 'Senior Developer',
  main_role = 'employee',
  department_id = (SELECT id FROM departments WHERE name = 'Engineering'),
  manager_id = 'manager-uuid'
WHERE id = 'john-doe-uuid';
```

**Step 3**: System checks permissions
```sql
-- Check if John can edit issues
SELECT has_permission('john-doe-uuid', 'issues.edit');  -- Returns true

-- Check if John can delete vendors
SELECT has_permission('john-doe-uuid', 'vendors.delete');  -- Returns false
```

### Example 2: HR Lead with Manager Access

**Step 1**: Admin creates HR Lead designation
```sql
INSERT INTO custom_roles (name, display_name, description, main_role, department_id, permissions)
VALUES (
  'hr_lead',
  'HR Lead',
  'HR team lead with employee management capabilities',
  'manager',  -- Layer 1: manager (gets manager notifications)
  (SELECT id FROM departments WHERE name = 'HR'),
  '{
    "vendors": {"view": true, "create": false, "edit": false, "delete": false},
    "issues": {"view": true, "create": true, "edit": true, "delete": false},
    "hr": {"view_all": true, "manage_employees": true, "manage_attendance": true, "manage_leave": true, "manage_appraisals": true},
    "analytics": {"view": true, "export": true},
    "admin": {"manage_users": false, "manage_roles": true, "system_settings": false}
  }'::jsonb
);
```

**Step 2**: HR Director assigns to HR employee
```sql
INSERT INTO role_assignments (user_id, role_id, assigned_by)
VALUES (
  'jane-smith-uuid',
  (SELECT id FROM custom_roles WHERE name = 'hr_lead'),
  'hr-director-uuid'
);

UPDATE profiles
SET 
  designation = 'HR Lead',
  main_role = 'manager',  -- Gets manager-level notifications
  department_id = (SELECT id FROM departments WHERE name = 'HR'),
  manager_id = 'hr-director-uuid'
WHERE id = 'jane-smith-uuid';
```

**Result**: Jane receives:
- Manager-level notifications (Layer 1)
- HR management permissions (Layer 2)
- Can approve leave requests
- Can manage employee profiles

## UI Implementation

### Role Badge Display
```tsx
// Show Layer 1 role for notifications
<Badge variant={mainRole === 'admin' ? 'destructive' : mainRole === 'manager' ? 'default' : 'secondary'}>
  {mainRole}
</Badge>

// Show Layer 2 designation for detailed info
<span className="text-sm text-muted-foreground">
  {designation || 'No designation assigned'}
</span>
```

### Permission Checks
```tsx
// Check Layer 2 permission before showing UI element
const canCreateVendor = hasPermission(userId, 'vendors.create');

{canCreateVendor && (
  <Button onClick={handleCreateVendor}>
    Create Vendor
  </Button>
)}
```

### Notification Routing
```tsx
// Layer 1 determines notification recipients
if (mainRole === 'admin') {
  // Send to all admins
  notifyUsers(getAdminIds(), notification);
} else if (mainRole === 'manager') {
  // Send to department managers
  notifyUsers(getDepartmentManagers(departmentId), notification);
}
```

## Benefits

### Separation of Concerns
- **Layer 1**: Simple, stable, notification-focused
- **Layer 2**: Complex, flexible, permission-focused

### Scalability
- Add new designations without changing core system
- Department-specific roles without code changes
- Permission granularity as needed

### Flexibility
- Admins create roles on-demand
- Managers assign designations to team
- Permissions adapt to organizational changes

### Clarity
- Clear notification routing (Layer 1)
- Precise access control (Layer 2)
- Easy to understand and maintain

## Migration Path

### From Old System
If you have existing generic text-based designations:

```sql
-- Migrate existing designations to custom_roles
INSERT INTO custom_roles (name, display_name, description, main_role, permissions, created_by)
SELECT 
  LOWER(REPLACE(designation, ' ', '_')),  -- name
  designation,                             -- display_name
  'Migrated from old system',             -- description
  'employee',                              -- default to employee
  '{}'::jsonb,                            -- empty permissions (to be configured)
  (SELECT id FROM profiles WHERE main_role = 'admin' LIMIT 1)  -- created_by
FROM profiles
WHERE designation IS NOT NULL
GROUP BY designation;

-- Create role assignments
INSERT INTO role_assignments (user_id, role_id, assigned_by)
SELECT 
  p.id,
  cr.id,
  (SELECT id FROM profiles WHERE main_role = 'admin' LIMIT 1)
FROM profiles p
JOIN custom_roles cr ON cr.display_name = p.designation
WHERE p.designation IS NOT NULL;
```

## Best Practices

### 1. Layer 1 Assignment
- Assign based on organizational hierarchy
- Keep it simple: admin, manager, or employee
- Don't overthink Layer 1 - it's just for notifications

### 2. Layer 2 Creation
- Create designations as needed
- Be specific with permissions
- Document designation purpose
- Link to department when appropriate

### 3. Permission Design
- Start restrictive, add permissions as needed
- Group related permissions
- Test permission combinations
- Document permission rationale

### 4. Assignment Workflow
- Managers assign designations to their team
- HR/Admin creates new designations
- Regular permission audits
- Update permissions as roles evolve
