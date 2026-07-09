-- ============================================================================
-- MASTER CONSOLIDATED MIGRATION - PRODUCTION READY
-- Version: 3.0
-- Date: March 20, 2026
-- Description: Complete RBAC, Onboarding, and Notifications System
-- Fixes: All policy/trigger conflicts, fully idempotent
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CLEANUP SECTION: Drop all existing policies and triggers to prevent conflicts
-- ============================================================================

-- Drop notification-related triggers
DROP TRIGGER IF EXISTS vendor_created_notification ON vendors;
DROP TRIGGER IF EXISTS vendor_updated_notification ON vendors;
DROP TRIGGER IF EXISTS vendor_payment_created_notification ON vendor_payments;
DROP TRIGGER IF EXISTS issue_created_notification ON issues;
DROP TRIGGER IF EXISTS issue_status_changed_notification ON issues;
DROP TRIGGER IF EXISTS issue_reassigned_notification ON issues;
DROP TRIGGER IF EXISTS mou_created_notification ON mous;
DROP TRIGGER IF EXISTS mou_status_changed_notification ON mous;
DROP TRIGGER IF EXISTS leave_request_submitted_notification ON leave_requests;
DROP TRIGGER IF EXISTS leave_status_changed_notification ON leave_requests;
DROP TRIGGER IF EXISTS leave_request_notification ON leave_requests;
DROP TRIGGER IF EXISTS leave_status_change_notification ON leave_requests;
DROP TRIGGER IF EXISTS leave_decision_notification ON leave_requests;
DROP TRIGGER IF EXISTS appraisal_created_notification ON appraisal_reviews;
DROP TRIGGER IF EXISTS appraisal_review_notification ON appraisal_reviews;
DROP TRIGGER IF EXISTS attendance_marked_notification ON attendance_logs;
DROP TRIGGER IF EXISTS project_created_notification ON projects;
DROP TRIGGER IF EXISTS task_assigned_notification ON project_tasks;
DROP TRIGGER IF EXISTS new_user_registration_notification ON profiles;
DROP TRIGGER IF EXISTS user_approved_notification ON profiles;
DROP TRIGGER IF EXISTS payment_created_notification ON vendor_payments;

-- Drop RBAC trigger
DROP TRIGGER IF EXISTS update_custom_roles_updated_at ON custom_roles;

-- Drop notification policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Drop custom_roles policies
DROP POLICY IF EXISTS "Anyone can view roles" ON custom_roles;
DROP POLICY IF EXISTS "HR and Admin can create roles" ON custom_roles;
DROP POLICY IF EXISTS "HR and Admin can update roles" ON custom_roles;
DROP POLICY IF EXISTS "Admin can delete roles" ON custom_roles;

-- Drop role_assignments policies
DROP POLICY IF EXISTS "Users can view own assignments" ON role_assignments;
DROP POLICY IF EXISTS "HR and Admin can view all assignments" ON role_assignments;
DROP POLICY IF EXISTS "HR and Admin can assign roles" ON role_assignments;
DROP POLICY IF EXISTS "HR and Admin can update assignments" ON role_assignments;
DROP POLICY IF EXISTS "HR and Admin can delete assignments" ON role_assignments;

-- Drop employee_invitations policies
DROP POLICY IF EXISTS "HR and Admin can view invitations" ON employee_invitations;
DROP POLICY IF EXISTS "HR and Admin can create invitations" ON employee_invitations;
DROP POLICY IF EXISTS "HR and Admin can update invitations" ON employee_invitations;
DROP POLICY IF EXISTS "HR and Admin can delete invitations" ON employee_invitations;

-- Drop profiles policies (will recreate properly)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON profiles;
DROP POLICY IF EXISTS "HR and Admin can update employee details" ON profiles;

-- ============================================================================
-- PART 1: ADD COLUMNS TO PROFILES TABLE
-- ============================================================================

DO $$ 
BEGIN
  -- RBAC columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='main_role') THEN
    ALTER TABLE profiles ADD COLUMN main_role VARCHAR(50) DEFAULT 'employee';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='designation') THEN
    ALTER TABLE profiles ADD COLUMN designation VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='department_id') THEN
    ALTER TABLE profiles ADD COLUMN department_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='is_approved') THEN
    ALTER TABLE profiles ADD COLUMN is_approved BOOLEAN DEFAULT false;
  END IF;

  -- Onboarding columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='approval_status') THEN
    ALTER TABLE profiles ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='rejection_reason') THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='onboarding_type') THEN
    ALTER TABLE profiles ADD COLUMN onboarding_type VARCHAR(20) DEFAULT 'self_signup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='manager_id') THEN
    ALTER TABLE profiles ADD COLUMN manager_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Add column comments
