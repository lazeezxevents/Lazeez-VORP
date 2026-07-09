# Actual Onboarding Flows - Clarified

## What Already Exists ✅

1. **Approval Pending Page** - EXISTS
2. **Login/Signup Form** - EXISTS
3. **Admin Approval Page** - EXISTS (UserApprovals.tsx)
4. **Database Schema** - COMPLETE
5. **Role Promotion Trigger** - READY (just fixed SQL syntax)

## What Needs to Be Built ❌

### 1. Add Confirm Password to Signup Form
**File**: `src/components/pages/Login.tsx`
- Add confirm password field to signup tab
- Validate passwords match before submission
- Show error if passwords don't match

### 2. Two-Layer Approval System

#### Flow A: Self-Signup (Employee Initiates)
```
Employee Signs Up (with confirm password)
    ↓
Profile Created (is_approved=false, admin_approved=false, hr_approved=false)
    ↓
Redirect to Approval Pending Page (EXISTS)
    ↓
Admin Approves (admin_approved=true)
    ↓
HR Approves + Assigns Designation (hr_approved=true)
    ↓
Automatic Role Promotion (if designation requires manager)
    ↓
User Gets Access (is_approved=true when both approvals done)
```

#### Flow B: HR Invitation (HR Initiates)
```
HR Creates Invitation with Designation
    ↓
Branded Email Sent with Secure Link
    ↓
Employee Clicks Link → Set Password Page
    ↓
Employee Sets Password
    ↓
Account Created (admin_approved=false, hr_approved=true, designation assigned)
    ↓
Real-time Notification to Admin
    ↓
Admin Sees in Approval Page + Approves
    ↓
Automatic Role Promotion (if designation requires manager)
    ↓
User Gets Access (is_approved=true)
```

## Implementation Tasks

### Task 1: Fix Signup Form (30 minutes)
**File**: `src/components/pages/Login.tsx`

Add confirm password field:
```tsx
// In signup form, after password field
<div className="space-y-2">
  <Label htmlFor="signup-confirm-password">
    Confirm Password <span className="text-primary ml-1.5 font-black">*</span>
  </Label>
  <motion.div
    className="relative group"
    animate={shakingField === "signup-confirm" ? "shake" : "idle"}
    variants={shakeVariants}
  >
    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
    <Input
      id="signup-confirm-password"
      type={showPassword ? "text" : "password"}
      placeholder="Confirm Password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className="pl-12 pr-12 h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-poppins"
    />
  </motion.div>
</div>
```

Add validation in `handleSignUp`:
```tsx
if (signUpPassword !== confirmPassword) {
  showError("Security Mismatch", "Passwords do not match. Please verify your entries.", "signup-confirm");
  setIsLoading(false);
  return;
}
```

### Task 2: Update UserApprovals for Two-Layer Approval (1 hour)
**File**: `src/components/pages/UserApprovals.tsx`

Add columns to show approval status:
- Admin Approved (checkbox/badge)
- HR Approved (checkbox/badge)
- Designation Assigned (text)

Update approval mutation to handle:
- Admin approval sets `admin_approved_by` and `admin_approved_at`
- HR approval sets `hr_approved_by`, `hr_approved_at`, and assigns designation
- Only set `is_approved=true` when BOTH admin and HR have approved

### Task 3: Create HR Invitation UI (2 hours)
**File**: `src/components/hr/InvitationManagement.tsx`

Create component with:
- Button to open "Create Invitation" dialog
- Form fields: Email, Department, Designation
- Table showing all invitations with status
- Resend/Revoke actions for pending invitations

### Task 4: Create Set Password Page (1 hour)
**File**: `src/pages/SetPassword.tsx`

Create page that:
- Extracts token from URL (`/set-password/:token`)
- Validates token on mount
- Shows employee email and designation
- Password input with strength indicator (reuse from Login.tsx)
- Confirm password field
- Creates account when submitted
- Sends real-time notification to admin

### Task 5: Create Email Service (2 hours)
**File**: `supabase/functions/send-invitation-email/index.ts`

Create Supabase Edge Function that:
- Receives invitation data from database trigger
- Generates secure invitation URL
- Sends branded email via Resend API
- Includes: Employee name, designation, invitation link, expiration (7 days)
- Handles delivery failures

### Task 6: Update Database Schema for Two-Layer Approval (30 minutes)
**File**: New migration

Add columns if not exist:
- `admin_approved_by` UUID
- `admin_approved_at` TIMESTAMPTZ
- `hr_approved_by` UUID
- `hr_approved_at` TIMESTAMPTZ

Update logic:
- `is_approved = (admin_approved_by IS NOT NULL AND hr_approved_by IS NOT NULL)`

### Task 7: Add Real-time Notifications (1 hour)

When HR invitation is accepted:
- Create notification for admin
- Show in admin's notification panel
- Highlight in UserApprovals page

When admin approves:
- Create notification for user
- Create notification for HR

When HR approves:
- Create notification for user

## Priority Order

1. **Fix SQL syntax** ✅ (DONE)
2. **Add confirm password to signup** (30 min)
3. **Update UserApprovals for two-layer approval** (1 hour)
4. **Create Set Password page** (1 hour)
5. **Create HR Invitation UI** (2 hours)
6. **Create Email Service** (2 hours)
7. **Add real-time notifications** (1 hour)

Total: ~8 hours of work

## Quick Start

Run the fixed SQL migration:
```bash
# Copy supabase/migrations/20260326_admin_setup_and_role_promotion.sql
# Paste into Supabase SQL Editor
# Click "Run"
```

Then start with Task 1 (add confirm password to signup form).

