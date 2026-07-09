-- =====================================================
-- Revenue Event Handler Enhancements Migration
-- =====================================================
-- Adds helper functions and statistics for revenue event processing
--
-- Requirements: 2.1, 2.6
-- Task: 10.2 Integrate with Delivery Module
-- =====================================================

-- =====================================================
-- 1. Function to Get Revenue Event Statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_revenue_event_stats()
RETURNS TABLE (
  pending BIGINT,
  processing BIGINT,
  completed BIGINT,
  failed BIGINT,
  total BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    COUNT(*) AS total
  FROM finance_revenue_events;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. Function to Get Pending Events Count by Vendor
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_events_by_vendor()
RETURNS TABLE (
  vendor_id UUID,
  pending_count BIGINT,
  oldest_event_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fre.vendor_id,
    COUNT(*) AS pending_count,
    MIN(fre.created_at) AS oldest_event_date
  FROM finance_revenue_events fre
  WHERE fre.status = 'pending'
  GROUP BY fre.vendor_id
  ORDER BY pending_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Function to Get Failed Events for Retry
-- =====================================================

CREATE OR REPLACE FUNCTION get_failed_events_for_retry(p_max_retries INTEGER DEFAULT 3)
RETURNS TABLE (
  event_id UUID,
  vendor_id UUID,
  order_id UUID,
  retry_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fre.id AS event_id,
    fre.vendor_id,
    fre.order_id,
    fre.retry_count,
    fre.error_message,
    fre.created_at
  FROM finance_revenue_events fre
  WHERE fre.status = 'failed'
    AND fre.retry_count < p_max_retries
  ORDER BY fre.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. Function to Reset Stuck Processing Events
-- =====================================================
-- Resets events that have been in 'processing' status for more than 5 minutes
-- This handles cases where processing was interrupted

CREATE OR REPLACE FUNCTION reset_stuck_processing_events()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  WITH reset_events AS (
    UPDATE finance_revenue_events
    SET 
      status = 'pending',
      updated_at = NOW()
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_reset_count FROM reset_events;
  
  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Reset % stuck processing event(s)', v_reset_count;
  END IF;
  
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Function to Get Event Processing Performance Metrics
-- =====================================================

CREATE OR REPLACE FUNCTION get_event_processing_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_events BIGINT,
  completed_events BIGINT,
  failed_events BIGINT,
  avg_processing_time_ms NUMERIC,
  max_processing_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_events,
    COUNT(*) FILTER (WHERE fre.status = 'completed') AS completed_events,
    COUNT(*) FILTER (WHERE fre.status = 'failed') AS failed_events,
    AVG(
      EXTRACT(EPOCH FROM (fre.processed_at - fre.created_at)) * 1000
    ) FILTER (WHERE fre.processed_at IS NOT NULL) AS avg_processing_time_ms,
    MAX(
      EXTRACT(EPOCH FROM (fre.processed_at - fre.created_at)) * 1000
    ) FILTER (WHERE fre.processed_at IS NOT NULL) AS max_processing_time_ms,
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE fre.status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100
      ELSE 0
    END AS success_rate
  FROM finance_revenue_events fre
  WHERE fre.created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Function to Clean Up Old Completed Events
-- =====================================================
-- Archives completed events older than 90 days to maintain performance

CREATE OR REPLACE FUNCTION archive_old_completed_events(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER;
BEGIN
  WITH archived_events AS (
    DELETE FROM finance_revenue_events
    WHERE status = 'completed'
      AND processed_at < NOW() - (p_days_old || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived_count FROM archived_events;
  
  IF v_archived_count > 0 THEN
    RAISE NOTICE 'Archived % completed event(s) older than % days', v_archived_count, p_days_old;
  END IF;
  
  RETURN v_archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. Scheduled Job to Reset Stuck Events (pg_cron)
-- =====================================================
-- Note: This requires pg_cron extension to be enabled
-- Run this manually or set up as a cron job

-- SELECT cron.schedule(
--   'reset-stuck-events',
--   '*/5 * * * *', -- Every 5 minutes
--   $$ SELECT reset_stuck_processing_events(); $$
-- );

-- =====================================================
-- 8. View for Event Processing Dashboard
-- =====================================================

CREATE OR REPLACE VIEW finance_event_processing_dashboard AS
SELECT
  fre.id,
  fre.event_type,
  fre.order_id,
  fre.vendor_id,
  v.name AS vendor_name,
  fre.order_amount,
  fre.status,
  fre.retry_count,
  fre.error_message,
  fre.created_at,
  fre.processed_at,
  CASE 
    WHEN fre.processed_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (fre.processed_at - fre.created_at)) * 1000
    ELSE NULL
  END AS processing_time_ms,
  CASE
    WHEN fre.status = 'pending' THEN
      EXTRACT(EPOCH FROM (NOW() - fre.created_at))
    ELSE NULL
  END AS pending_duration_seconds
FROM finance_revenue_events fre
LEFT JOIN vendors v ON v.id = fre.vendor_id
ORDER BY fre.created_at DESC;

-- =====================================================
-- 9. Grant Permissions
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_revenue_event_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_events_by_vendor() TO authenticated;
GRANT EXECUTE ON FUNCTION get_failed_events_for_retry(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_stuck_processing_events() TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_processing_metrics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_old_completed_events(INTEGER) TO authenticated;

-- Grant select on dashboard view
GRANT SELECT ON finance_event_processing_dashboard TO authenticated;

-- =====================================================
-- 10. Comments for Documentation
-- =====================================================

COMMENT ON FUNCTION get_revenue_event_stats() IS 'Returns count of events by status for monitoring dashboard';
COMMENT ON FUNCTION get_pending_events_by_vendor() IS 'Returns pending event counts grouped by vendor';
COMMENT ON FUNCTION get_failed_events_for_retry(INTEGER) IS 'Returns failed events that are eligible for retry';
COMMENT ON FUNCTION reset_stuck_processing_events() IS 'Resets events stuck in processing status for more than 5 minutes';
COMMENT ON FUNCTION get_event_processing_metrics(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns performance metrics for event processing within date range';
COMMENT ON FUNCTION archive_old_completed_events(INTEGER) IS 'Archives completed events older than specified days to maintain performance';
COMMENT ON VIEW finance_event_processing_dashboard IS 'Dashboard view showing event processing status and performance metrics';

-- =====================================================
-- 11. Create Index for Performance
-- =====================================================

-- Index for processing time calculations
CREATE INDEX IF NOT EXISTS idx_finance_revenue_events_processed_at 
  ON finance_revenue_events(processed_at) 
  WHERE processed_at IS NOT NULL;

-- Index for pending duration queries
CREATE INDEX IF NOT EXISTS idx_finance_revenue_events_pending_created 
  ON finance_revenue_events(created_at) 
  WHERE status = 'pending';

-- Index for stuck event detection
CREATE INDEX IF NOT EXISTS idx_finance_revenue_events_processing_updated 
  ON finance_revenue_events(updated_at) 
  WHERE status = 'processing';