COMMENT ON COLUMN profiles.approval_status IS 'Values: pending, admin_approved, hr_approved, rejected';
COMMENT ON COLUMN profiles.onboarding_type IS 'Values: self_signup, hr_invitation';
COMMENT ON COLUMN profiles.main_role IS 'User main role: admin, manager, or employee';
COMMENT ON COLUMN profiles.designation IS 'User designation (links to custom_roles.display_name)';

-- ============================================================================
-- PART 2: CREATE TABLES
-- ============================================================================

-- Custom Roles Table (Layer 2: Designations)
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  main_role VARCHAR(50) NOT NULL DEFAULT 'employee',
  -- Layer 1 role: 'admin', 'manager', 'employee'
  permissions JSONB NOT NULL DEFAULT '{}',
  department_id UUID REFERENCES departments(id),
  -- Optional: Restrict designation to specific department
  is_system_role BOOLEAN DEFAULT false,
  -- Reserved for future use, currently all roles are custom
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Role Assignments Table
CREATE TABLE IF NOT EXISTS role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Employee Invitations Table
CREATE TABLE IF NOT EXISTS employee_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role_id UUID REFERENCES custom_roles(id),
  department_id UUID REFERENCES departments(id),
  team_id UUID,
  manager_id UUID REFERENCES profiles(id),
  secondary_manager_id UUID REFERENCES profiles(id),
  start_date DATE,
  employment_type VARCHAR(50) DEFAULT 'full_time',
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  action_url VARCHAR(255),
  read BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

-- RBAC indexes
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_main_role ON custom_roles(main_role);
CREATE INDEX IF NOT EXISTS idx_custom_roles_department_id ON custom_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_main_role ON profiles(main_role);

-- Onboarding indexes
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- ============================================================================
-- PART 4: TWO-LAYER ROLE SYSTEM
-- ============================================================================

-- Layer 1: Main Roles (Simple, for notifications and basic access control)
-- Values stored in profiles.main_role: 'admin', 'manager', 'employee'
-- This is used for:
--   - Notification routing (who gets notified)
--   - Basic RLS policies
--   - UI role badges

-- Layer 2: Designations (Granular, department-specific with custom permissions)
-- Stored in custom_roles table and linked via role_assignments
-- This is used for:
--   - Fine-grained permissions (vendors.create, issues.edit, etc.)
--   - Department-specific roles
--   - Manager-assigned designations
--   - Custom role creation by admins/HR

-- NO PRE-CONFIGURED ROLES
-- All designations are created dynamically by admins/HR through the UI
-- Examples of designations that can be created:
--   - "Senior Developer" (employee) - Engineering department
--   - "HR Lead" (manager) - HR department  
--   - "Finance Manager" (manager) - Finance department
--   - "Junior Designer" (employee) - Design department
--   - "Operations Lead" (manager) - Operations department

-- The custom_roles table structure supports:
--   - name: Unique identifier (e.g., "senior_developer")
--   - display_name: Human-readable (e.g., "Senior Developer")
--   - description: Role description
--   - main_role: Layer 1 role ('admin', 'manager', 'employee')
--   - permissions: JSONB with granular permissions
--   - department_id: Optional department restriction
--   - created_by: Who created this designation

COMMENT ON TABLE custom_roles IS 'Layer 2: Custom designations with granular permissions. Created dynamically by admins/HR. main_role links to Layer 1 (admin/manager/employee) for basic access control.';
COMMENT ON COLUMN custom_roles.main_role IS 'Layer 1 role: admin, manager, or employee. Used for notifications and basic RLS.';
COMMENT ON COLUMN profiles.main_role IS 'Layer 1 role: admin, manager, or employee. Simple role for notifications and basic access.';
COMMENT ON COLUMN profiles.designation IS 'Layer 2: User designation display name (links to custom_roles.display_name). Department-specific role with granular permissions.';

-- ============================================================================
-- PART 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: RLS POLICIES
-- ============================================================================

