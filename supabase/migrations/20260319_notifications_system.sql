-- Real-Time Notifications System
-- Version: 1.0
-- Date: March 19, 2026
-- Description: Complete notification system with triggers for all user actions

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);

-- Add RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read, archive)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Notification creation triggers
-- ============================================================================

-- Helper function to get user's full name and avatar
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

-- ============================================================================
-- Issue Notifications
-- ============================================================================

-- Notify when issue is created and assigned
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
    creator_info := get_user_info(NEW.created_by);
    
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
    ) VALUES (
      NEW.assigned_to,
      CASE 
        WHEN NEW.priority = 'critical' THEN 'error'
        WHEN NEW.priority = 'high' THEN 'warning'
        ELSE 'info'
      END,
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_created_notification
AFTER INSERT ON issues
FOR EACH ROW
EXECUTE FUNCTION notify_issue_created();

-- Notify when issue is reassigned
CREATE OR REPLACE FUNCTION notify_issue_reassigned()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to 
     AND NEW.assigned_to IS NOT NULL 
     AND NEW.assigned_to != OLD.assigned_to THEN
    
    updater_info := get_user_info(COALESCE(NEW.updated_by, NEW.created_by));
    
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
    ) VALUES (
      NEW.assigned_to,
      'info',
      'issue',
      (updater_info->>'full_name') || ' reassigned an Issue',
      NEW.title,
      'issue',
      NEW.id,
      '/issues',
      COALESCE(NEW.updated_by, NEW.created_by),
      jsonb_build_object(
        'avatar_url', updater_info->>'avatar_url',
        'priority', NEW.priority,
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_reassigned_notification
AFTER UPDATE ON issues
FOR EACH ROW
WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION notify_issue_reassigned();

-- ============================================================================
-- MOU Notifications
-- ============================================================================

-- Notify when MOU is expiring (7 days, 3 days, 1 day)
CREATE OR REPLACE FUNCTION check_mou_expiration()
RETURNS void AS $$
DECLARE
  mou_record RECORD;
  days_until_expiry INTEGER;
BEGIN
  FOR mou_record IN 
    SELECT m.*, p.id as manager_id
    FROM mous m
    CROSS JOIN profiles p
    WHERE m.status IN ('approved', 'signed')
    AND m.end_date IS NOT NULL
    AND m.end_date > NOW()
    AND m.end_date <= NOW() + INTERVAL '7 days'
    AND p.main_role IN ('admin', 'manager')
  LOOP
    days_until_expiry := EXTRACT(DAY FROM (mou_record.end_date - NOW()));
    
    -- Only notify at 7, 3, and 1 day marks
    IF days_until_expiry IN (7, 3, 1) THEN
      INSERT INTO notifications (
        user_id,
        type,
        category,
        title,
        message,
        entity_type,
        entity_id,
        action_url,
        metadata
      ) VALUES (
        mou_record.manager_id,
        CASE 
          WHEN days_until_expiry <= 1 THEN 'error'
          WHEN days_until_expiry <= 3 THEN 'warning'
          ELSE 'info'
        END,
        'mou',
        'MOU Expiring Soon',
        mou_record.title || ' expires in ' || days_until_expiry || ' day(s)',
        'mou',
        mou_record.id,
        '/mous',
        jsonb_build_object(
          'days_until_expiry', days_until_expiry,
          'vendor_id', mou_record.vendor_id
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Vendor Payment Notifications
-- ============================================================================

-- Notify when payment is created
CREATE OR REPLACE FUNCTION notify_payment_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
  vendor_name TEXT;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  
  SELECT name INTO vendor_name FROM vendors WHERE id = NEW.vendor_id;
  
  -- Notify admins and finance managers
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
    p.id,
    'info',
    'payment',
    (creator_info->>'full_name') || ' added a Payment',
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
  FROM profiles p
  WHERE p.main_role IN ('admin') OR p.department = 'Finance';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payment_created_notification
AFTER INSERT ON vendor_payments
FOR EACH ROW
EXECUTE FUNCTION notify_payment_created();

-- ============================================================================
-- Leave Request Notifications
-- ============================================================================

-- Notify manager when leave request is submitted
CREATE OR REPLACE FUNCTION notify_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_info JSONB;
BEGIN
  requester_info := get_user_info(NEW.employee_id);
  
  -- Notify the employee's manager
  IF NEW.status = 'pending' THEN
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
      p.manager_id,
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
    FROM profiles p
    WHERE p.id = NEW.employee_id AND p.manager_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_request_notification
AFTER INSERT ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION notify_leave_request();

-- Notify employee when leave is approved/rejected
CREATE OR REPLACE FUNCTION notify_leave_status_change()
RETURNS TRIGGER AS $$
DECLARE
  approver_info JSONB;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    approver_info := get_user_info(NEW.approved_by);
    
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
    ) VALUES (
      NEW.employee_id,
      CASE WHEN NEW.status = 'approved' THEN 'success' ELSE 'warning' END,
      'leave',
      'Leave Request ' || INITCAP(NEW.status),
      (approver_info->>'full_name') || ' ' || NEW.status || ' your leave request',
      'leave_request',
      NEW.id,
      '/hr-performance',
      NEW.approved_by,
      jsonb_build_object(
        'avatar_url', approver_info->>'avatar_url',
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER leave_status_change_notification
AFTER UPDATE ON leave_requests
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_leave_status_change();

-- ============================================================================
-- PART 3: Scheduled job for MOU expiration checks
-- ============================================================================

-- This should be run daily via cron or pg_cron
-- Example: SELECT cron.schedule('check-mou-expiration', '0 9 * * *', 'SELECT check_mou_expiration()');

COMMENT ON TABLE notifications IS 'Real-time notification system for all user actions';
COMMENT ON FUNCTION notify_issue_created IS 'Creates notification when issue is assigned';
COMMENT ON FUNCTION notify_payment_created IS 'Creates notification when payment is added';
COMMENT ON FUNCTION check_mou_expiration IS 'Checks for expiring MOUs and creates notifications';
