# Complete Onboarding System Implementation Guide

## Overview

This guide provides a comprehensive overview of the complete 2-layer role system onboarding implementation for Lazeez VORP.

## What's Been Created

### 1. Database Migration (READY TO RUN)
**File**: `supabase/migrations/20260326_admin_setup_and_role_promotion.sql`

This migration includes:
- ✅ Sales Executive designation (admin-level, exceptional case)
- ✅ HR Manager designation (manager-level)
- ✅ Finance Manager, Accountant, Department Manager, Team Lead designations
- ✅ Admin account setup (highypestudio@gmail.com)
- ✅ Automatic role promotion trigger (`sync_main_role_from_designation()`)

**To Apply**:
```bash
# Run in Supabase SQL Editor or via CLI
supabase db push
```

### 2. Feature Spec (COMPLETE)
**Location**: `.kiro/specs/complete-onboarding-system/`

Contains:
- ✅ Requirements document (12 requirements, 60+ acceptance criteria)
- ✅ Design document (architecture, components, 27 correctness properties)
- ✅ Implementation tasks (17 tasks, 60+ sub-tasks)

## System Architecture

### Two Onboarding Flows

#### Flow 1: Self-Signup (Employee Initiates)
```
Employee Signs Up
    ↓
Profile Created (is_approved=false, main_role='employee')
    ↓
Redirect to Approval Pending Page (NEW - needs to be built)
    ↓
Admin Approves in UserApprovals Page (EXISTS)
    ↓
HR Assigns Designation (EXISTS)
    ↓
Automatic Role Promotion (if designation requires manager)
    ↓
User Gets Access
```

#### Flow 2: HR Invitation (HR Initiates)
```
HR Creates Invitation (NEW - needs to be built)
    ↓
Email Sent with Invitation Link (NEW - needs email service)
    ↓
Employee Clicks Link → Set Password Page (NEW - needs to be built)
    ↓
Employee Sets Password
    ↓
Account Created (is_approved=true, pre-approved)
    ↓
Designation Assigned Automatically
    ↓
Automatic Role Promotion (if designation requires manager)
    ↓
Admin Approves (optional final step)
    ↓
User Gets Access
```

### Automatic Role Promotion

When a designation is assigned to a user:
- If designation.main_role = 'manager' AND user.main_role = 'employee'
  → User promoted to manager
- If designation.main_role = 'employee' AND user.main_role = 'manager'
  → User demoted to employee
- Admin users are NEVER affected (main_role stays 'admin')

This is handled by the database trigger `sync_main_role_from_designation()`.

## What Needs to Be Built

### Frontend Components (Priority Order)

1. **ApprovalPending Page** (`src/pages/ApprovalPending.tsx`)
   - Shows approval status for pending users
   - Auto-refreshes every 30 seconds
   - Displays user info and expected timeline
   - Provides logout option

2. **SetPassword Page** (`src/pages/SetPassword.tsx`)
   - Validates invitation token
   - Shows employee email and designation
   - Password input with strength validation
   - Creates account and redirects to login

3. **InvitationManagement Component** (`src/components/hr/InvitationManagement.tsx`)
   - HR interface for creating invitations
   - Table showing all invitations with status
   - Filter by status (pending, accepted, expired, revoked)
   - Search by email or department
   - Resend/revoke actions

4. **AuthContext Updates** (`src/components/contexts/AuthContext.tsx`)
   - Add redirect logic based on approval status
   - Redirect unapproved users to `/approval-pending`
   - Redirect approved users to `/dashboard`
   - Add `refreshProfile()` method

### Backend Components

1. **Email Service** (Supabase Edge Function)
   - Send invitation emails via Resend API
   - Professional email template with branding
   - Handle delivery failures and retries
   - Location: `supabase/functions/send-invitation-email/`

2. **Custom Hook** (`src/components/hooks/useInvitations.ts`)
   - Manage invitation CRUD operations
   - Create, resend, revoke invitations
   - TanStack Query integration

### Routing Updates

Add to `src/App.tsx`:
- `/approval-pending` → ApprovalPending page
- `/set-password/:token` → SetPassword page
- `/invitations` → InvitationManagement (HR/admin only)

## Admin Account Configuration

Your admin account is configured in the migration:

```
Email: highypestudio@gmail.com
Full Name: Al-Syed A.
Main Role: admin
Designation: Sales Executive (exceptional case)
Is Approved: true
```

This is an exceptional case where an admin has an employee-level designation name. The admin can:
- See everything in the system
- Create all roles and designations
- Assign designations to any user
- Approve users
- Manage HR invitations

## Implementation Approach

### Phase 1: Database Setup (READY NOW)
1. Run migration `20260326_admin_setup_and_role_promotion.sql`
2. Verify admin account exists
3. Verify role promotion trigger works

### Phase 2: Core UI Components (Week 1)
1. Build ApprovalPending page
2. Update AuthContext redirect logic
3. Test self-signup flow with approval pending

### Phase 3: HR Invitation Flow (Week 2)
1. Build SetPassword page
2. Build InvitationManagement component
3. Create email service Edge Function
4. Test complete HR invitation flow

### Phase 4: Polish and Testing (Week 3)
1. Add Framer Motion animations
2. Implement error handling
3. Add notifications
4. Write property-based tests
5. End-to-end testing

## Testing Strategy

### Property-Based Tests (27 Properties)
Use `fast-check` library to test universal properties:
- Signup flow with random valid data
- Token generation and validation
- Role promotion with various designations
- Email content validation
- Redirect logic for all approval states

### Unit Tests
- Component rendering
- Form validation
- Token validation
- Route protection
- Admin account protection

### Integration Tests
- Complete self-signup flow
- Complete HR invitation flow
- Role promotion flow
- Approval flow with notifications

## Key Design Decisions

### Email Service: Resend API
- Professional transactional email service
- Easy integration with Supabase Edge Functions
- Reliable delivery with retry logic
- Good developer experience

### Token Security
- Cryptographically secure random tokens (32+ characters)
- Stored as hashed values in database
- 7-day expiration
- One-time use (marked as accepted after use)
- Rate limiting on validation endpoint

### UI Patterns
- Follow existing Login.tsx patterns
- Use Framer Motion for all animations
- No ALL CAPS text (design-system.md)
- Staggered entry animations
- Proper loading and error states

## Next Steps

1. **Run the migration**:
   ```bash
   supabase db push
   ```

2. **Verify admin account**:
   ```sql
   SELECT email, full_name, main_role, designation, is_approved
   FROM profiles
   WHERE email = 'highypestudio@gmail.com';
   ```

3. **Start implementation**:
   - Open `.kiro/specs/complete-onboarding-system/tasks.md`
   - Start with Task 1 (Email service infrastructure)
   - Or start with Task 2 (ApprovalPending page) for quick UI progress

4. **Test as you go**:
   - Use checkpoints in tasks.md
   - Test each flow incrementally
   - Write property tests for core features

## Support

If you encounter issues:
1. Check the design document for detailed specifications
2. Review the requirements document for acceptance criteria
3. Refer to existing components (Login.tsx, UserApprovals.tsx) for patterns
4. Check the TWO_LAYER_ROLE_SYSTEM.md documentation

## Success Criteria

The implementation is complete when:
- ✅ Self-signup flow works with approval pending page
- ✅ HR invitation flow works with email sending
- ✅ Set password page validates tokens correctly
- ✅ Role promotion happens automatically
- ✅ Admin account is fully functional
- ✅ All routes and redirects work correctly
- ✅ All 27 correctness properties pass tests
- ✅ No broken UI or incomplete flows