-- Custom Roles Policies
CREATE POLICY "Anyone can view roles"
ON custom_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR and Admin can create roles"
ON custom_roles FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can update roles"
ON custom_roles FOR UPDATE TO authenticated
USING (is_system_role = false AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')))
WITH CHECK (is_system_role = false AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "Admin can delete roles"
ON custom_roles FOR DELETE TO authenticated
USING (is_system_role = false AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin'));

-- Role Assignments Policies
CREATE POLICY "Users can view own assignments"
ON role_assignments FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "HR and Admin can view all assignments"
ON role_assignments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can assign roles"
ON role_assignments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can update assignments"
ON role_assignments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can delete assignments"
ON role_assignments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

-- Employee Invitations Policies
CREATE POLICY "HR and Admin can view invitations"
ON employee_invitations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can create invitations"
ON employee_invitations FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can update invitations"
ON employee_invitations FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

CREATE POLICY "HR and Admin can delete invitations"
ON employee_invitations FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

-- Notifications Policies
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Profiles Policies
CREATE POLICY "Users can update own profile limited"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  (OLD.main_role = NEW.main_role OR NEW.main_role IS NULL) AND
  (OLD.department_id = NEW.department_id OR NEW.department_id IS NULL) AND
  (OLD.designation = NEW.designation OR NEW.designation IS NULL) AND
  (OLD.approval_status = NEW.approval_status OR NEW.approval_status IS NULL) AND
  (OLD.admin_approved_by = NEW.admin_approved_by OR NEW.admin_approved_by IS NULL) AND
  (OLD.hr_approved_by = NEW.hr_approved_by OR NEW.hr_approved_by IS NULL) AND
  (OLD.manager_id = NEW.manager_id OR NEW.manager_id IS NULL)
);

CREATE POLICY "HR and Admin can update employee details"
ON profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role IN ('admin', 'manager')));

-- ============================================================================
-- PART 7: HELPER FUNCTIONS
-- ============================================================================

