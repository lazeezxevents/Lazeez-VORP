# RBAC & Employee Onboarding System - Technical Specification

## Executive Summary

This document outlines the implementation of a comprehensive Role-Based Access Control (RBAC) system with dual employee onboarding flows for the Lazeez VORP platform.

---

## Current Issues

1. **Security Gap**: Employees can currently change their own designation and department
2. **Missing RBAC**: No granular permission control system
3. **Incomplete Onboarding**: Two onboarding flows need proper implementation:
   - Self-signup with approval workflow
   - HR-initiated invitation flow

---

## System Architecture

### 1. RBAC System

#### Database Schema

```sql
-- Custom Roles Table (HR creates these)
CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Role Assignments Table
CREATE TABLE role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Permission Categories
permissions JSONB structure:
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
    "create": false,
    "edit": false,
    "delete": false
  },
  "hr": {
    "view_all": false,
    "manage_employees": false,
    "manage_attendance": false,
    "manage_leave": false,
    "manage_appraisals": false
  },
  "finance": {
    "view": false,
    "manage_payments": false,
    "view_reports": false
  },
  "projects": {
    "view": true,
    "create": false,
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

#### System Roles (Pre-defined)

1. **Admin**
   - Full system access
   - User approval rights
   - Role management
   - System configuration

2. **HR Manager**
   - Employee management
   - Role assignment
   - Attendance/Leave management
   - Performance reviews
   - Onboarding workflow

3. **Manager**
   - Department-level access
   - Team management
   - Approval workflows
   - Performance reviews (team only)

4. **Employee**
   - Self-service access
   - Task management
   - Time tracking
   - Leave requests

5. **Vendor Manager**
   - Vendor operations
   - MOU management
   - Issue tracking

---

### 2. Employee Onboarding Flows

#### Flow A: Self-Signup with Approval

```
User Signs Up
    ↓
Email Verification (Supabase Auth)
    ↓
Profile Created (is_approved = false, role = null)
    ↓
Admin Notification (Pending Approval)
    ↓
Admin Reviews & Approves
    ↓
HR Notification (Assign Role & Department)
    ↓
HR Assigns:
  - Role/Designation
  - Department
  - Manager/Reporting Lead
    ↓
User Notified (Account Activated)
    ↓
User Logs In (Full Access Based on Role)
```

**Database Changes:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
-- Values: 'pending', 'admin_approved', 'hr_approved', 'rejected'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
```

#### Flow B: HR-Initiated Invitation

```
HR Creates Invitation
    ↓
HR Fills Form:
  - Employee Name
  - Email
  - Role/Designation
  - Department
  - Manager/Reporting Lead
    ↓
Invitation Record Created
    ↓
Branded Email Sent (Supabase Edge Function)
    ↓
Employee Clicks Link
    ↓
Custom Onboarding Page
    ↓
Employee Sets Password
    ↓
Profile Auto-Created (pre-approved)
    ↓
Admin Notification (Final Approval)
    ↓
Admin Approves
    ↓
Employee Notified (Account Activated)
    ↓
Employee Logs In (Full Access)
```

**Database Schema:**
```sql
CREATE TABLE employee_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES custom_roles(id),
  department_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES profiles(id),
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'accepted', 'expired', 'cancelled'
  metadata JSONB
);
```

---

## Implementation Plan

### Phase 1: Database Setup (Priority: Critical)

**Files to Create:**
1. `supabase/migrations/20260316_rbac_system.sql`
   - Create custom_roles table
   - Create role_assignments table
   - Insert system roles
   - Add RLS policies

2. `supabase/migrations/20260316_onboarding_enhancements.sql`
   - Add approval_status columns to profiles
   - Create employee_invitations table
   - Add RLS policies

**Tasks:**
- [ ] Create migration files
- [ ] Add RLS policies for security
- [ ] Seed system roles
- [ ] Test migrations

---

### Phase 2: Backend - Edge Functions (Priority: High)

**Files to Create:**

1. `supabase/functions/send-invitation-email/index.ts`
   - Send branded invitation email
   - Generate secure token
   - Email template with Lazeez branding

2. `supabase/functions/send-approval-notification/index.ts`
   - Notify admin of pending approvals
   - Notify HR of role assignment tasks
   - Notify employee of account activation

**Email Templates:**
```html
<!-- Invitation Email -->
Subject: Welcome to Lazeez VORP - Complete Your Account Setup

Dear [Employee Name],

You've been invited to join Lazeez Events VORP platform!

Your Details:
- Role: [Designation]
- Department: [Department Name]
- Manager: [Manager Name]

Click the link below to set your password and activate your account:
[Secure Link with Token]

This link expires in 7 days.

Best regards,
Lazeez Events Team
```

