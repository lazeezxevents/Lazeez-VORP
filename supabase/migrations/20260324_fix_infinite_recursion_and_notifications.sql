-- ============================================================================
-- FIX: Infinite Recursion in Profiles RLS + Notification System
-- Version: 2.0
-- Date: March 24, 2026
-- Description: Fixes infinite recursion in profiles policies and ensures
--              notifications show user names and avatars correctly
-- ============================================================================

-- ============================================================================
-- PART 1: FIX INFINITE RECURSION IN PROFILES POLICIES
-- ============================================================================
-- Problem: "HR and Admin can view all profiles" policy queries profiles table
--          within a profiles policy, causing infinite recursion
-- Solution: Use a security definer function to break the recursion

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "HR and Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON profiles;
DROP POLICY IF EXISTS "HR and Admin can update employee details" ON profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON profiles;
DROP POLICY IF EXISTS "Admin and HR can update all profile fields" ON profiles;

-- Create helper function to check if user is admin or manager (SECURITY DEFINER breaks recursion)
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND main_role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND main_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to prevent users from changing their own role/approval fields
CREATE OR REPLACE FUNCTION prevent_self_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is updating their own profile (not admin/manager updating someone else)
  IF NEW.id = auth.uid() AND NOT is_admin_or_manager(auth.uid()) THEN
    -- Prevent changing protected fields
    IF OLD.main_role IS DISTINCT FROM NEW.main_role THEN
      NEW.main_role := OLD.main_role;
    END IF;
    
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
      NEW.is_approved := OLD.is_approved;
    END IF;
    
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      NEW.approval_status := OLD.approval_status;
    END IF;
    
    IF OLD.designation IS DISTINCT FROM NEW.designation THEN
      NEW.designation := OLD.designation;
    END IF;
    
    IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
      NEW.department_id := OLD.department_id;
    END IF;
    
    IF OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
      NEW.manager_id := OLD.manager_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger
DROP TRIGGER IF EXISTS prevent_self_role_change_trigger ON profiles;
CREATE TRIGGER prevent_self_role_change_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_change();

-- Recreate profiles policies WITHOUT recursion and WITHOUT OLD/NEW references
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT TO authenticated 
USING (id = auth.uid());

CREATE POLICY "HR and Admin can view all profiles"
ON profiles FOR SELECT TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can update own basic profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admin and HR can update all profile fields"
ON profiles FOR UPDATE TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- ============================================================================
-- PART 2: ADD MISSING NOTIFICATION TRIGGERS
-- ============================================================================

-- Vendor Payment Created
DROP TRIGGER IF EXISTS payment_created_notification ON vendor_payments;
CREATE OR REPLACE FUNCTION notify_payment_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
  vendor_name VARCHAR;
BEGIN
  creator_info := get_user_info(NEW.created_by);
  SELECT name INTO vendor_name FROM vendors WHERE id = NEW.vendor_id;
  
  PERFORM notify_users(
    get_manager_ids(), 'success', 'payment',
    (creator_info->>'full_name') || ' recorded a Payment',
    'Payment of ' || NEW.amount || ' for ' || vendor_name,
    'vendor_payment', NEW.id, '/vendors/' || NEW.vendor_id, NEW.created_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'amount', NEW.amount, 'vendor_name', vendor_name)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER payment_created_notification
AFTER INSERT ON vendor_payments
FOR EACH ROW EXECUTE FUNCTION notify_payment_created();

