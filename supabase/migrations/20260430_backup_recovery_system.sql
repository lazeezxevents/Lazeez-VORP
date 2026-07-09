-- Finance Module: Backup and Recovery System
-- Automated daily backups with retention policies
-- Support point-in-time recovery

-- Backup configuration table
CREATE TABLE IF NOT EXISTS finance_backup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  retention_days INTEGER NOT NULL DEFAULT 30,
  retention_months INTEGER NOT NULL DEFAULT 84, -- 7 years
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backups metadata table
CREATE TABLE IF NOT EXISTS finance_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'monthly', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  description TEXT,
  tables TEXT[],
  size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  error_message TEXT
);

-- Recovery operations table
CREATE TABLE IF NOT EXISTS finance_recovery_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID NOT NULL REFERENCES finance_backups(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  recovery_type TEXT NOT NULL DEFAULT 'full' CHECK (recovery_type IN ('full', 'point_in_time', 'selective')),
  target_timestamp TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  performed_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_backups_status ON finance_backups(status);
CREATE INDEX idx_backups_created_at ON finance_backups(created_at DESC);
CREATE INDEX idx_backups_expires_at ON finance_backups(expires_at);
CREATE INDEX idx_backups_type ON finance_backups(backup_type);
CREATE INDEX idx_recovery_operations_backup_id ON finance_recovery_operations(backup_id);
CREATE INDEX idx_recovery_operations_started_at ON finance_recovery_operations(started_at DESC);

-- Enable RLS
ALTER TABLE finance_backup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recovery_operations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage backup configuration
CREATE POLICY "finance_backup_config_admin_all"
  ON finance_backup_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can view and manage backups
CREATE POLICY "finance_backups_admin_all"
  ON finance_backups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can view and manage recovery operations
CREATE POLICY "finance_recovery_operations_admin_all"
  ON finance_recovery_operations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default backup configuration
INSERT INTO finance_backup_config (frequency, retention_days, retention_months, enabled)
VALUES ('daily', 30, 84, true)
ON CONFLICT DO NOTHING;

-- Function to schedule daily backup
CREATE OR REPLACE FUNCTION schedule_daily_backup()
RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration date (30 days from now)
  v_expires_at := NOW() + INTERVAL '30 days';
  
  -- Create backup record
  INSERT INTO finance_backups (
    backup_type,
    status,
    description,
    expires_at
  ) VALUES (
    'daily',
    'pending',
    'Automated daily backup',
    v_expires_at
  ) RETURNING id INTO v_backup_id;
  
  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to schedule monthly backup
CREATE OR REPLACE FUNCTION schedule_monthly_backup()
RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration date (7 years from now)
  v_expires_at := NOW() + INTERVAL '7 years';
  
  -- Create backup record
  INSERT INTO finance_backups (
    backup_type,
    status,
    description,
    expires_at
  ) VALUES (
    'monthly',
    'pending',
    'Automated monthly backup',
    v_expires_at
  ) RETURNING id INTO v_backup_id;
  
  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired backups
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired backups
  WITH deleted AS (
    DELETE FROM finance_backups
    WHERE expires_at < NOW()
    AND status = 'completed'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on backup config
CREATE OR REPLACE FUNCTION update_backup_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_backup_config_updated_at
  BEFORE UPDATE ON finance_backup_config
  FOR EACH ROW
  EXECUTE FUNCTION update_backup_config_updated_at();

-- Schedule daily backups using pg_cron (if available)
-- Note: pg_cron must be enabled in Supabase project
-- SELECT cron.schedule('finance-daily-backup', '0 2 * * *', 'SELECT schedule_daily_backup()');
-- SELECT cron.schedule('finance-monthly-backup', '0 3 1 * *', 'SELECT schedule_monthly_backup()');
-- SELECT cron.schedule('finance-cleanup-backups', '0 4 * * *', 'SELECT cleanup_expired_backups()');

COMMENT ON TABLE finance_backup_config IS 'Configuration for automated backup schedule';
COMMENT ON TABLE finance_backups IS 'Metadata for finance module backups';
COMMENT ON TABLE finance_recovery_operations IS 'Log of recovery operations';
COMMENT ON FUNCTION schedule_daily_backup IS 'Schedule a daily backup (30-day retention)';
COMMENT ON FUNCTION schedule_monthly_backup IS 'Schedule a monthly backup (7-year retention)';
COMMENT ON FUNCTION cleanup_expired_backups IS 'Remove expired backups';