---

### Phase 3: Frontend - Role Management (Priority: High)

**Files to Create:**

1. `src/components/hr/RoleManagement.tsx`
   - Role creation form
   - Permission matrix UI
   - Role listing with edit/delete
   - System role indicators

2. `src/components/hr/PermissionMatrix.tsx`
   - Visual permission grid
   - Category-based permissions
   - Toggle switches for each permission

3. `src/hooks/useRoles.ts`
   - CRUD operations for roles
   - Role assignment logic
   - Permission checking utilities

**UI Components:**
- Role creation dialog
- Permission matrix (checkbox grid)
- Role assignment dropdown
- Role badge display

---

### Phase 4: Frontend - Onboarding Flows (Priority: High)

**Files to Create:**

1. `src/pages/InviteEmployee.tsx` (HR Only)
   - Invitation form
   - Role/Department selection
   - Manager assignment
   - Send invitation button

2. `src/pages/AcceptInvitation.tsx` (Public)
   - Token validation
   - Display pre-filled info
   - Password creation form
   - Account activation

3. `src/pages/UserApprovals.tsx` (Enhancement)
   - Two-stage approval UI
   - Admin approval section
   - HR role assignment section
   - Rejection with reason

4. `src/components/onboarding/InvitationForm.tsx`
   - Multi-step form
   - Role selector
   - Department selector
   - Manager selector

**Files to Modify:**

1. `src/pages/Settings.tsx`
   - Remove designation/department edit for non-HR
   - Add read-only display
   - Show assigned role and permissions

2. `src/contexts/AuthContext.tsx`
   - Add permission checking functions
   - Load user roles and permissions
   - hasPermission(category, action) utility

---

### Phase 5: Security Enhancements (Priority: Critical)

**Files to Modify:**

1. `src/pages/Settings.tsx`
```tsx
// Current: Employee can edit designation/department
// New: Only HR can edit these fields

{(isHR || isAdmin) ? (
  <Select value={designation} onChange={handleChange}>
    {/* Editable */}
  </Select>
) : (
  <div className="text-sm text-muted-foreground">
    {designation}
  </div>
)}
```

2. Add RLS Policies:
```sql
-- Profiles: Users can only update their own non-sensitive fields
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Prevent changing these fields
  (OLD.role = NEW.role OR NEW.role IS NULL) AND
  (OLD.department_id = NEW.department_id OR NEW.department_id IS NULL) AND
  (OLD.designation = NEW.designation OR NEW.designation IS NULL)
);

-- HR can update employee roles/departments
CREATE POLICY "HR can update employee details"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (role = 'hr' OR role = 'admin')
  )
);
```

---

### Phase 6: Permission Checking System (Priority: High)

**Files to Create:**

1. `src/lib/permissions.ts`
```typescript
export const PERMISSIONS = {
  VENDORS: {
    VIEW: 'vendors.view',
    CREATE: 'vendors.create',
    EDIT: 'vendors.edit',
    DELETE: 'vendors.delete',
  },
  ISSUES: {
    VIEW: 'issues.view',
    CREATE: 'issues.create',
    EDIT: 'issues.edit',
    DELETE: 'issues.delete',
  },
  HR: {
    VIEW_ALL: 'hr.view_all',
    MANAGE_EMPLOYEES: 'hr.manage_employees',
    MANAGE_ATTENDANCE: 'hr.manage_attendance',
    MANAGE_LEAVE: 'hr.manage_leave',
  },
  ADMIN: {
    MANAGE_USERS: 'admin.manage_users',
    MANAGE_ROLES: 'admin.manage_roles',
  }
};

export function hasPermission(
  userPermissions: any,
  permission: string
): boolean {
  const [category, action] = permission.split('.');
  return userPermissions?.[category]?.[action] === true;
}
```

2. `src/hooks/usePermissions.ts`
```typescript
export function usePermissions() {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    // Load user's role permissions
    loadPermissions();
  }, [profile]);

  const can = (permission: string) => {
    return hasPermission(permissions, permission);
  };

  return { permissions, can };
}
```

---

## UI/UX Specifications

### Role Management Interface

**Location:** `/hr-performance` → "Roles" tab

**Features:**
1. Role listing table
   - Role name
   - Description
   - Number of users
   - System role indicator
   - Actions (Edit, Delete, Assign)

2. Create/Edit Role Dialog
   - Role name input
   - Description textarea
   - Permission matrix (expandable categories)
   - Save/Cancel buttons

3. Permission Matrix
   - Category headers (Vendors, Issues, MOUs, HR, Finance, etc.)
   - Permission checkboxes (View, Create, Edit, Delete)
   - Visual grouping with borders
   - Select all per category