-- Issue Status Changed
DROP TRIGGER IF EXISTS issue_status_changed_notification ON issues;
CREATE OR REPLACE FUNCTION notify_issue_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    updater_info := get_user_info(NEW.updated_by);
    
    -- Notify assigned user if different from updater
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.updated_by THEN
      PERFORM notify_users(
        ARRAY[NEW.assigned_to], 'info', 'issue',
        (updater_info->>'full_name') || ' updated Issue status',
        NEW.title || ' is now ' || NEW.status,
        'issue', NEW.id, '/issues', NEW.updated_by,
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
    
    -- Notify managers
    PERFORM notify_users(
      get_manager_ids(), 'info', 'issue',
      (updater_info->>'full_name') || ' updated Issue',
      NEW.title || ' status changed to ' || NEW.status,
      'issue', NEW.id, '/issues', NEW.updated_by,
      jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER issue_status_changed_notification
AFTER UPDATE ON issues
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_issue_status_changed();

-- MOU Status Changed
DROP TRIGGER IF EXISTS mou_status_changed_notification ON mous;
CREATE OR REPLACE FUNCTION notify_mou_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    updater_info := get_user_info(NEW.updated_by);
    
    PERFORM notify_users(
      get_manager_ids(), 'info', 'mou',
      (updater_info->>'full_name') || ' updated MOU status',
      NEW.title || ' is now ' || NEW.status,
      'mou', NEW.id, '/mous', NEW.updated_by,
      jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER mou_status_changed_notification
AFTER UPDATE ON mous
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_mou_status_changed();

-- Leave Status Changed
DROP TRIGGER IF EXISTS leave_status_changed_notification ON leave_requests;
CREATE OR REPLACE FUNCTION notify_leave_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  approver_info JSONB;
  requester_info JSONB;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    approver_info := get_user_info(NEW.reviewed_by);
    requester_info := get_user_info(NEW.employee_id);
    
    -- Notify employee
    PERFORM notify_users(
      ARRAY[NEW.employee_id],
      CASE WHEN NEW.status = 'approved' THEN 'success' WHEN NEW.status = 'rejected' THEN 'error' ELSE 'info' END,
      'leave',
      'Leave Request ' || NEW.status,
      (approver_info->>'full_name') || ' ' || NEW.status || ' your leave request',
      'leave_request', NEW.id, '/hr-performance', NEW.reviewed_by,
      jsonb_build_object('avatar_url', approver_info->>'avatar_url', 'status', NEW.status)
    );
    
    -- Notify managers
    PERFORM notify_users(
      get_manager_ids(), 'info', 'leave',
      (requester_info->>'full_name') || ' Leave ' || NEW.status,
      'Leave from ' || TO_CHAR(NEW.start_date, 'Mon DD') || ' to ' || TO_CHAR(NEW.end_date, 'Mon DD'),
      'leave_request', NEW.id, '/hr-performance', NEW.reviewed_by,
      jsonb_build_object('avatar_url', requester_info->>'avatar_url', 'status', NEW.status)
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

-- ============================================================================
-- PART 3: VERIFICATION FUNCTION
-- ============================================================================

-- Create a verification function to test the notification system
CREATE OR REPLACE FUNCTION verify_notification_system()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: Verify get_user_info function exists
  RETURN QUERY
  SELECT 
    'get_user_info function'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'get_user_info'
    ) THEN 'OK' ELSE 'MISSING' END,
    'Returns user full_name and avatar_url'::TEXT;
  
  -- Check 2: Verify notify_users function exists
  RETURN QUERY
  SELECT 
    'notify_users function'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'notify_users'
    ) THEN 'OK' ELSE 'MISSING' END,
    'Sends notifications to multiple users'::TEXT;
  
  -- Check 3: Verify notifications table exists
  RETURN QUERY
  SELECT 
    'notifications table'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_tables WHERE tablename = 'notifications'
    ) THEN 'OK' ELSE 'MISSING' END,
    'Stores notification records'::TEXT;
  
  -- Check 4: Verify helper functions exist
  RETURN QUERY
  SELECT 
    'is_admin_or_manager function'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'is_admin_or_manager'
    ) THEN 'OK' ELSE 'MISSING' END,
    'Prevents infinite recursion in RLS'::TEXT;
  
  -- Check 5: Verify notification triggers
  RETURN QUERY
  SELECT 
    'notification triggers'::TEXT,
    (SELECT COUNT(*)::TEXT FROM pg_trigger WHERE tgname LIKE '%notification%') || ' triggers',
    'Should have multiple notification triggers'::TEXT;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION is_admin_or_manager IS 'Security definer function to check admin/manager role without recursion';
COMMENT ON FUNCTION is_admin IS 'Security definer function to check admin role without recursion';
COMMENT ON FUNCTION prevent_self_role_change IS 'Trigger function to prevent users from changing their own roles';
COMMENT ON FUNCTION verify_notification_system IS 'Diagnostic function to verify notification system setup';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