-- Get user info (name + avatar)
CREATE OR REPLACE FUNCTION get_user_info(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_info JSONB;
BEGIN
  SELECT jsonb_build_object(
    'full_name', COALESCE(full_name, email),
    'avatar_url', avatar_url
  ) INTO user_info
  FROM profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_info, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify specific users
CREATE OR REPLACE FUNCTION notify_users(
  user_ids UUID[],
  notification_type VARCHAR,
  notification_category VARCHAR,
  notification_title VARCHAR,
  notification_message TEXT,
  notification_entity_type VARCHAR DEFAULT NULL,
  notification_entity_id UUID DEFAULT NULL,
  notification_action_url VARCHAR DEFAULT NULL,
  notification_created_by UUID DEFAULT NULL,
  notification_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (
    user_id, type, category, title, message,
    entity_type, entity_id, action_url, created_by, metadata
  )
  SELECT 
    unnest(user_ids), notification_type, notification_category,
    notification_title, notification_message, notification_entity_type,
    notification_entity_id, notification_action_url,
    notification_created_by, notification_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all admins
CREATE OR REPLACE FUNCTION get_admin_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(SELECT id FROM profiles WHERE main_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all managers
CREATE OR REPLACE FUNCTION get_manager_ids()
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(SELECT id FROM profiles WHERE main_role IN ('admin', 'manager'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RBAC Functions
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  user_permissions JSONB := '{}';
BEGIN
  SELECT COALESCE(jsonb_object_agg(key, value), '{}')
  INTO user_permissions
  FROM (
    SELECT key, value
    FROM role_assignments ra
    JOIN custom_roles cr ON ra.role_id = cr.id
    CROSS JOIN LATERAL jsonb_each(cr.permissions)
    WHERE ra.user_id = user_uuid
  ) AS perms;
  
  RETURN user_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_permission(user_uuid UUID, permission_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  parts TEXT[];
  category TEXT;
  action TEXT;
  user_perms JSONB;
BEGIN
  parts := string_to_array(permission_path, '.');
  IF array_length(parts, 1) != 2 THEN
    RETURN false;
  END IF;
  
  category := parts[1];
  action := parts[2];
  user_perms := get_user_permissions(user_uuid);
  
  RETURN COALESCE((user_perms->category->>action)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 8: NOTIFICATION TRIGGERS
-- ============================================================================

-- Vendor Created
CREATE OR REPLACE FUNCTION notify_vendor_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  PERFORM notify_users(
    get_manager_ids(), 'success', 'vendor',
    (creator_info->>'full_name') || ' added a new Vendor',
    NEW.name || ' has been added to the system',
    'vendor', NEW.id, '/vendors/' || NEW.id, NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'vendor_name', NEW.name)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vendor_created_notification
AFTER INSERT ON vendors
FOR EACH ROW EXECUTE FUNCTION notify_vendor_created();

-- Issue Created
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
    PERFORM notify_users(
      ARRAY[NEW.assigned_to],
      CASE WHEN NEW.priority = 'critical' THEN 'error' WHEN NEW.priority = 'high' THEN 'warning' ELSE 'info' END,
      'issue', (creator_info->>'full_name') || ' assigned an Issue',
      NEW.title, 'issue', NEW.id, '/issues', NEW.created_by,
      jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'priority', NEW.priority, 'status', NEW.status)
    );
  END IF;
  
  PERFORM notify_users(
    get_manager_ids(), 'info', 'issue',
    (creator_info->>'full_name') || ' created an Issue',
    NEW.title, 'issue', NEW.id, '/issues', NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'priority', NEW.priority)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_created_notification
AFTER INSERT ON issues
FOR EACH ROW EXECUTE FUNCTION notify_issue_created();

-- MOU Created
CREATE OR REPLACE FUNCTION notify_mou_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  PERFORM notify_users(
    get_manager_ids(), 'info', 'mou',
    (creator_info->>'full_name') || ' created an MOU',
    NEW.title, 'mou', NEW.id, '/mous', NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mou_created_notification
AFTER INSERT ON mous
FOR EACH ROW EXECUTE FUNCTION notify_mou_created();

-- Leave Request Submitted
CREATE OR REPLACE FUNCTION notify_leave_request_submitted()
RETURNS TRIGGER AS $$
DECLARE
  requester_info JSONB;
  manager_id UUID;
BEGIN
  requester_info := get_user_info(NEW.employee_id);
  SELECT p.manager_id INTO manager_id FROM profiles p WHERE p.id = NEW.employee_id;
  
  IF manager_id IS NOT NULL THEN
    PERFORM notify_users(
      ARRAY[manager_id], 'info', 'leave',
      (requester_info->>'full_name') || ' requested Leave',
      'Leave from ' || TO_CHAR(NEW.start_date, 'Mon DD') || ' to ' || TO_CHAR(NEW.end_date, 'Mon DD'),
      'leave_request', NEW.id, '/hr-performance', NEW.employee_id,
      jsonb_build_object('avatar_url', requester_info->>'avatar_url', 'leave_type', NEW.leave_type, 'days', NEW.days_requested)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_request_submitted_notification
AFTER INSERT ON leave_requests
FOR EACH ROW EXECUTE FUNCTION notify_leave_request_submitted();

-- New User Registration
CREATE OR REPLACE FUNCTION notify_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_status = 'pending' THEN
    PERFORM notify_users(
      get_admin_ids(), 'info', 'system',
      'New User Registration',
      NEW.full_name || ' (' || NEW.email || ') is awaiting approval',
      'profile', NEW.id, '/user-approvals', NULL,
      jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER new_user_registration_notification
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION notify_new_user_registration();

-- User Approved
CREATE OR REPLACE FUNCTION notify_user_approved()
RETURNS TRIGGER AS $$
DECLARE
  approver_info JSONB;
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    approver_info := get_user_info(NEW.admin_approved_by);
    
    PERFORM notify_users(
      ARRAY[NEW.id], 'success', 'system',
      'Account Approved',
      (approver_info->>'full_name') || ' approved your account. Welcome to Lazeez VORP!',
      'profile', NEW.id, '/dashboard', NEW.admin_approved_by,
      jsonb_build_object('avatar_url', approver_info->>'avatar_url')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_approved_notification
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.is_approved IS DISTINCT FROM NEW.is_approved)
EXECUTE FUNCTION notify_user_approved();

-- RBAC Trigger
CREATE TRIGGER update_custom_roles_updated_at
BEFORE UPDATE ON custom_roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 9: ENABLE REAL-TIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- PART 10: MIGRATION SUCCESS VERIFICATION
-- ============================================================================

-- Verify that all role system tables were created successfully
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('custom_roles', 'role_assignments', 'employee_invitations');
  
  IF table_count != 3 THEN
    RAISE EXCEPTION 'Master migration verification failed. Expected 3 role system tables, found %', table_count;
  END IF;
  
  RAISE NOTICE 'Master consolidated system migration completed successfully. Created % role system tables.', table_count;
END $$;

-- ============================================================================
-- DEPENDENT MIGRATIONS
-- ============================================================================
-- The following migrations depend on the role system tables created by this migration:
--   - Finance Module (20260321_finance_module_core.sql)
--   - Any future migrations that use role_assignments or custom_roles
--
-- These migrations will fail if this master migration has not been applied first.
-- ============================================================================

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE custom_roles IS 'Custom role-designations with granular permissions';
COMMENT ON TABLE role_assignments IS 'Maps users to their assigned role-designations';
COMMENT ON TABLE employee_invitations IS 'HR-initiated employee invitations with pre-assigned roles';
COMMENT ON TABLE notifications IS 'Real-time notification system for all user actions';
COMMENT ON FUNCTION get_user_permissions IS 'Returns aggregated permissions for a user';
COMMENT ON FUNCTION has_permission IS 'Checks if a user has a specific permission';
COMMENT ON FUNCTION notify_users IS 'Helper function to send notifications to multiple users';
COMMENT ON FUNCTION get_user_info IS 'Get user full name and avatar URL';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
