-- =====================================================
-- Fraud Prevention System
-- =====================================================
-- Description: Transaction monitoring and fraud detection
-- Requirements: 16.1 (extended)
-- Task: 49.1, 49.2
-- =====================================================

-- =====================================================
-- Fraud Rules Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule details
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('large_transaction', 'velocity', 'pattern', 'duplicate', 'threshold')),
  description TEXT,
  
  -- Rule configuration
  threshold_amount DECIMAL(15, 2),
  time_window_minutes INTEGER,
  max_transactions_per_window INTEGER,
  
  -- Severity and actions
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  auto_block BOOLEAN DEFAULT FALSE,
  require_approval BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fraud_rules_type ON finance_fraud_rules(rule_type);
CREATE INDEX idx_fraud_rules_active ON finance_fraud_rules(is_active);

-- =====================================================
-- Fraud Alerts Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Alert details
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  
  -- Related entities
  transaction_id UUID REFERENCES finance_transactions(id),
  entity_type VARCHAR(50),
  entity_id UUID,
  
  -- Alert data
  alert_data JSONB,
  triggered_rule_id UUID REFERENCES finance_fraud_rules(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  resolution_notes TEXT,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_fraud_alerts_status ON finance_fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_severity ON finance_fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_transaction ON finance_fraud_alerts(transaction_id);
CREATE INDEX idx_fraud_alerts_detected_at ON finance_fraud_alerts(detected_at);

-- =====================================================
-- Transaction Approval Queue Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_transaction_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction details
  transaction_id UUID REFERENCES finance_transactions(id),
  transaction_type VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  
  -- Approval requirements
  required_approvals INTEGER NOT NULL DEFAULT 1,
  approval_level VARCHAR(20) NOT NULL CHECK (approval_level IN ('manager', 'senior_manager', 'director', 'cfo')),
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  
  -- Approvals tracking
  approvals JSONB DEFAULT '[]'::JSONB,
  
  -- Execution
  execute_after TIMESTAMPTZ, -- Time-delayed execution
  executed_at TIMESTAMPTZ,
  
  -- Audit
  requested_by UUID REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_transaction_approvals_status ON finance_transaction_approvals(status);
CREATE INDEX idx_transaction_approvals_transaction ON finance_transaction_approvals(transaction_id);
CREATE INDEX idx_transaction_approvals_execute_after ON finance_transaction_approvals(execute_after);

-- =====================================================
-- Function: Check large transaction
-- =====================================================

CREATE OR REPLACE FUNCTION check_large_transaction(
  p_amount DECIMAL(15, 2),
  p_transaction_type VARCHAR(50)
)
RETURNS TABLE (
  is_flagged BOOLEAN,
  severity VARCHAR(20),
  rule_id UUID,
  description TEXT
) AS $
DECLARE
  v_rule RECORD;
BEGIN
  -- Find applicable rule
  SELECT * INTO v_rule
  FROM finance_fraud_rules
  WHERE rule_type = 'large_transaction'
    AND is_active = TRUE
    AND threshold_amount IS NOT NULL
    AND p_amount >= threshold_amount
  ORDER BY threshold_amount DESC
  LIMIT 1;
  
  IF v_rule IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::VARCHAR(20), NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    TRUE,
    v_rule.severity,
    v_rule.id,
    format('Large %s transaction detected: %s exceeds threshold of %s', 
           p_transaction_type, p_amount, v_rule.threshold_amount);
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Check transaction velocity
-- =====================================================

CREATE OR REPLACE FUNCTION check_transaction_velocity(
  p_entity_type VARCHAR(50),
  p_entity_id UUID,
  p_transaction_type VARCHAR(50)
)
RETURNS TABLE (
  is_flagged BOOLEAN,
  severity VARCHAR(20),
  rule_id UUID,
  description TEXT,
  transaction_count INTEGER
) AS $
DECLARE
  v_rule RECORD;
  v_count INTEGER;
BEGIN
  -- Find applicable velocity rule
  SELECT * INTO v_rule
  FROM finance_fraud_rules
  WHERE rule_type = 'velocity'
    AND is_active = TRUE
    AND time_window_minutes IS NOT NULL
    AND max_transactions_per_window IS NOT NULL
  ORDER BY severity DESC
  LIMIT 1;
  
  IF v_rule IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::VARCHAR(20), NULL::UUID, NULL::TEXT, 0;
    RETURN;
  END IF;
  
  -- Count recent transactions
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM finance_transactions
  WHERE source_module = p_entity_type
    AND source_id = p_entity_id
    AND type = p_transaction_type
    AND created_at >= NOW() - (v_rule.time_window_minutes || ' minutes')::INTERVAL;
  
  IF v_count >= v_rule.max_transactions_per_window THEN
    RETURN QUERY SELECT 
      TRUE,
      v_rule.severity,
      v_rule.id,
      format('High transaction velocity detected: %s transactions in %s minutes (limit: %s)', 
             v_count, v_rule.time_window_minutes, v_rule.max_transactions_per_window),
      v_count;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::VARCHAR(20), NULL::UUID, NULL::TEXT, v_count;
  END IF;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Create fraud alert
-- =====================================================

CREATE OR REPLACE FUNCTION create_fraud_alert(
  p_alert_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_description TEXT,
  p_transaction_id UUID DEFAULT NULL,
  p_entity_type VARCHAR(50) DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_alert_data JSONB DEFAULT NULL,
  p_rule_id UUID DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO finance_fraud_alerts (
    alert_type,
    severity,
    description,
    transaction_id,
    entity_type,
    entity_id,
    alert_data,
    triggered_rule_id
  ) VALUES (
    p_alert_type,
    p_severity,
    p_description,
    p_transaction_id,
    p_entity_type,
    p_entity_id,
    p_alert_data,
    p_rule_id
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Request transaction approval
-- =====================================================

CREATE OR REPLACE FUNCTION request_transaction_approval(
  p_transaction_id UUID,
  p_transaction_type VARCHAR(50),
  p_amount DECIMAL(15, 2),
  p_required_approvals INTEGER DEFAULT 1,
  p_approval_level VARCHAR(20) DEFAULT 'manager',
  p_delay_minutes INTEGER DEFAULT 0
)
RETURNS UUID AS $
DECLARE
  v_approval_id UUID;
  v_execute_after TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate execution time (with delay if specified)
  v_execute_after := CASE 
    WHEN p_delay_minutes > 0 THEN NOW() + (p_delay_minutes || ' minutes')::INTERVAL
    ELSE NULL
  END;
  
  -- Set expiration (24 hours from now)
  v_expires_at := NOW() + INTERVAL '24 hours';
  
  INSERT INTO finance_transaction_approvals (
    transaction_id,
    transaction_type,
    amount,
    required_approvals,
    approval_level,
    execute_after,
    expires_at,
    requested_by
  ) VALUES (
    p_transaction_id,
    p_transaction_type,
    p_amount,
    p_required_approvals,
    p_approval_level,
    v_execute_after,
    v_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_approval_id;
  
  RETURN v_approval_id;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Approve transaction
-- =====================================================

CREATE OR REPLACE FUNCTION approve_transaction(
  p_approval_id UUID,
  p_approval_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $
DECLARE
  v_approval RECORD;
  v_approvals JSONB;
  v_approval_count INTEGER;
BEGIN
  -- Get approval record
  SELECT * INTO v_approval
  FROM finance_transaction_approvals
  WHERE id = p_approval_id
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found or already processed';
  END IF;
  
  -- Add approval to list
  v_approvals := v_approval.approvals || jsonb_build_object(
    'approved_by', auth.uid(),
    'approved_at', NOW(),
    'notes', p_approval_notes
  );
  
  -- Count approvals
  v_approval_count := jsonb_array_length(v_approvals);
  
  -- Update approval record
  UPDATE finance_transaction_approvals
  SET 
    approvals = v_approvals,
    status = CASE 
      WHEN v_approval_count >= v_approval.required_approvals THEN 'approved'
      ELSE 'pending'
    END
  WHERE id = p_approval_id;
  
  RETURN v_approval_count >= v_approval.required_approvals;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Reject transaction
-- =====================================================

CREATE OR REPLACE FUNCTION reject_transaction(
  p_approval_id UUID,
  p_rejection_reason TEXT
)
RETURNS BOOLEAN AS $
BEGIN
  UPDATE finance_transaction_approvals
  SET 
    status = 'rejected',
    approvals = approvals || jsonb_build_object(
      'rejected_by', auth.uid(),
      'rejected_at', NOW(),
      'reason', p_rejection_reason
    )
  WHERE id = p_approval_id
    AND status = 'pending';
  
  RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_fraud_tables_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER fraud_rules_updated_at
  BEFORE UPDATE ON finance_fraud_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_fraud_tables_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE finance_fraud_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transaction_approvals ENABLE ROW LEVEL SECURITY;

-- Finance admins can manage fraud rules
CREATE POLICY "Finance admins can manage fraud rules"
  ON finance_fraud_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
      AND (
        p.main_role = 'admin'
        OR cr.permissions->>'finance' IS NOT NULL
      )
    )
  );

-- Finance users can view fraud alerts
CREATE POLICY "Finance users can view fraud alerts"
  ON finance_fraud_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
      AND (
        p.main_role = 'admin'
        OR cr.permissions->>'finance' IS NOT NULL
      )
    )
  );

-- Finance admins can manage fraud alerts
CREATE POLICY "Finance admins can manage fraud alerts"
  ON finance_fraud_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- Finance users can view transaction approvals
CREATE POLICY "Finance users can view transaction approvals"
  ON finance_transaction_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- Finance admins can manage transaction approvals
CREATE POLICY "Finance admins can manage transaction approvals"
  ON finance_transaction_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- =====================================================
-- Seed Data - Default Fraud Rules
-- =====================================================

-- Large transaction rule
INSERT INTO finance_fraud_rules (
  rule_name,
  rule_type,
  description,
  threshold_amount,
  severity,
  require_approval,
  is_active
) VALUES (
  'Large Payout Detection',
  'large_transaction',
  'Flag payouts exceeding PKR 1,000,000',
  1000000.00,
  'high',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- Critical large transaction rule
INSERT INTO finance_fraud_rules (
  rule_name,
  rule_type,
  description,
  threshold_amount,
  severity,
  auto_block,
  require_approval,
  is_active
) VALUES (
  'Critical Large Payout',
  'large_transaction',
  'Block payouts exceeding PKR 5,000,000',
  5000000.00,
  'critical',
  TRUE,
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- Transaction velocity rule
INSERT INTO finance_fraud_rules (
  rule_name,
  rule_type,
  description,
  time_window_minutes,
  max_transactions_per_window,
  severity,
  require_approval,
  is_active
) VALUES (
  'High Transaction Velocity',
  'velocity',
  'Flag more than 10 transactions in 5 minutes',
  5,
  10,
  'medium',
  FALSE,
  TRUE
) ON CONFLICT DO NOTHING;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_fraud_rules IS 'Fraud detection rules and thresholds';
COMMENT ON TABLE finance_fraud_alerts IS 'Fraud alerts and suspicious activity';
COMMENT ON TABLE finance_transaction_approvals IS 'Transaction approval queue for high-risk transactions';

COMMENT ON FUNCTION check_large_transaction(DECIMAL, VARCHAR) IS 'Checks if transaction amount exceeds fraud threshold';
COMMENT ON FUNCTION check_transaction_velocity(VARCHAR, UUID, VARCHAR) IS 'Checks transaction velocity for suspicious patterns';
COMMENT ON FUNCTION create_fraud_alert(VARCHAR, VARCHAR, TEXT, UUID, VARCHAR, UUID, JSONB, UUID) IS 'Creates a fraud alert';
COMMENT ON FUNCTION request_transaction_approval(UUID, VARCHAR, DECIMAL, INTEGER, VARCHAR, INTEGER) IS 'Requests approval for high-risk transaction';
COMMENT ON FUNCTION approve_transaction(UUID, TEXT) IS 'Approves a pending transaction';
COMMENT ON FUNCTION reject_transaction(UUID, TEXT) IS 'Rejects a pending transaction';

