# RBAC & Employee Onboarding System Implementation

## Overview

This document describes the implementation of the Role-Based Access Control (RBAC) system and Employee Onboarding workflows for Lazeez VORP.

## Architecture

### Two-Layer Role System

**Layer 1: Main Role** (Base Access Level)
- `admin` - Administrative access
- `manager` - Management access (HR, Department, Vendor managers)
- `employee` - Standard employee access

**Layer 2: Designation** (Granular Permissions)
- Custom roles created by HR with specific permission sets
- Links to `custom_roles` table
- Provides fine-grained access control

### Key Concepts

1. **Main Role**: Stored in `profiles.main_role` - determines base access level
2. **Designation**: Stored in `profiles.designation` - display name of the role
3. **Role Assignment**: Links users to custom roles via `role_assignments` table
4. **Permissions**: JSONB structure defining granular access rights

## Database Schema

### New Tables

#### `custom_roles`
Stores role definitions with permissions.

```sql
- id: UUID (PK)
- name: VARCHAR(100) UNIQUE (e.g., 'hr_manager')
- display_name: VARCHAR(100) (e.g., 'HR Manager')
- description: TEXT
- main_role: VARCHAR(50) ('admin', 'manager', 'employee')
- permissions: JSONB (permission structure)
- is_system_role: BOOLEAN (prevents deletion)
- created_by: UUID (FK to profiles)
- created_at, updated_at: TIMESTAMP
```


#### `role_assignments`
Maps users to their assigned roles.

```sql
- id: UUID (PK)
- user_id: UUID (FK to profiles)
- role_id: UUID (FK to custom_roles)
- assigned_by: UUID (FK to profiles)
- assigned_at: TIMESTAMP
- UNIQUE(user_id, role_id)
```

#### `employee_invitations`
Stores HR-initiated employee invitations.

```sql
- id: UUID (PK)
- email: VARCHAR(255) UNIQUE
- full_name: VARCHAR(255)
- phone: VARCHAR(50)
- role_id: UUID (FK to custom_roles)
- department_id: UUID (FK to departments)
- team_id: UUID
- manager_id: UUID (FK to profiles)
- secondary_manager_id: UUID (FK to profiles)
- start_date: DATE
- employment_type: VARCHAR(50)
- invitation_token: VARCHAR(255) UNIQUE
- invited_by: UUID (FK to profiles)
- invited_at, expires_at, accepted_at: TIMESTAMP
- status: VARCHAR(20) ('pending', 'accepted', 'expired', 'cancelled')
- notes: TEXT
- metadata: JSONB
```

### Modified Tables

#### `profiles` - New Columns
- `main_role`: VARCHAR(50) - Base role (admin/manager/employee)
- `designation`: VARCHAR(100) - Display name from custom_roles
- `department_id`: UUID - Department assignment
- `is_approved`: BOOLEAN - Overall approval status
- `approval_status`: VARCHAR(20) - Workflow status
- `admin_approved_by`, `admin_approved_at`: Admin approval tracking
- `hr_approved_by`, `hr_approved_at`: HR approval tracking
- `rejection_reason`: TEXT - Reason if rejected
- `onboarding_type`: VARCHAR(20) - 'self_signup' or 'hr_invitation'
- `manager_id`: UUID - Reporting manager


## Permission Structure

Permissions are stored as JSONB with the following structure:

```json
{
  "vendors": {
    "view": true,
    "create": true,
    "edit": true,
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
    "create": true,
    "edit": true,
    "delete": false
  },
  "hr": {
    "view_all": true,
    "manage_employees": true,
    "manage_attendance": true,
    "manage_leave": true,
    "manage_appraisals": true
  },
  "finance": {
    "view": true,
    "manage_payments": true,
    "view_reports": true
  },
  "projects": {
    "view": true,
    "create": true,
    "manage": true
  },
  "analytics": {
    "view": true,
    "export": true
  },
  "admin": {
    "manage_users": true,
    "manage_roles": true,
    "system_settings": true
  }
}
```

