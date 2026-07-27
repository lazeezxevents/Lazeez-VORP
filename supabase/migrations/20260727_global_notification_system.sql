-- ============================================================================
-- GLOBAL NOTIFICATION SYSTEM
-- ============================================================================
-- Automatically creates notifications when actions happen in the database
-- No user session required - works globally via triggers
-- ============================================================================

-- Helper function to create notifications for multiple users
CREATE OR REPLACE FUNCTION create_notification_for_users(
  p_user_ids uuid[],
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_category text DEFAULT 'system',
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      category,
      entity_type,
      entity_id,
      action_url,
      metadata,
      read,
      archived
    ) VALUES (
      v_user_id,
      p_title,
      p_message,
      p_type,
      p_category,
      p_entity_type,
      p_entity_id,
      p_action_url,
      p_metadata,
      false,
      false
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ISSUE NOTIFICATIONS
-- ============================================================================

-- Notify when issue is created
CREATE OR REPLACE FUNCTION notify_issue_created()
RETURNS TRIGGER AS $$
DECLARE
  v_vendor_name text;
  v_reporter_name text;
  v_watchers uuid[];
BEGIN
  -- Get vendor name
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;
  
  -- Get reporter name
  SELECT full_name INTO v_reporter_name FROM profiles WHERE id = NEW.reported_by;
  
  -- Get all watchers
  SELECT array_agg(user_id) INTO v_watchers
  FROM issue_watchers
  WHERE issue_id = NEW.id;
  
  -- Notify assignee if assigned
  IF NEW.assignee_id IS NOT NULL THEN
    PERFORM create_notification_for_users(
      ARRAY[NEW.assignee_id],
      'New issue assigned to you',
      format('"%s" (%s priority) - %s', NEW.title, NEW.priority, COALESCE(v_vendor_name, 'No vendor')),
      'info',
      'issue',
      'issue',
      NEW.id::text,
      '/issues',
      jsonb_build_object(
        'issue_id', NEW.id,
        'priority', NEW.priority,
        'vendor_name', v_vendor_name,
        'reporter_name', v_reporter_name
      )
    );
  END IF;
  
  -- Notify watchers
  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    PERFORM create_notification_for_users(
      v_watchers,
      'New issue you are watching',
      format('"%s" reported by %s', NEW.title, COALESCE(v_reporter_name, 'Unknown')),
      'info',
      'issue',
      'issue',
      NEW.id::text,
      '/issues',
      jsonb_build_object('issue_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when issue status changes
CREATE OR REPLACE FUNCTION notify_issue_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_watchers uuid[];
  v_assignee_name text;
BEGIN
  -- Only notify on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get assignee name
  IF NEW.assignee_id IS NOT NULL THEN
    SELECT full_name INTO v_assignee_name FROM profiles WHERE id = NEW.assignee_id;
  END IF;
  
  -- Get all watchers (exclude the person who made the change if we knew who it was)
  SELECT array_agg(user_id) INTO v_watchers
  FROM issue_watchers
  WHERE issue_id = NEW.id;
  
  -- Notify watchers about status change
  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    PERFORM create_notification_for_users(
      v_watchers,
      format('Issue status changed: %s → %s', OLD.status, NEW.status),
      format('"%s" is now %s', NEW.title, NEW.status),
      CASE
        WHEN NEW.status = 'resolved' THEN 'success'
        WHEN NEW.status = 'in_progress' THEN 'info'
        ELSE 'warning'
      END,
      'issue',
      'issue',
      NEW.id::text,
      '/issues',
      jsonb_build_object(
        'issue_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'assignee_name', v_assignee_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when someone is added as watcher
CREATE OR REPLACE FUNCTION notify_watcher_added()
RETURNS TRIGGER AS $$
DECLARE
  v_issue_title text;
  v_adder_name text;
BEGIN
  -- Get issue title
  SELECT title INTO v_issue_title FROM issues WHERE id = NEW.issue_id;
  
  -- Get who added them
  SELECT full_name INTO v_adder_name FROM profiles WHERE id = NEW.added_by;
  
  -- Notify the user who was added as watcher
  PERFORM create_notification_for_users(
    ARRAY[NEW.user_id],
    'You are now watching an issue',
    format('"%s" - added by %s', v_issue_title, COALESCE(v_adder_name, 'Someone')),
    'info',
    'issue',
    'issue',
    NEW.issue_id::text,
    '/issues',
    jsonb_build_object(
      'issue_id', NEW.issue_id,
      'added_by_name', v_adder_name
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify when remark is added (mention notifications)
CREATE OR REPLACE FUNCTION notify_remark_added()
RETURNS TRIGGER AS $$
DECLARE
  v_issue_title text;
  v_author_name text;
  v_watchers uuid[];
  v_mentioned_users uuid[];
  v_mention_pattern text;
BEGIN
  -- Only for comment type
  IF NEW.action_type != 'comment' THEN
    RETURN NEW;
  END IF;
  
  -- Get issue title
  SELECT title INTO v_issue_title FROM issues WHERE id = NEW.issue_id;
  
  -- Get author name
  SELECT full_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;
  
  -- Check for @mentions in the comment (simple pattern: @username or @@user-id)
  -- For now, notify all watchers when a comment is added
  SELECT array_agg(user_id) INTO v_watchers
  FROM issue_watchers
  WHERE issue_id = NEW.issue_id
    AND user_id != NEW.user_id; -- Don't notify the commenter
  
  -- Notify watchers about new comment
  IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
    PERFORM create_notification_for_users(
      v_watchers,
      format('New comment on "%s"', v_issue_title),
      format('%s: %s', 
        COALESCE(v_author_name, 'Someone'),
        CASE
          WHEN length(NEW.comment_text) > 100 THEN substring(NEW.comment_text, 1, 97) || '...'
          ELSE NEW.comment_text
        END
      ),
      'info',
      'issue',
      'issue',
      NEW.issue_id::text,
      '/issues',
      jsonb_build_object(
        'issue_id', NEW.issue_id,
        'author_name', v_author_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MOU NOTIFICATIONS
-- ============================================================================

-- Notify when MOU is expiring soon (run via cron or periodically)
CREATE OR REPLACE FUNCTION notify_mou_expiring_soon()
RETURNS void AS $$
DECLARE
  v_mou RECORD;
  v_vendor_name text;
  v_admins uuid[];
  v_staff uuid[];
BEGIN
  -- Get all admin and staff users
  SELECT array_agg(id) INTO v_admins FROM profiles WHERE main_role = 'admin';
  SELECT array_agg(id) INTO v_staff FROM profiles WHERE main_role IN ('admin', 'staff');
  
  -- Find MOUs expiring in next 30 days
  FOR v_mou IN
    SELECT id, document_name, vendor_id, effective_end_date
    FROM mou_vault
    WHERE extraction_status = 'completed'
      AND effective_end_date IS NOT NULL
      AND effective_end_date >= CURRENT_DATE
      AND effective_end_date <= CURRENT_DATE + INTERVAL '30 days'
  LOOP
    -- Get vendor name
    SELECT name INTO v_vendor_name FROM vendors WHERE id = v_mou.vendor_id;
    
    -- Notify staff about expiring MOU
    IF v_staff IS NOT NULL AND array_length(v_staff, 1) > 0 THEN
      -- Check if notification already exists (avoid duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE entity_type = 'mou'
          AND entity_id = v_mou.id::text
          AND title LIKE '%expiring soon%'
          AND created_at > CURRENT_DATE - INTERVAL '7 days'
      ) THEN
        PERFORM create_notification_for_users(
          v_staff,
          'MOU expiring soon',
          format('%s - %s (expires %s)',
            v_vendor_name,
            v_mou.document_name,
            to_char(v_mou.effective_end_date, 'Mon DD, YYYY')
          ),
          'warning',
          'mou',
          'mou',
          v_mou.id::text,
          '/mou-vault',
          jsonb_build_object(
            'mou_id', v_mou.id,
            'vendor_name', v_vendor_name,
            'expiry_date', v_mou.effective_end_date
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Issue created
DROP TRIGGER IF EXISTS trigger_notify_issue_created ON issues;
CREATE TRIGGER trigger_notify_issue_created
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION notify_issue_created();

-- Issue status changed
DROP TRIGGER IF EXISTS trigger_notify_issue_status_changed ON issues;
CREATE TRIGGER trigger_notify_issue_status_changed
  AFTER UPDATE ON issues
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_issue_status_changed();

-- Watcher added
DROP TRIGGER IF EXISTS trigger_notify_watcher_added ON issue_watchers;
CREATE TRIGGER trigger_notify_watcher_added
  AFTER INSERT ON issue_watchers
  FOR EACH ROW
  EXECUTE FUNCTION notify_watcher_added();

-- Remark/comment added
DROP TRIGGER IF EXISTS trigger_notify_remark_added ON issue_activity;
CREATE TRIGGER trigger_notify_remark_added
  AFTER INSERT ON issue_activity
  FOR EACH ROW
  WHEN (NEW.action_type = 'comment')
  EXECUTE FUNCTION notify_remark_added();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Global notification system created';
  RAISE NOTICE '✅ Notifications trigger automatically from database';
  RAISE NOTICE '✅ No user session required - works globally';
  RAISE NOTICE '';
  RAISE NOTICE 'AUTO-NOTIFICATIONS FOR:';
  RAISE NOTICE '- ✅ Issue created (assignee + watchers)';
  RAISE NOTICE '- ✅ Issue status changed (all watchers)';
  RAISE NOTICE '- ✅ Watcher added (the watcher)';
  RAISE NOTICE '- ✅ Comment/remark added (all watchers)';
  RAISE NOTICE '- ✅ MOU expiring soon (admins/staff) - call notify_mou_expiring_soon()';
  RAISE NOTICE '';
  RAISE NOTICE 'FEATURES:';
  RAISE NOTICE '- Real-time: Users see toast notifications immediately';
  RAISE NOTICE '- Persistent: Stored in notifications table';
  RAISE NOTICE '- Action links: Click to navigate to relevant page';
  RAISE NOTICE '- Restore as unread: Archived notifications restore as unread';
END $$;
