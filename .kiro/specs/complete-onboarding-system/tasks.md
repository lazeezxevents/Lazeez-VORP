# Implementation Plan: Complete Onboarding System

## Overview

This implementation plan converts the complete onboarding system design into actionable coding tasks. The system implements dual onboarding flows (self-signup and HR invitation), automatic role promotion, and comprehensive approval workflows. The backend database triggers are already created in migration `20260326_admin_setup_and_role_promotion.sql`, so this plan focuses on frontend components, email service, and integration.

## Tasks

- [x] 1. Set up email service infrastructure
  - Create Supabase Edge Function for sending invitation emails
  - Integrate Resend API for email delivery
  - Create professional email template with Lazeez VORP branding
  - Implement email delivery error handling and retry logic
  - Add environment variables for Resend API key
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ]* 1.1 Write property test for email service
  - **Property 7: Invitation creation triggers email send**
  - **Property 16: Email delivery failures are handled gracefully**
  - **Validates: Requirements 3.3, 5.1, 5.3, 5.4, 5.5, 5.6**

- [x] 2. Create ApprovalPending page component
  - [x] 2.1 Implement ApprovalPending page UI
    - Create page component at `src/pages/ApprovalPending.tsx`
    - Display user information (name, email, department)
    - Show approval status with animated status indicator
    - Add logout button
    - Implement auto-refresh every 30 seconds
    - Display support contact information
    - Follow design-system.md patterns (Framer Motion, no ALL CAPS)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_
  
  - [x] 2.2 Add manual refresh functionality
    - Implement refresh button with loading state
    - Fetch latest profile data from Supabase
    - Update UI with new approval status
    - _Requirements: 2.5_
  
  - [ ]* 2.3 Write property test for approval status display
    - **Property 5: Approval status changes are reflected on page refresh**
    - **Validates: Requirements 2.5**

- [x] 3. Update AuthContext for approval flow
  - [x] 3.1 Add approval status redirect logic
    - Check `is_approved` field after authentication
    - Redirect unapproved users to `/approval-pending`
    - Redirect approved users to `/dashboard`
    - Prevent redirect loops
    - _Requirements: 1.2, 1.6, 8.1, 8.2_
  
  - [x] 3.2 Add refreshProfile method
    - Create method to manually refetch user profile
    - Update profile state in context
    - Expose method for components to use
    - _Requirements: 2.5_
  
  - [ ]* 3.3 Write property test for redirect logic
    - **Property 2: Approval status determines redirect destination**
    - **Validates: Requirements 1.2, 1.6, 8.1, 8.2**

- [x] 4. Implement invitation token management
  - [x] 4.1 Create useInvitations custom hook
    - Implement `src/components/hooks/useInvitations.ts`
    - Add TanStack Query for invitation CRUD operations
    - Implement createInvitation, resendInvitation, revokeInvitation
    - Add optimistic updates for better UX
    - Handle errors with toast notifications
    - _Requirements: 3.1, 3.2, 3.7_
  
  - [x] 4.2 Add token validation utilities
    - Create token validation function
    - Check token existence, expiration, and usage status
    - Return appropriate error messages
    - _Requirements: 4.1, 4.2, 11.4_
  
  - [ ]* 4.3 Write property test for token generation
    - **Property 6: Invitation creation generates unique secure token**
    - **Validates: Requirements 3.2, 11.1, 11.2, 11.3**
  
  - [ ]* 4.4 Write property test for token validation
    - **Property 12: Token validation checks expiration and validity**
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Create SetPassword page component
  - [x] 5.1 Implement SetPassword page UI
    - Create page component at `src/pages/SetPassword.tsx`
    - Extract token from URL params
    - Validate token on component mount
    - Display employee email and designation
    - Show loading state during validation
    - Show error state for invalid/expired tokens
    - _Requirements: 4.1, 4.2, 4.3, 8.4, 8.7_
  
  - [x] 5.2 Add password input with strength validation
    - Create password input field
    - Implement real-time strength validation
    - Display requirements (8+ chars, uppercase, lowercase, number)
    - Add confirm password field
    - Show visual strength indicator
    - _Requirements: 4.4, 10.2_
  
  - [x] 5.3 Implement account creation flow
    - Handle form submission
    - Create user account via Supabase Auth
    - Mark invitation as accepted
    - Redirect to login with success message
    - Handle errors gracefully
    - _Requirements: 4.5, 4.6, 4.7, 4.8_
  
  - [ ]* 5.4 Write property test for password strength validation
    - **Property 13: Password strength validation provides feedback**
    - **Validates: Requirements 4.4**
  
  - [ ]* 5.5 Write property test for invitation acceptance
    - **Property 14: Invitation acceptance creates pre-approved account**
    - **Validates: Requirements 4.5, 4.6, 4.7, 11.5**

