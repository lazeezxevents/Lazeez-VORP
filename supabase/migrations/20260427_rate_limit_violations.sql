-- Finance Module: Rate Limit Violations Tracking
-- Track and log rate limit violations for security monitoring

CREATE TABLE IF NOT EXISTS finance_rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  violated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rate_limit_violations_user_id ON finance_rate_limit_violations(user_id);
CREATE INDEX idx_rate_limit_violations_endpoint ON finance_rate_limit_violations(endpoint);
CREATE INDEX idx_rate_limit_violations_violated_at ON finance_rate_limit_violations(violated_at);

-- Enable RLS
ALTER TABLE finance_rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Only admins can view violations
CREATE POLICY "finance_rate_limit_violations_admin_select"
  ON finance_rate_limit_violations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- System can insert violations
CREATE POLICY "finance_rate_limit_violations_system_insert"
  ON finance_rate_limit_violations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE finance_rate_limit_violations IS 'Tracks rate limit violations for security monitoring';
COMMENT ON COLUMN finance_rate_limit_violations.user_id IS 'User who exceeded rate limit';
COMMENT ON COLUMN finance_rate_limit_violations.endpoint IS 'API endpoint that was rate limited';
COMMENT ON COLUMN finance_rate_limit_violations.request_count IS 'Number of requests in the window';
COMMENT ON COLUMN finance_rate_limit_violations.window_start IS 'Start of the rate limit window';
COMMENT ON COLUMN finance_rate_limit_violations.violated_at IS 'When the violation occurred';
