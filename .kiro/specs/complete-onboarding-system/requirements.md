# Requirements Document

## Introduction

This document specifies the requirements for completing the 2-layer role system onboarding implementation in Lazeez VORP. The system has a partially implemented onboarding flow with existing database schema but missing UI components, workflows, and integration points. This feature will complete both self-signup and HR-initiated invitation flows, implement automatic role promotion, and ensure seamless user onboarding experiences.

## Glossary

- **Onboarding_System**: The complete user registration and approval workflow system
- **Self_Signup_Flow**: User-initiated registration process requiring admin approval
- **HR_Invitation_Flow**: HR-initiated employee invitation process with email-based password setup
- **Role_Promotion_System**: Automatic main_role update mechanism when designation changes
- **Approval_Pending_Page**: UI page shown to users awaiting admin approval
- **Set_Password_Page**: UI page for invited users to create their password
- **Invitation_Token**: Secure token sent via email for password setup authentication
- **Main_Role**: Layer 1 role (admin, manager, employee)
- **Designation**: Layer 2 custom role with granular permissions
- **Admin_Account**: Special account (highypestudio@gmail.com) with full system access
- **Email_Service**: Service for sending invitation and notification emails
- **Auth_Context**: React context managing authentication state and user session
- **User_Approvals_Page**: Admin interface for approving pending user registrations
- **Invitation_Management**: HR interface for creating and managing employee invitations

## Requirements

### Requirement 1: Self-Signup Flow Completion

**User Story:** As an employee, I want to complete the self-signup process and see my approval status, so that I understand where I am in the onboarding workflow.

#### Acceptance Criteria

1. WHEN an employee completes signup with email, password, and department, THE Onboarding_System SHALL create a profile with main_role='employee' and is_approved=false
2. WHEN profile creation succeeds, THE Onboarding_System SHALL redirect the employee to the Approval_Pending_Page
3. THE Approval_Pending_Page SHALL display the user's approval status, submitted information, and expected next steps
4. WHEN an admin approves the user in User_Approvals_Page, THE Onboarding_System SHALL update is_approved=true
5. WHEN HR assigns a designation to the approved user, THE Role_Promotion_System SHALL automatically update main_role if the designation requires manager privileges
6. WHEN the user logs in after approval, THE Auth_Context SHALL redirect them to the dashboard

### Requirement 2: Approval Pending Page

**User Story:** As a pending user, I want to see my approval status and understand what happens next, so that I know my registration was successful and when I can access the system.

#### Acceptance Criteria

1. THE Approval_Pending_Page SHALL display the user's full name, email, and department
2. THE Approval_Pending_Page SHALL show a clear status indicator (pending approval, approved awaiting designation, or rejected)
3. THE Approval_Pending_Page SHALL provide estimated timeline information for the approval process
4. THE Approval_Pending_Page SHALL include a logout option
5. WHEN the user's approval status changes, THE Approval_Pending_Page SHALL reflect the updated status on page refresh
6. THE Approval_Pending_Page SHALL display contact information for support if approval is delayed

### Requirement 3: HR Invitation Flow

**User Story:** As an HR staff member, I want to invite employees directly with their designated role, so that I can streamline onboarding for pre-approved hires.

#### Acceptance Criteria

1. THE Invitation_Management SHALL provide a form for HR to enter employee email, department, and designation
2. WHEN HR submits an invitation, THE Onboarding_System SHALL create a record in employee_invitations table with a unique Invitation_Token
3. WHEN invitation is created, THE Email_Service SHALL send an email to the employee with a secure invitation link
4. THE invitation link SHALL include the Invitation_Token and route to /set-password/:token
5. THE Invitation_Token SHALL expire after 7 days
6. THE Invitation_Management SHALL display all pending, accepted, and expired invitations
7. WHERE an invitation is pending, THE Invitation_Management SHALL allow HR to resend or revoke the invitation

### Requirement 4: Set Password Page