## System Roles

Six predefined system roles are created during migration:

### Admin Roles
1. **System Administrator** (`system_admin`)
   - Main Role: admin
   - Full system access with all permissions

### Manager Roles
2. **HR Manager** (`hr_manager`)
   - Main Role: manager
   - Full HR access, role management, analytics

3. **Department Manager** (`department_manager`)
   - Main Role: manager
   - Team oversight, attendance, leave, appraisals

4. **Vendor Manager** (`vendor_manager`)
   - Main Role: manager
   - Vendor operations, MOUs, finance, analytics

### Employee Roles
5. **Employee** (`standard_employee`)
   - Main Role: employee
   - Self-service access, view-only for most modules

6. **Senior Employee** (`senior_employee`)
   - Main Role: employee
   - Extended access for creating vendors, issues, projects


## Onboarding Workflows

### Workflow 1: Self-Signup (Employee Initiated)

1. **User Signs Up**
   - Creates account via signup form
   - Profile created with `approval_status = 'pending'`
   - `onboarding_type = 'self_signup'`
   - `is_approved = false`

2. **Admin Approval (Step 1)**
   - Admin reviews pending users in User Approvals page
   - Admin approves → `approval_status = 'admin_approved'`
   - Admin rejects → `approval_status = 'rejected'` with reason
   - Function: `admin_approve_user(target_user_id, approver_id)`

3. **HR Assignment (Step 2)**
   - HR sees admin-approved users
   - HR assigns:
     - Role/Designation (from custom_roles)
     - Department
     - Manager/Reporting Lead
   - Updates `approval_status = 'hr_approved'`
   - Sets `is_approved = true`
   - Function: `hr_complete_approval(target_user_id, approver_id, role_id, department_id, designation, manager_id)`

4. **User Access Granted**
   - User can now access VORP with assigned permissions

### Workflow 2: HR Invitation (HR Initiated)

1. **HR Creates Invitation**
   - HR fills invitation form with:
     - Employee email, name, phone
     - Role/Designation
     - Department, Team
     - Manager (reporting lead)
     - Start date, employment type
   - System generates secure invitation token
   - Invitation expires in 7 days
   - Record created in `employee_invitations`

2. **Email Sent**
   - Branded Lazeez email sent via Supabase Edge Function
   - Includes:
     - Employee name
     - Role/Designation
     - Department
     - Manager name and position (with avatar if available)
     - Start date
     - Secure invitation link
   - Edge Function: `send-invitation-email`

3. **Employee Accepts Invitation**
   - Clicks link in email
   - Redirected to password creation screen
   - Creates password
   - Function: `accept_invitation(token, user_id, password_hash)`
   - Profile updated with:
     - Pre-assigned role, department, manager
     - `approval_status = 'admin_approved'` (HR pre-approved)
     - `onboarding_type = 'hr_invitation'`

4. **Admin Final Approval**
   - Admin reviews HR-invited users
   - Admin approves → `approval_status = 'hr_approved'`, `is_approved = true`
   - Function: `admin_approve_user(target_user_id, approver_id)`

5. **User Access Granted**
   - User can now access VORP with assigned permissions


## Database Functions

### Permission Functions

#### `get_user_permissions(user_uuid UUID) RETURNS JSONB`
Returns aggregated permissions from all assigned roles for a user.

```sql
SELECT get_user_permissions('user-uuid-here');
-- Returns: {"vendors": {"view": true, "create": true, ...}, ...}
```

#### `has_permission(user_uuid UUID, permission_path TEXT) RETURNS BOOLEAN`
Checks if a user has a specific permission.

```sql
SELECT has_permission(auth.uid(), 'vendors.create');
-- Returns: true or false
```

### Invitation Functions

#### `generate_invitation_token() RETURNS TEXT`
Generates a secure random token for invitations.

#### `is_invitation_valid(token TEXT) RETURNS BOOLEAN`
Checks if an invitation token is valid and not expired.