### User Approval Interface

**Location:** `/user-approvals`

**Two-Stage Approval:**

**Stage 1: Admin Approval**
- Pending users list
- User details (name, email, signup date)
- Approve/Reject buttons
- Rejection reason dialog

**Stage 2: HR Role Assignment**
- Admin-approved users list
- Role assignment dropdown
- Department assignment dropdown
- Manager assignment dropdown
- Submit button

### Invitation Interface

**Location:** `/hr-performance` → "Invite Employee" button

**Form Fields:**
1. Employee Information
   - Full name
   - Email address
   - Phone number (optional)

2. Role & Department
   - Role/Designation dropdown
   - Department dropdown
   - Team dropdown (optional)

3. Reporting Structure
   - Manager/Reporting lead dropdown
   - Secondary manager (optional)

4. Additional Details
   - Start date
   - Employment type (Full-time, Part-time, Contract)
   - Notes (optional)

### Invitation Acceptance Page

**Location:** `/accept-invitation/:token` (Public)

**Layout:**
1. Lazeez branding header
2. Welcome message with employee name
3. Pre-filled information display:
   - Role/Designation
   - Department
   - Manager
4. Password creation form:
   - Password input (with strength indicator)
   - Confirm password input
   - Password requirements checklist
5. Terms acceptance checkbox
6. "Activate Account" button

---

## Security Considerations

### 1. Row Level Security (RLS)

**Profiles Table:**
- Users can view their own profile
- HR/Admin can view all profiles
- Users cannot edit role/department/designation
- HR/Admin can edit employee details

**Custom Roles Table:**
- All authenticated users can view roles
- Only HR/Admin can create/edit/delete roles

**Role Assignments Table:**
- Users can view their own assignments
- HR/Admin can view/manage all assignments

### 2. API Security

**Edge Functions:**
- Validate invitation tokens
- Check token expiration
- Verify sender permissions
- Rate limiting on email sends

### 3. Frontend Security

**Protected Routes:**
- Role management: HR/Admin only
- User approvals: Admin only
- Invite employee: HR/Admin only

**UI Elements:**
- Hide edit buttons for non-permitted users
- Disable form fields based on permissions
- Show read-only views for restricted data

---

## Testing Checklist

### RBAC System
- [ ] Create custom role with specific permissions
- [ ] Assign role to user
- [ ] Verify permission checks work
- [ ] Test permission inheritance
- [ ] Test role deletion (reassign users first)

### Self-Signup Flow
- [ ] User signs up
- [ ] Admin receives notification
- [ ] Admin approves user
- [ ] HR receives notification
- [ ] HR assigns role/department/manager
- [ ] User receives activation email
- [ ] User logs in with correct permissions

### Invitation Flow
- [ ] HR creates invitation
- [ ] Email sent with correct branding
- [ ] Token validation works
- [ ] Password creation successful
- [ ] Admin approval required
- [ ] User activated with correct role

### Security
- [ ] Employee cannot edit own designation
- [ ] Employee cannot edit own department
- [ ] Non-HR cannot access role management
- [ ] Non-admin cannot approve users
- [ ] RLS policies prevent unauthorized access

---

## Migration Strategy

### Step 1: Database Migration
1. Run RBAC migration
2. Run onboarding enhancement migration
3. Seed system roles
4. Verify RLS policies

### Step 2: Backend Deployment
1. Deploy edge functions
2. Test email sending
3. Verify token generation

### Step 3: Frontend Deployment
1. Deploy role management UI
2. Deploy onboarding flows
3. Update settings page security
4. Test permission checks

### Step 4: Data Migration
1. Assign existing users to appropriate roles
2. Update existing profiles with approval status
3. Verify all users have correct permissions

---

## Future Enhancements

1. **Audit Trail**
   - Log all role changes
   - Track permission modifications
   - Monitor approval actions

2. **Bulk Operations**
   - Bulk role assignment
   - Bulk user import
   - CSV upload for invitations

3. **Advanced Permissions**
   - Time-based permissions
   - Location-based access
   - Conditional permissions

4. **Self-Service**
   - Role request workflow
   - Permission request system
   - Temporary access grants

---

## Conclusion

This RBAC and onboarding system provides:
- ✅ Secure role-based access control
- ✅ Granular permission management
- ✅ Two-stage approval workflow
- ✅ HR-initiated invitation flow
- ✅ Self-signup with approval
- ✅ Prevention of unauthorized profile changes
- ✅ Comprehensive audit trail
- ✅ Scalable permission system

The implementation follows enterprise security best practices and provides a foundation for future access control enhancements.
