-- Advanced financial metrics overrides (user-editable tiles)

-- Stores user-specified override values for each advanced metric.
-- Overrides are global (one value per metric_key) and take precedence over auto-calculated values.

CREATE TABLE IF NOT EXISTS finance_advanced_metrics_overrides (
  metric_key TEXT PRIMARY KEY,
  metric_value NUMERIC(20, 6) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE finance_advanced_metrics_overrides ENABLE ROW LEVEL SECURITY;

-- View: allow finance users (and admins)
CREATE POLICY "Finance users can view advanced metrics overrides"
  ON finance_advanced_metrics_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN role_assignments ra ON ra.user_id = p.id
      JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          cr.permissions->>'finance' IS NOT NULL
          OR p.main_role::text = 'admin'::text
        )
    )
  );

-- Manage: allow finance managers (and admins)
CREATE POLICY "Finance admins can manage advanced metrics overrides"
  ON finance_advanced_metrics_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role::text = 'admin'::text
          OR (cr.permissions->'finance'->>'manage' = 'true')
        )
    )
  );

-- Keep updated_at fresh on writes
CREATE OR REPLACE FUNCTION update_finance_advanced_metrics_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_advanced_metrics_overrides_updated_at ON finance_advanced_metrics_overrides;
CREATE TRIGGER finance_advanced_metrics_overrides_updated_at
  BEFORE UPDATE ON finance_advanced_metrics_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_advanced_metrics_overrides_updated_at();