#### `accept_invitation(token TEXT, user_id UUID, password_hash TEXT) RETURNS JSONB`
Processes invitation acceptance and updates user profile.

### Approval Functions

#### `admin_approve_user(target_user_id UUID, approver_id UUID) RETURNS JSONB`
Admin approval step in onboarding workflow.

#### `hr_complete_approval(...) RETURNS JSONB`
HR completes approval by assigning role, department, and manager.

#### `reject_user(target_user_id UUID, rejector_id UUID, reason TEXT) RETURNS JSONB`
Rejects a user signup with reason.

### Maintenance Functions

#### `expire_old_invitations() RETURNS INTEGER`
Marks expired invitations as expired (should be run via cron job).


## Row Level Security (RLS)

### custom_roles Table
- **SELECT**: All authenticated users can view roles
- **INSERT**: Only HR and Admin can create roles
- **UPDATE**: Only HR and Admin can update non-system roles
- **DELETE**: Only Admin can delete non-system roles

### role_assignments Table
- **SELECT**: Users can view own assignments; HR/Admin can view all
- **INSERT/UPDATE/DELETE**: Only HR and Admin

### employee_invitations Table
- **ALL**: Only HR and Admin can manage invitations

### profiles Table (Updated)
- **UPDATE (Limited)**: Users can update own profile but NOT:
  - main_role
  - department_id
  - designation
  - approval_status
  - admin_approved_by/hr_approved_by
  - manager_id
- **UPDATE (Full)**: HR and Admin can update all employee details

## Security Considerations

1. **System Roles Protection**: System roles have `is_system_role = true` and cannot be deleted or modified
2. **Token Security**: Invitation tokens are 32-byte random values, base64 encoded
3. **Expiration**: Invitations expire after 7 days
4. **Approval Chain**: Two-step approval ensures oversight (Admin → HR or HR → Admin)
5. **RLS Enforcement**: All sensitive operations protected by Row Level Security
6. **Function Security**: All functions use `SECURITY DEFINER` with proper permission checks


## Migration Files

### 1. `20260316_rbac_system_v2.sql`
Creates the RBAC infrastructure:
- Adds columns to profiles table
- Creates custom_roles and role_assignments tables
- Inserts 6 system roles
- Sets up RLS policies
- Creates permission functions

### 2. `20260316_onboarding_enhancements_v2.sql`
Creates the onboarding infrastructure:
- Adds approval columns to profiles
- Creates employee_invitations table
- Updates RLS policies for profiles
- Creates invitation and approval functions

### Running Migrations

```bash
# Apply migrations in order
supabase db push

# Or manually
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260316_rbac_system_v2.sql
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260316_onboarding_enhancements_v2.sql
```

## Edge Function Setup

### Send Invitation Email Function

**Location**: `supabase/functions/send-invitation-email/index.ts`

**Environment Variables Required**:
```env
RESEND_API_KEY=your_resend_api_key
APP_URL=https://your-app-url.com
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Deploy**:
```bash
supabase functions deploy send-invitation-email
```

**Usage**:
```typescript
const { data, error } = await supabase.functions.invoke('send-invitation-email', {
  body: { invitationId: 'uuid-here' }
})
```


## Frontend Integration Guide

### Checking Permissions in React

```typescript
// In AuthContext or custom hook
const checkPermission = (category: string, action: string): boolean => {
  const { data } = await supabase.rpc('has_permission', {
    user_uuid: user.id,
    permission_path: `${category}.${action}`
  })
  return data || false
}

