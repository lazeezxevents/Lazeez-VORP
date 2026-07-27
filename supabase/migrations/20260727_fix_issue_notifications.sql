-- Fix Issue Notifications: Change created_by to reported_by
-- Date: July 27, 2026
-- Description: Fixes the notification triggers for issues table to use reported_by instead of created_by

-- ============================================================================
-- CHECK IF NOTIFICATION FUNCTIONS EXIST (Safety check)
-- ============================================================================

DO $$ 
BEGIN
  -- Only proceed if the notification system exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_users') THEN
    RAISE NOTICE 'Notification system found, proceeding with fix...';
  ELSE
    RAISE NOTICE 'Notification system not found, skipping...';
    RETURN;
  END IF;
END $$;

-- ============================================================================
-- FIX ISSUE CREATED NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  creator_info JSONB;
BEGIN
  creator_info := get_user_info(NEW.reported_by);
  
  -- Notify assigned user
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.reported_by THEN
    PERFORM notify_users(
      ARRAY[NEW.assigned_to],
      CASE WHEN NEW.priority = 'critical' THEN 'error' WHEN NEW.priority = 'high' THEN 'warning' ELSE 'info' END,
      'issue',
      (creator_info->>'full_name') || ' assigned an Issue',
      NEW.title,
      'issue',
      NEW.id,
      '/issues',
      NEW.reported_by,
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
    NEW.reported_by,
    jsonb_build_object('avatar_url', creator_info->>'avatar_url', 'priority', NEW.priority)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIX ISSUE STATUS CHANGED NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_issue_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  updater_info JSONB;
  updater_id UUID;
BEGIN
  IF NEW.status != OLD.status THEN
    -- Determine who updated the issue (use assigned_to if available, otherwise reported_by)
    updater_id := COALESCE(NEW.assigned_to, NEW.reported_by);
    updater_info := get_user_info(updater_id);
    
    -- Notify creator if different from updater
    IF NEW.reported_by != updater_id THEN
      PERFORM notify_users(
        ARRAY[NEW.reported_by],
        CASE WHEN NEW.status = 'resolved' THEN 'success' ELSE 'info' END,
        'issue',
        (updater_info->>'full_name') || ' changed Issue status',
        NEW.title || ' is now ' || NEW.status,
        'issue',
        NEW.id,
        '/issues',
        updater_id,
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
    
    -- Notify assigned user if different
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != updater_id THEN
      PERFORM notify_users(
        ARRAY[NEW.assigned_to],
        CASE WHEN NEW.status = 'resolved' THEN 'success' ELSE 'info' END,
        'issue',
        (updater_info->>'full_name') || ' changed Issue status',
        NEW.title || ' is now ' || NEW.status,
        'issue',
        NEW.id,
        '/issues',
        updater_id,
        jsonb_build_object('avatar_url', updater_info->>'avatar_url', 'status', NEW.status)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION notify_issue_created IS 'Fixed to use reported_by instead of created_by for issues table';
COMMENT ON FUNCTION notify_issue_status_changed IS 'Fixed to use reported_by instead of created_by for issues table';