**User Story:** As an invited employee, I want to set my password using the invitation link, so that I can complete my account setup and access the system.

#### Acceptance Criteria

1. WHEN an employee clicks the invitation link, THE Set_Password_Page SHALL validate the Invitation_Token
2. IF the Invitation_Token is invalid or expired, THEN THE Set_Password_Page SHALL display an error message with instructions to contact HR
3. THE Set_Password_Page SHALL display the employee's email and designated role information
4. THE Set_Password_Page SHALL provide a password input field with strength validation
5. WHEN the employee submits a valid password, THE Onboarding_System SHALL create the user account with the password and mark the invitation as accepted
6. WHEN account creation succeeds, THE Onboarding_System SHALL create the user profile with is_approved=true (pre-approved by HR)
7. WHEN the profile is created, THE Role_Promotion_System SHALL assign the designation specified in the invitation
8. WHEN password setup completes, THE Set_Password_Page SHALL redirect the user to the login page with a success message

### Requirement 5: Email Service Integration

**User Story:** As the system, I want to send invitation emails reliably, so that invited employees receive their onboarding links promptly.

#### Acceptance Criteria

1. THE Email_Service SHALL send invitation emails containing the employee's name, inviting HR staff name, and secure invitation link
2. THE Email_Service SHALL use a professional email template consistent with Lazeez VORP branding
3. THE Email_Service SHALL include invitation expiration information (7 days)
4. THE Email_Service SHALL handle email delivery failures gracefully and log errors
5. WHEN email delivery fails, THE Onboarding_System SHALL mark the invitation status as delivery_failed
6. WHERE email delivery fails, THE Invitation_Management SHALL allow HR to retry sending

### Requirement 6: Role Promotion System

**User Story:** As the system, I want to automatically promote employees to managers when assigned manager-level designations, so that role permissions stay synchronized with job responsibilities.

#### Acceptance Criteria

1. WHEN a designation is assigned to a user via role_assignments table, THE Role_Promotion_System SHALL check the designation's main_role value
2. IF the designation's main_role is 'manager' and the user's current main_role is 'employee', THEN THE Role_Promotion_System SHALL update profiles.main_role to 'manager'
3. IF the designation's main_role is 'employee' and the user's current main_role is 'manager', THEN THE Role_Promotion_System SHALL update profiles.main_role to 'employee'
4. THE Role_Promotion_System SHALL preserve main_role='admin' regardless of designation assignments
5. THE Role_Promotion_System SHALL execute via database trigger sync_main_role_from_designation()
6. THE Role_Promotion_System SHALL log all role promotions in the audit_logs table

### Requirement 7: Admin Account Configuration

**User Story:** As the system administrator (highypestudio@gmail.com), I want my account fully configured with admin privileges, so that I can manage all system operations.

#### Acceptance Criteria

1. THE Admin_Account SHALL have email='highypestudio@gmail.com' and full_name='Al-Syed A.'
2. THE Admin_Account SHALL have main_role='admin' and is_approved=true
3. THE Admin_Account SHALL be assigned designation='Sales Executive' (exceptional case: admin with employee-level designation name)
4. THE Admin_Account SHALL have access to all system features including User_Approvals_Page, Invitation_Management, and custom role creation
5. THE Admin_Account SHALL be able to view and manage all users, departments, and roles
6. THE Role_Promotion_System SHALL never modify the Admin_Account's main_role regardless of designation changes

### Requirement 8: Routing and Navigation

**User Story:** As a user, I want to be automatically directed to the appropriate page based on my account status, so that I have a seamless onboarding experience.

#### Acceptance Criteria

