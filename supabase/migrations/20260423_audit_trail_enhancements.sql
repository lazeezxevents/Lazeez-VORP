-- =====================================================
-- Audit Trail Enhancements
-- =====================================================
-- Description: Enhance audit trail with 7-year retention and export
-- Requirements: 19.4, 19.5, 19.9
-- Task: 48.1
-- =====================================================

-- =====================================================
-- Add retention metadata to audit log
-- =====================================================

-- Add retention_until column (7 years from creation)
ALTER TABLE finance_audit_log
ADD COLUMN IF NOT EXISTS retention_until DATE GENERATED ALWAYS AS (
  (changed_at + INTERVAL '7 years')::DATE
) STORED;

-- Add archived flag for old records
ALTER TABLE finance_audit_log
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Index for retention queries
CREATE INDEX IF NOT EXISTS idx_finance_audit_log_retention 
  ON finance_audit_log(retention_until, is_archived);

-- =====================================================
-- Audit Log Archive Table
-- =====================================================
-- For records older than 7 years that need to be moved to cold storage

CREATE TABLE IF NOT EXISTS finance_audit_log_archive (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  retention_until DATE NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Indexes for archive table
CREATE INDEX idx_finance_audit_log_archive_entity 
  ON finance_audit_log_archive(entity_type, entity_id);
CREATE INDEX idx_finance_audit_log_archive_changed_at 
  ON finance_audit_log_archive(changed_at);
CREATE INDEX idx_finance_audit_log_archive_archived_at 
  ON finance_audit_log_archive(archived_at);

-- =====================================================
-- Function: Archive old audit logs
-- =====================================================
-- Move audit logs older than 7 years to archive table

CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS TABLE (
  archived_count INTEGER,
  oldest_date TIMESTAMPTZ,
  newest_date TIMESTAMPTZ
) AS $
DECLARE
  v_archived_count INTEGER;
  v_oldest_date TIMESTAMPTZ;
  v_newest_date TIMESTAMPTZ;
BEGIN
  -- Move records older than 7 years to archive
  WITH archived_records AS (
    INSERT INTO finance_audit_log_archive (
      id,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at,
      ip_address,
      user_agent,
      retention_until,
      archived_by
    )
    SELECT 
      id,
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at,
      ip_address,
      user_agent,
      retention_until,
      auth.uid()
    FROM finance_audit_log
    WHERE retention_until < CURRENT_DATE
      AND is_archived = FALSE
    RETURNING id, changed_at
  ),
  deleted_records AS (
    DELETE FROM finance_audit_log
    WHERE id IN (SELECT id FROM archived_records)
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    MIN(changed_at),
    MAX(changed_at)
  INTO v_archived_count, v_oldest_date, v_newest_date
  FROM archived_records;
  
  RETURN QUERY SELECT v_archived_count, v_oldest_date, v_newest_date;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Export audit logs
-- =====================================================
-- Export audit logs for a date range and entity types

CREATE OR REPLACE FUNCTION export_audit_logs(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_entity_types TEXT[] DEFAULT NULL,
  p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  is_archived BOOLEAN
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.action,
    al.old_values,
    al.new_values,
    al.changed_by,
    u.email AS changed_by_email,
    al.changed_at,
    al.ip_address,
    al.user_agent,
    al.is_archived
  FROM finance_audit_log al
  LEFT JOIN auth.users u ON al.changed_by = u.id
  WHERE al.changed_at >= p_start_date
    AND al.changed_at <= p_end_date
    AND (p_entity_types IS NULL OR al.entity_type = ANY(p_entity_types))
  
  UNION ALL
  
  SELECT 
    ala.id,
    ala.entity_type,
    ala.entity_id,
    ala.action,
    ala.old_values,
    ala.new_values,
    ala.changed_by,
    u.email AS changed_by_email,
    ala.changed_at,
    ala.ip_address,
    ala.user_agent,
    TRUE AS is_archived
  FROM finance_audit_log_archive ala
  LEFT JOIN auth.users u ON ala.changed_by = u.id
  WHERE p_include_archived = TRUE
    AND ala.changed_at >= p_start_date
    AND ala.changed_at <= p_end_date
    AND (p_entity_types IS NULL OR ala.entity_type = ANY(p_entity_types))
  
  ORDER BY changed_at DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Get audit log statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_log_statistics()
RETURNS TABLE (
  total_active_logs BIGINT,
  total_archived_logs BIGINT,
  oldest_active_log TIMESTAMPTZ,
  newest_active_log TIMESTAMPTZ,
  logs_pending_archive BIGINT,
  total_size_mb NUMERIC
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM finance_audit_log WHERE is_archived = FALSE),
    (SELECT COUNT(*) FROM finance_audit_log_archive),
    (SELECT MIN(changed_at) FROM finance_audit_log WHERE is_archived = FALSE),
    (SELECT MAX(changed_at) FROM finance_audit_log WHERE is_archived = FALSE),
    (SELECT COUNT(*) FROM finance_audit_log WHERE retention_until < CURRENT_DATE AND is_archived = FALSE),
    (SELECT ROUND((pg_total_relation_size('finance_audit_log') + 
                   pg_total_relation_size('finance_audit_log_archive'))::NUMERIC / 1024 / 1024, 2));
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Search audit logs
-- =====================================================

CREATE OR REPLACE FUNCTION search_audit_logs(
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_action VARCHAR(50) DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  entity_type VARCHAR(50),
  entity_id UUID,
  action VARCHAR(50),
  old_values JSONB,
  new_values JSONB,
  changed_by UUID,
  changed_by_email TEXT,
  changed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.entity_type,
    al.entity_id,
    al.action,
    al.old_values,
    al.new_values,
    al.changed_by,
    u.email AS changed_by_email,
    al.changed_at,
    al.ip_address,
    al.user_agent
  FROM finance_audit_log al
  LEFT JOIN auth.users u ON al.changed_by = u.id
  WHERE (p_entity_type IS NULL OR al.entity_type = p_entity_type)
    AND (p_entity_id IS NULL OR al.entity_id = p_entity_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_changed_by IS NULL OR al.changed_by = p_changed_by)
    AND (p_start_date IS NULL OR al.changed_at >= p_start_date)
    AND (p_end_date IS NULL OR al.changed_at <= p_end_date)
    AND al.is_archived = FALSE
  ORDER BY al.changed_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS Policies for Archive Table
-- =====================================================

ALTER TABLE finance_audit_log_archive ENABLE ROW LEVEL SECURITY;

-- Only admins can view archived audit logs
CREATE POLICY "Admins can view archived audit logs"
  ON finance_audit_log_archive
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- System can insert archived audit logs
CREATE POLICY "System can insert archived audit logs"
  ON finance_audit_log_archive
  FOR INSERT
  WITH CHECK (true);

-- Prevent modifications to archive
CREATE TRIGGER prevent_audit_archive_update
  BEFORE UPDATE ON finance_audit_log_archive
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_archive_delete
  BEFORE DELETE ON finance_audit_log_archive
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- =====================================================
-- Scheduled Job for Archival (using pg_cron)
-- =====================================================
-- Note: This requires pg_cron extension to be enabled
-- Run monthly to archive old logs

-- SELECT cron.schedule(
--   'archive-old-audit-logs',
--   '0 2 1 * *', -- Run at 2 AM on the 1st of every month
--   $$ SELECT archive_old_audit_logs(); $$
-- );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_audit_log_archive IS 'Archive for audit logs older than 7 years';
COMMENT ON FUNCTION archive_old_audit_logs() IS 'Archives audit logs older than 7 years to cold storage';
COMMENT ON FUNCTION export_audit_logs(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], BOOLEAN) IS 'Exports audit logs for compliance and external audits';
COMMENT ON FUNCTION get_audit_log_statistics() IS 'Returns statistics about audit log storage and retention';
COMMENT ON FUNCTION search_audit_logs(VARCHAR, UUID, VARCHAR, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) IS 'Searches audit logs with flexible filters';