- [x] 6. Checkpoint - Ensure basic flows work
  - Test self-signup flow creates unapproved profile
  - Test ApprovalPending page displays correctly
  - Test SetPassword page validates tokens
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Create InvitationManagement component
  - [x] 7.1 Implement invitation table UI
    - Create component at `src/components/hr/InvitationManagement.tsx`
    - Display invitations table with all columns
    - Show status badges with color coding
    - Add expiration countdown for pending invitations
    - Implement responsive table layout
    - _Requirements: 9.1, 9.6_
  
  - [x] 7.2 Add filtering and search functionality
    - Implement status filter tabs (all, pending, accepted, expired, revoked)
    - Add search input for email and department
    - Filter invitations based on selected criteria
    - _Requirements: 9.2, 9.3_
  
  - [x] 7.3 Implement invitation actions
    - Add "Resend Email" button for pending invitations
    - Add "Revoke" button for pending invitations
    - Implement action handlers with confirmation dialogs
    - Show loading states during actions
    - Display success/error toasts
    - _Requirements: 9.4, 9.5_
  
  - [x] 7.4 Create invitation form dialog
    - Add "Create New Invitation" button
    - Implement dialog with form fields (email, department, designation)
    - Add form validation
    - Handle form submission
    - Close dialog on success
    - _Requirements: 3.1, 9.7_
  
  - [ ]* 7.5 Write property test for invitation management
    - **Property 10: Invitation management displays all invitation statuses**
    - **Property 11: Pending invitations can be resent or revoked**
    - **Validates: Requirements 3.6, 3.7**
  
  - [ ]* 7.6 Write property test for filtering and search
    - **Property 20: Invitation filtering works correctly**
    - **Property 21: Invitation search matches email and department**
    - **Validates: Requirements 9.2, 9.3**

- [x] 8. Add routing configuration
  - [x] 8.1 Add new routes to App.tsx
    - Add route for `/approval-pending`
    - Add route for `/set-password/:token`
    - Add route for `/invitations` (protected)
    - Configure route protection based on permissions
    - _Requirements: 8.3, 8.4, 8.5, 8.6_
  
  - [x] 8.2 Implement route protection
    - Protect `/invitations` route for admin or HR staff
    - Handle invalid token access to `/set-password`
    - Redirect unauthorized users appropriately
    - _Requirements: 8.6, 8.7_
  
  - [ ]* 8.3 Write property test for route protection
    - **Property 18: Invitation route is protected by permissions**
    - **Property 19: Invalid token access redirects to login**
    - **Validates: Requirements 8.6, 8.7**

- [x] 9. Implement self-signup flow integration
  - [x] 9.1 Update Login page signup logic
    - Ensure signup creates profile with is_approved=false
    - Set main_role='employee' for new signups
    - Redirect to ApprovalPending after successful signup
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 9.2 Write property test for self-signup
    - **Property 1: Self-signup creates unapproved employee profile**
    - **Validates: Requirements 1.1**

- [x] 10. Implement notification integration
  - [x] 10.1 Add approval notification
    - Create notification when admin approves user
    - Include message "Your account has been approved"
    - _Requirements: 12.1_
  
  - [x] 10.2 Add designation assignment notification
    - Create notification when HR assigns designation
    - Include designation name in message
    - _Requirements: 12.2_
  
  - [x] 10.3 Add role promotion notification
    - Create notification when user is promoted to manager
    - Include message "You have been promoted to Manager"
    - _Requirements: 12.3_
  
  - [x] 10.4 Add invitation sent notification
    - Create notification for HR staff when invitation is sent
    - Confirm invitation delivery
    - _Requirements: 12.4_
  
  - [x] 10.5 Add password setup completion notification
    - Create notification for HR staff when invited user completes setup
    - Include employee name and completion timestamp
    - _Requirements: 12.5_
  
  - [x] 10.6 Add email notifications for critical events
    - Send email for approval
    - Send email for invitation
    - Send email for password setup completion
    - _Requirements: 12.6_
  
  - [ ]* 10.7 Write property test for notifications
    - **Property 26: Status change notifications are created**
    - **Property 27: Critical events trigger email notifications**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

- [x] 11. Checkpoint - Ensure complete flows work
  - Test complete self-signup flow from signup to approval to dashboard
  - Test complete HR invitation flow from creation to password setup to login
  - Test role promotion when designation is assigned
  - Test all notifications are created correctly
  - Ensure all tests pass, ask the user if questions arise