1. THE Auth_Context SHALL redirect unapproved users to /approval-pending after login
2. THE Auth_Context SHALL redirect approved users to /dashboard after login
3. THE Onboarding_System SHALL provide route /approval-pending for pending users
4. THE Onboarding_System SHALL provide route /set-password/:token for invited users
5. THE Onboarding_System SHALL provide route /invitations for HR staff to manage invitations
6. THE Onboarding_System SHALL protect /invitations route to require main_role='admin' or designation with hr_management permission
7. WHEN a user attempts to access /set-password with an invalid token, THE Onboarding_System SHALL redirect to login with an error message

### Requirement 9: Invitation Management Interface

**User Story:** As an HR staff member, I want to view and manage all employee invitations, so that I can track onboarding progress and handle issues.

#### Acceptance Criteria

1. THE Invitation_Management SHALL display a table of all invitations with columns: employee email, department, designation, status, created date, and actions
2. THE Invitation_Management SHALL filter invitations by status (pending, accepted, expired, revoked)
3. THE Invitation_Management SHALL provide a search function to find invitations by email or department
4. WHERE an invitation is pending, THE Invitation_Management SHALL provide a "Resend Email" action
5. WHERE an invitation is pending, THE Invitation_Management SHALL provide a "Revoke" action
6. THE Invitation_Management SHALL display invitation expiration countdown for pending invitations
7. THE Invitation_Management SHALL provide a "Create New Invitation" button that opens the invitation form

### Requirement 10: Error Handling and Validation

**User Story:** As a user, I want clear error messages when something goes wrong during onboarding, so that I know how to resolve issues.

#### Acceptance Criteria

1. WHEN email validation fails during signup, THE Onboarding_System SHALL display "Please enter a valid email address"
2. WHEN password strength is insufficient, THE Set_Password_Page SHALL display specific requirements (minimum 8 characters, uppercase, lowercase, number)
3. WHEN an invitation token is expired, THE Set_Password_Page SHALL display "This invitation has expired. Please contact HR for a new invitation."
4. WHEN an invitation token is invalid, THE Set_Password_Page SHALL display "Invalid invitation link. Please check your email or contact HR."
5. WHEN email delivery fails, THE Invitation_Management SHALL display "Email delivery failed. Please verify the email address and try again."
6. WHEN a user attempts to signup with an existing email, THE Onboarding_System SHALL display "An account with this email already exists."
7. IF database operations fail during onboarding, THEN THE Onboarding_System SHALL log the error and display "An error occurred. Please try again or contact support."

### Requirement 11: Security and Token Management

**User Story:** As the system, I want to securely manage invitation tokens, so that unauthorized users cannot create accounts.

#### Acceptance Criteria

1. THE Onboarding_System SHALL generate Invitation_Token using cryptographically secure random values
2. THE Invitation_Token SHALL be at least 32 characters long
3. THE Onboarding_System SHALL store Invitation_Token as a hashed value in the database
4. THE Onboarding_System SHALL validate Invitation_Token expiration before allowing password setup
5. WHEN an Invitation_Token is used successfully, THE Onboarding_System SHALL mark it as accepted and prevent reuse
6. THE Onboarding_System SHALL implement rate limiting on /set-password endpoint to prevent brute force attacks
7. THE Onboarding_System SHALL log all invitation token validation attempts in audit_logs

### Requirement 12: Notification Integration

**User Story:** As a user, I want to receive notifications about my onboarding status changes, so that I stay informed throughout the process.

#### Acceptance Criteria

1. WHEN an admin approves a user, THE Onboarding_System SHALL create a notification for the user with message "Your account has been approved"
2. WHEN HR assigns a designation, THE Onboarding_System SHALL create a notification for the user with the designation name
3. WHEN a user is promoted from employee to manager, THE Onboarding_System SHALL create a notification with message "You have been promoted to Manager"
4. WHEN an invitation is sent, THE Onboarding_System SHALL create a notification for the inviting HR staff confirming the invitation was sent
5. WHEN an invited user completes password setup, THE Onboarding_System SHALL create a notification for the inviting HR staff
6. THE Onboarding_System SHALL send email notifications for critical status changes (approval, invitation, password setup completion)

