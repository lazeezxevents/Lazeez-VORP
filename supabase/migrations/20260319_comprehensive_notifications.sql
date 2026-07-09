-- Comprehensive Real-Time Notifications System
-- Version: 2.0
-- Date: March 19, 2026
-- Description: Complete notification system for ALL user actions across ALL modules
-- Real-time: Yes - works with Supabase real-time subscriptions

-- ============================================================================
-- PART 1: Create notifications table
-- ============================================================================

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Helper Functions
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
    user_id,
    type,
    category,
    title,
    message,
    entity_type,
    entity_id,
    action_url,
    created_by,
    metadata
  )
  SELECT 
    unnest(user_ids),
    notification_type,
    notification_category,
    notification_title,
    notification_message,
    notification_entity_type,
    notification_entity_id,
    notification_action_url,
    notification_created_by,
    notification_metadata;
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

-- Get department members
CREATE OR REPLACE FUNCTION get_department_member_ids(dept_id UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(SELECT id FROM profiles WHERE department_id = dept_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: VENDOR MODULE NOTIFICATIONS
-- ============================================================================

-- Vendor Created
CREATE OR REPLACE FUNCTION notify_vendor_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  PERFORM notify_users(
    get_manager_ids(),
    'success',
    'vendor',
    (creator_info->>'full_name') || ' added a new Vendor',
    NEW.name || ' has been added to the system',
    'vendor',
    NEW.id,
    '/vendors/' || NEW.id,
    NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'vendor_name', NEW.name)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vendor_created_notification
AFTER INSERT ON vendors
FOR EACH ROW
EXECUTE FUNCTION notify_vendor_created();

-- Vendor Updated
CREATE OR REPLACE FUNCTION notify_vendor_updated()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF NEW.name != OLD.name OR NEW.status != OLD.status THEN
    updater_info := get_user_info(COALESCE(NEW.updated_by, NEW.created_by));
    
    PERFORM notify_users(
      get_manager_ids(),
      'info',
      'vendor',
      (updater_info->>'full_name') || ' updated Vendor',
      NEW.name || ' details have been modified',
      'vendor',
      NEW.id,
      '/vendors/' || NEW.id,
      COALESCE(NEW.updated_by, NEW.created_by),
      jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'vendor_name', NEW.name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vendor_updated_notification
AFTER UPDATE ON vendors
FOR EACH ROW
EXECUTE FUNCTION notify_vendor_updated();

-- Vendor Payment Created
CREATE OR REPLACE FUNCTION notify_vendor_payment_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
  vendor_name TEXT;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  SELECT name INTO vendor_name FROM vendors WHERE id = NEW.vendor_id;
  
  PERFORM notify_users(
    get_admin_ids(),
    'info',
    'payment',
    (creator_info->>'full_name') || ' recorded a Payment',
    'Payment of ' || NEW.amount || ' for ' || vendor_name,
    'vendor_payment',
    NEW.id,
    '/vendors/' || NEW.vendor_id,
    NEW.created_by,
    jsonb_build_object(
      'avatar_url', creator_info->>'avatar_url',
      'amount', NEW.amount,
      'vendor_name', vendor_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER vendor_payment_created_notification
AFTER INSERT ON vendor_payments
FOR EACH ROW
EXECUTE FUNCTION notify_vendor_payment_created();

-- ============================================================================
-- PART 4: ISSUE MODULE NOTIFICATIONS
-- ============================================================================

-- Issue Created & Assigned
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  -- Notify assigned user
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
    PERFORM notify_users(
      ARRAY[NEW.assigned_to],
      CASE WHEN NEW.priority = 'critical' THEN 'error' WHEN NEW.priority = 'high' THEN 'warning' ELSE 'info' END,
      'issue',
      (creator_info->>'full_name') || ' assigned an Issue',
      NEW.title,
      'issue',
      NEW.id,
      '/issues',
      NEW.created_by,
      jsonb_build_object(
        'avatar_url', creator_info->>'avatar_url',
        'priority', NEW.priority,
        'status', NEW.status
      )
    );
  END IF;
  
  -- Notify managers
  PERFORM notify_users(
    get_manager_ids(),
    'info',
    'issue',
    (creator_info->>'full_name') || ' created an Issue',
    NEW.title,
    'issue',
    NEW.id,
    '/issues',
    NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'priority', NEW.priority)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_created_notification
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_issue_created();

-- Issue Status Changed
CREATE OR REPLACE FUNCTION notify_issue_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF NEW.status != OLD.status THEN
    updater_info := get_user_info(COALESCE(NEW.updated_by, NEW.created_by));
    
    -- Notify creator if different from updater
    IF NEW.created_by != COALESCE(NEW.updated_by, NEW.created_by) THEN
      PERFORM notify_users(
        ARRAY[NEW.created_by],
        CASE WHEN NEW.status = 'resolved' THEN 'success' ELSE 'info' END,
        'issue',
        (updater_info->>'full_name') || ' changed Issue status',
        NEW.title || ' is now ' || NEW.status,
        'issue',
        NEW.id,
        '/issues',
        COALESCE(NEW.updated_by, NEW.created_by),
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
    
    -- Notify assigned user if different
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != COALESCE(NEW.updated_by, NEW.created_by) THEN
      PERFORM notify_users(
        ARRAY[NEW.assigned_to],
        CASE WHEN NEW.status = 'resolved' THEN 'success' ELSE 'info' END,
        'issue',
        (updater_info->>'full_name') || ' changed Issue status',
        NEW.title || ' is now ' || NEW.status,
        'issue',
        NEW.id,
        '/issues',
        COALESCE(NEW.updated_by, NEW.created_by),
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_status_changed_notification
AFTER UPDATE ON issues
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_issue_status_changed();

-- ============================================================================
-- PART 5: MOU MODULE NOTIFICATIONS
-- ============================================================================

-- MOU Created
CREATE OR REPLACE FUNCTION notify_mou_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  PERFORM notify_users(
    get_manager_ids(),
    'info',
    'mou',
    (creator_info->>'full_name') || ' created an MOU',
    NEW.title,
    'mou',
    NEW.id,
    '/mous',
    NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mou_created_notification
AFTER INSERT ON mous
FOR EACH ROW
EXECUTE FUNCTION notify_mou_created();

-- MOU Status Changed
CREATE OR REPLACE FUNCTION notify_mou_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF NEW.status != OLD.status THEN
    updater_info := get_user_info(COALESCE(NEW.updated_by, NEW.created_by));
    
    PERFORM notify_users(
      get_manager_ids(),
      CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status = 'rejected' THEN 'warning' ELSE 'info' END,
      'mou',
      (updater_info->>'full_name') || ' ' || NEW.status || ' an MOU',
      NEW.title,
      'mou',
      NEW.id,
      '/mous',
      COALESCE(NEW.updated_by, NEW.created_by),
      jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
    );
    
    -- Notify creator
    IF NEW.created_by != COALESCE(NEW.updated_by, NEW.created_by) THEN
      PERFORM notify_users(
        ARRAY[NEW.created_by],
        CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status = 'rejected' THEN 'warning' ELSE 'info' END,
        'mou',
        'MOU ' || NEW.status,
        (updater_info->>'full_name') || ' ' || NEW.status || ' your MOU: ' || NEW.title,
        'mou',
        NEW.id,
        '/mous',
        COALESCE(NEW.updated_by, NEW.created_by),
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mou_status_changed_notification
AFTER UPDATE ON mous
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_mou_status_changed();

-- MOU Expiring (run daily via cron)
CREATE OR REPLACE FUNCTION check_mou_expiration()
RETURNS void AS $$
DECLARE
  mou_record RECORD;
  days_until_expiry INTEGER;
BEGIN
  FOR mou_record IN 
    SELECT * FROM mous
    WHERE status IN ('approved', 'signed')
    AND end_date IS NOT NULL
    AND end_date > NOW()
    AND end_date <= NOW() + INTERVAL '7 days'
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (mou_record.end_date - NOW()));
    
    IF days_until_expiry IN (7, 3, 1) THEN
      PERFORM notify_users(
        get_manager_ids(),
        CASE WHEN days_until_expiry <= 1 THEN 'error' WHEN days_until_expiry <= 3 THEN 'warning' ELSE 'info' END,
        'mou',
        'MOU Expiring Soon',
        mou_record.title || ' expires in ' || days_until_expiry || ' day(s)',
        'mou',
        mou_record.id,
        '/mous',
        NULL,
        jsonb_build_object('days_until_expiry', days_until_expiry)
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: HR MODULE NOTIFICATIONS
-- ============================================================================

-- Leave Request Submitted
CREATE OR REPLACE FUNCTION notify_leave_request_submitted()
RETURNS TRIGGER AS $$
DECLARE
  requester_info JSONB;
  manager_id UUID;
BEGIN
  requester_info := get_user_info(NEW.employee_id);
  
  -- Get employee's manager
  SELECT p.manager_id INTO manager_id FROM profiles p WHERE p.id = NEW.employee_id;
  
  IF manager_id IS NOT NULL THEN
    PERFORM notify_users(
      ARRAY[manager_id],
      'info',
      'leave',
      (requester_info->>'full_name') || ' requested Leave',
      'Leave from ' || TO_CHAR(NEW.start_date, 'Mon DD') || ' to ' || TO_CHAR(NEW.end_date, 'Mon DD'),
      'leave_request',
      NEW.id,
      '/hr-performance',
      NEW.employee_id,
      jsonb_build_object(
        'avatar_url', requester_info->>'avatar_url',
        'leave_type', NEW.leave_type,
        'days', NEW.days_requested
      )
    );
  END IF;
  
  -- Notify HR
  PERFORM notify_users(
    ARRAY(SELECT id FROM profiles WHERE department = 'HR' OR main_role = 'admin'),
    'info',
    'leave',
    (requester_info->>'full_name') || ' requested Leave',
    'Leave from ' || TO_CHAR(NEW.start_date, 'Mon DD') || ' to ' || TO_CHAR(NEW.end_date, 'Mon DD'),
    'leave_request',
    NEW.id,
    '/hr-performance',
    NEW.employee_id,
    jsonb_build_object('avatar_url', requester_info->>'avatar_url', 'leave_type', NEW.leave_type)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_request_submitted_notification
AFTER INSERT ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION notify_leave_request_submitted();

-- Leave Request Status Changed
CREATE OR REPLACE FUNCTION notify_leave_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  approver_info JSONB;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    approver_info := get_user_info(NEW.approved_by);
    
    PERFORM notify_users(
      ARRAY[NEW.employee_id],
      CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'warning' END,
      'leave',
      'Leave Request ' || INITCAP(NEW.status),
      (approver_info->>'full_name') || ' ' || NEW.status || ' your leave request',
      'leave_request',
      NEW.id,
      '/hr-performance',
      NEW.approved_by,
      jsonb_build_object('avatar_url', approver_info->>'avatar_url', 'status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_status_changed_notification
AFTER UPDATE ON leave_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_leave_status_changed();

-- Appraisal Created
CREATE OR REPLACE FUNCTION notify_appraisal_created()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_info JSONB;
BEGIN
  reviewer_info := get_user_info(NEW.reviewer_id);
  
  PERFORM notify_users(
    ARRAY[NEW.employee_id],
    'info',
    'appraisal',
    (reviewer_info->>'full_name') || ' started an Appraisal',
    'Your performance review has been initiated',
    'appraisal',
    NEW.id,
    '/hr-performance',
    NEW.reviewer_id,
    jsonb_build_object('avatar_url', reviewer_info->>'avatar_url', 'review_type', NEW.review_type)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER appraisal_created_notification
AFTER INSERT ON appraisal_reviews
FOR EACH ROW
EXECUTE FUNCTION notify_appraisal_created();

-- Attendance Marked
CREATE OR REPLACE FUNCTION notify_attendance_marked()
RETURNS TRIGGER AS $$
DECLARE
  marker_info JSONB;
  manager_id UUID;
BEGIN
  IF NEW.status IN ('late', 'absent') THEN
    marker_info := get_user_info(NEW.marked_by);
    
    -- Get employee's manager
    SELECT p.manager_id INTO manager_id FROM profiles p WHERE p.id = NEW.employee_id;
    
    IF manager_id IS NOT NULL THEN
      PERFORM notify_users(
        ARRAY[manager_id],
        'warning',
        'attendance',
        'Attendance Alert',
        (SELECT full_name FROM profiles WHERE id = NEW.employee_id) || ' marked as ' || NEW.status,
        'attendance_log',
        NEW.id,
        '/hr-performance',
        NEW.marked_by,
        jsonb_build_object('avatar_url', marker_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER attendance_marked_notification
AFTER INSERT ON attendance_logs
FOR EACH ROW
EXECUTE FUNCTION notify_attendance_marked();

-- ============================================================================
-- PART 7: PROJECT MODULE NOTIFICATIONS
-- ============================================================================

-- Project Created
CREATE OR REPLACE FUNCTION notify_project_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  PERFORM notify_users(
    get_manager_ids(),
    'success',
    'project',
    (creator_info->>'full_name') || ' created a Project',
    NEW.title,
    'project',
    NEW.id,
    '/projects',
    NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER project_created_notification
AFTER INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION notify_project_created();

-- Task Assigned
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
DECLARE
  assigner_info JSONB;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
    assigner_info := get_user_info(NEW.created_by);
    
    PERFORM notify_users(
      ARRAY[NEW.assigned_to],
      'info',
      'project',
      (assigner_info->>'full_name') || ' assigned a Task',
      NEW.title,
      'project_task',
      NEW.id,
      '/projects',
      NEW.created_by,
      jsonb_build_object('avatar_url', assigner_info->>'avatar_url', 'priority', NEW.priority)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_assigned_notification
AFTER INSERT ON project_tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_assigned();

-- ============================================================================
-- PART 8: USER MANAGEMENT NOTIFICATIONS
-- ============================================================================

-- New User Registration (Pending Approval)
CREATE OR REPLACE FUNCTION notify_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_status = 'pending' THEN
    PERFORM notify_users(
      get_admin_ids(),
      'info',
      'system',
      'New User Registration',
      NEW.full_name || ' (' || NEW.email || ') is awaiting approval',
      'profile',
      NEW.id,
      '/user-approvals',
      NULL,
      jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER new_user_registration_notification
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_new_user_registration();

-- User Approved
CREATE OR REPLACE FUNCTION notify_user_approved()
RETURNS TRIGGER AS $$
DECLARE
  approver_info JSONB;
BEGIN
  IF NEW.is_approved = true AND OLD.is_approved = false THEN
    approver_info := get_user_info(NEW.admin_approved_by);
    
    PERFORM notify_users(
      ARRAY[NEW.id],
      'success',
      'system',
      'Account Approved',
      (approver_info->>'full_name') || ' approved your account. Welcome to Lazeez VORP!',
      'profile',
      NEW.id,
      '/dashboard',
      NEW.admin_approved_by,
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

-- ============================================================================
-- PART 9: Enable Real-Time for notifications table
-- ============================================================================

-- Enable real-time replication for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notifications IS 'Real-time notification system for all user actions across all modules';
COMMENT ON FUNCTION notify_users IS 'Helper function to send notifications to multiple users';
COMMENT ON FUNCTION get_user_info IS 'Get user full name and avatar URL';
COMMENT ON FUNCTION check_mou_expiration IS 'Check for expiring MOUs (run daily via cron)';

-- ============================================================================
-- USAGE NOTES
-- ============================================================================

-- This migration creates a comprehensive notification system that:
-- 1. Captures ALL user actions across ALL modules
-- 2. Works in REAL-TIME via Supabase real-time subscriptions
-- 3. Includes user avatars and names in all notifications
-- 4. Notifies relevant users based on roles and relationships
-- 5. Supports archiving and read/unread status
-- 6. Is fully secured with RLS policies

-- To enable real-time in your React app:
-- const channel = supabase
--   .channel('notifications')
--   .on('postgres_changes', { 
--     event: 'INSERT', 
--     schema: 'public', 
--     table: 'notifications',
--     filter: `user_id=eq.${userId}`
--   }, (payload) => {
--     // Handle new notification
--     queryClient.invalidateQueries(['notifications']);
--   })
--   .subscribe();