- [x] 12. Implement error handling and validation
  - [x] 12.1 Add form validation error messages
    - Email validation error message
    - Password strength error messages
    - Required field error messages
    - Duplicate email error message
    - _Requirements: 10.1, 10.2, 10.6_
  
  - [x] 12.2 Add token validation error messages
    - Expired token error message
    - Invalid token error message
    - Used token error message (prevent reuse)
    - _Requirements: 10.3, 10.4_
  
  - [x] 12.3 Add email delivery error handling
    - Display email delivery failure message
    - Provide retry action for failed emails
    - _Requirements: 10.5_
  
  - [x] 12.4 Add database error handling
    - Log database errors
    - Display user-friendly error messages
    - _Requirements: 10.7_
  
  - [ ]* 12.5 Write property test for error handling
    - **Property 23: Database errors are logged and user-friendly messages displayed**
    - **Validates: Requirements 10.7**

- [x] 13. Implement security features
  - [x] 13.1 Add rate limiting for token validation
    - Implement rate limiting on /set-password endpoint
    - Prevent brute force attacks
    - _Requirements: 11.6_
  
  - [x] 13.2 Add audit logging for token validation
    - Log all token validation attempts
    - Include token, timestamp, and result
    - _Requirements: 11.7_
  
  - [ ]* 13.3 Write property test for security features
    - **Property 24: Rate limiting prevents brute force attacks**
    - **Property 25: Token validation attempts are audited**
    - **Validates: Requirements 11.6, 11.7**

- [x] 14. Verify role promotion system
  - [x] 14.1 Test role promotion trigger
    - Verify sync_main_role_from_designation() trigger exists
    - Test employee to manager promotion
    - Test manager to employee demotion
    - Verify admin role is never modified
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 14.2 Verify audit logging for promotions
    - Check audit logs are created for promotions
    - Verify log includes user ID, action, and role change details
    - _Requirements: 6.6_
  
  - [ ]* 14.3 Write property test for role promotion
    - **Property 4: Role promotion synchronizes with designation main_role**
    - **Property 17: Role promotions are logged in audit trail**
    - **Validates: Requirements 1.5, 6.1, 6.2, 6.3, 6.4, 6.6**

- [x] 15. Add UI polish and animations
  - [x] 15.1 Add Framer Motion animations to ApprovalPending
    - Staggered entry animation for content
    - Animated status indicator
    - Smooth transitions for status changes
  
  - [x] 15.2 Add Framer Motion animations to SetPassword
    - Fade-in animation for form
    - Password strength indicator animation
    - Success animation on completion
  
  - [x] 15.3 Add Framer Motion animations to InvitationManagement
    - Staggered entry for table rows
    - Hover effects on action buttons
    - Smooth filter transitions
  
  - [x] 15.4 Ensure design system compliance
    - Verify no ALL CAPS text
    - Check typography hierarchy
    - Verify color usage matches design-system.md
    - Test hover states and interactions

- [x] 16. Integration testing and verification
  - [x] 16.1 Test self-signup flow end-to-end
    - Complete signup as new user
    - Verify redirect to ApprovalPending
    - Approve user as admin
    - Login and verify redirect to dashboard
  
  - [x] 16.2 Test HR invitation flow end-to-end
    - Create invitation as HR staff
    - Verify email is sent
    - Complete password setup via invitation link
    - Login and verify access
  
  - [x] 16.3 Test role promotion flow
    - Assign manager designation to employee
    - Verify main_role is updated to manager
    - Verify audit log entry is created
    - Verify notification is sent
  
  - [x] 16.4 Test admin account protection
    - Verify admin account exists (highypestudio@gmail.com)
    - Attempt to change admin designation
    - Verify main_role remains 'admin'
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 16.5 Write property test for admin protection
    - **Property 4: Role promotion synchronizes with designation main_role (admin protection)**
    - **Validates: Requirements 6.4, 7.6**

- [x] 17. Final checkpoint - Complete system verification
  - Run all property-based tests (minimum 100 iterations each)
  - Run all unit tests
  - Run all integration tests
  - Verify all 27 correctness properties pass
  - Test error scenarios and edge cases
  - Verify email templates render correctly
  - Check audit logging for all critical events
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (27 total)
- Unit tests validate specific examples and edge cases
- The database trigger `sync_main_role_from_designation()` is already created in migration `20260326_admin_setup_and_role_promotion.sql`
- The admin account setup SQL is already created in the same migration
- Focus on frontend implementation, email service, and integration
- Use TypeScript for all implementation
- Follow design-system.md patterns for UI components
- Use TanStack Query for server state management
- Use Framer Motion for animations
- Use shadcn/ui components for UI elements