// Usage in components
const canCreateVendor = await checkPermission('vendors', 'create')
```

### Getting User Permissions

```typescript
const getUserPermissions = async (userId: string) => {
  const { data } = await supabase.rpc('get_user_permissions', {
    user_uuid: userId
  })
  return data // Returns full permission object
}
```

### Creating Custom Roles (HR/Admin)

```typescript
const createCustomRole = async (roleData: {
  name: string
  display_name: string
  description: string
  main_role: 'admin' | 'manager' | 'employee'
  permissions: object
}) => {
  const { data, error } = await supabase
    .from('custom_roles')
    .insert(roleData)
    .select()
    .single()
  
  return { data, error }
}
```

### Assigning Roles to Users

```typescript
const assignRole = async (userId: string, roleId: string) => {
  const { data, error } = await supabase
    .from('role_assignments')
    .insert({
      user_id: userId,
      role_id: roleId,
      assigned_by: currentUser.id
    })
  
  return { data, error }
}
```

### Creating Employee Invitation

```typescript
const createInvitation = async (invitationData: {
  email: string
  full_name: string
  phone?: string
  role_id: string
  department_id: string
  manager_id?: string
  start_date?: string
  employment_type?: string
}) => {
  // Generate token
  const { data: tokenData } = await supabase.rpc('generate_invitation_token')
  
  // Create invitation
  const { data, error } = await supabase
    .from('employee_invitations')
    .insert({
      ...invitationData,
      invitation_token: tokenData,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invited_by: currentUser.id
    })
    .select()
    .single()
  
  if (error) return { data: null, error }
  
  // Send email
  const { data: emailData, error: emailError } = await supabase.functions.invoke(
    'send-invitation-email',
    { body: { invitationId: data.id } }
  )
  
  return { data, error: emailError }
}
```

### Admin Approval

```typescript
const approveUser = async (userId: string) => {
  const { data, error } = await supabase.rpc('admin_approve_user', {
    target_user_id: userId,
    approver_id: currentUser.id
  })
  
  return { data, error }
}
```

### HR Complete Approval

```typescript
const completeHRApproval = async (
  userId: string,
  roleId: string,
  departmentId: string,
  designation: string,
  managerId?: string
) => {
  const { data, error } = await supabase.rpc('hr_complete_approval', {
    target_user_id: userId,
    approver_id: currentUser.id,
    assigned_role_id: roleId,
    assigned_department_id: departmentId,
    assigned_designation: designation,
    assigned_manager_id: managerId
  })
  
  return { data, error }
}
```

### Reject User

```typescript
const rejectUser = async (userId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_user', {
    target_user_id: userId,
    rejector_id: currentUser.id,
    reason: reason
  })
  
  return { data, error }
}
```


## UI Components Needed

### 1. User Approvals Page (Admin)
**Location**: `src/pages/UserApprovals.tsx`

**Features**:
- List of pending users (approval_status = 'pending')
- List of admin-approved users waiting for HR (approval_status = 'admin_approved')
- Approve/Reject actions
- View user details
- Filter by onboarding type (self_signup vs hr_invitation)

### 2. HR Role Management Page
**Location**: `src/pages/Settings.tsx` (new tab) or `src/pages/HRRoleManagement.tsx`

**Features**:
- List all custom roles
- Create new role with permission builder
- Edit non-system roles
- Delete non-system roles
- View role assignments

### 3. Employee Invitation Form
**Location**: `src/components/hr/EmployeeInvitationForm.tsx`

**Features**:
- Email, name, phone inputs
- Role/designation selector (from custom_roles)
- Department selector
- Manager selector (from profiles)
- Start date picker
- Employment type selector
- Send invitation button

### 4. Pending HR Approvals (HR)
**Location**: `src/components/hr/PendingApprovals.tsx`

**Features**:
- List admin-approved users
- Assign role/designation
- Assign department
- Assign manager
- Complete approval button

### 5. Accept Invitation Page
**Location**: `src/pages/AcceptInvitation.tsx`

**Features**:
- Display invitation details (read-only)
- Password creation form
- Accept invitation button
- Token validation

### 6. Permission Settings Tab
**Location**: `src/pages/Settings.tsx` (Permissions tab)

**Features**:
- View own permissions
- View assigned roles
- Request role changes (future)

### 7. Role Assignment Interface (HR/Admin)
**Location**: `src/components/hr/RoleAssignment.tsx`

**Features**:
- User selector
- Role selector (from custom_roles)
- Assign button
- View current assignments
- Remove assignment

