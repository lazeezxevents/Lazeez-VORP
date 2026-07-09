-- Finance Anomaly Detection System
-- Migration: 20260409_finance_anomalies.sql
-- Description: Tables and functions for detecting financial anomalies

-- Create finance_anomalies table
CREATE TABLE IF NOT EXISTS finance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES finance_transactions(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'pattern_break', 'outlier', 'duplicate', 'velocity', 'threshold')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  expected_value DECIMAL(15, 2),
  actual_value DECIMAL(15, 2) NOT NULL,
  deviation_percent DECIMAL(5, 2),
  confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  suggested_actions JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive', 'ignored')),
  investigated_by UUID REFERENCES auth.users(id),
  investigated_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_finance_anomalies_transaction ON finance_anomalies(transaction_id);
CREATE INDEX idx_finance_anomalies_type ON finance_anomalies(anomaly_type);
CREATE INDEX idx_finance_anomalies_severity ON finance_anomalies(severity);
CREATE INDEX idx_finance_anomalies_status ON finance_anomalies(status);
CREATE INDEX idx_finance_anomalies_created ON finance_anomalies(created_at DESC);

-- Create finance_anomaly_rules table for configurable detection rules
CREATE TABLE IF NOT EXISTS finance_anomaly_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('threshold', 'statistical', 'pattern', 'velocity')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'invoice', 'expense', 'payout')),
  conditions JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_finance_anomaly_rules_type ON finance_anomaly_rules(rule_type);
CREATE INDEX idx_finance_anomaly_rules_entity ON finance_anomaly_rules(entity_type);
CREATE INDEX idx_finance_anomaly_rules_active ON finance_anomaly_rules(is_active);

-- Function to calculate statistical deviation
CREATE OR REPLACE FUNCTION calculate_statistical_deviation(
  p_value DECIMAL,
  p_mean DECIMAL,
  p_std_dev DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_std_dev = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ABS((p_value - p_mean) / p_std_dev);
END;
$$;

-- Function to detect transaction anomalies (enhanced version)
CREATE OR REPLACE FUNCTION detect_transaction_anomalies()
RETURNS TABLE (
  transaction_id UUID,
  anomaly_type TEXT,
  severity TEXT,
  description TEXT,
  expected_value DECIMAL,
  actual_value DECIMAL,
  deviation_percent DECIMAL,
  confidence_score DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_mean DECIMAL;
  v_std_dev DECIMAL;
  v_threshold_high DECIMAL;
  v_threshold_low DECIMAL;
  v_z_score DECIMAL;
BEGIN
  -- Calculate statistics for the past 30 days
  SELECT 
    AVG(amount),
    STDDEV(amount)
  INTO v_mean, v_std_dev
  FROM finance_transactions
  WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    AND transaction_date < CURRENT_DATE;

  -- Set thresholds (3 standard deviations)
  v_threshold_high := v_mean + (3 * COALESCE(v_std_dev, 0));
  v_threshold_low := v_mean - (3 * COALESCE(v_std_dev, 0));

  -- Detect spikes (unusually high amounts)
  RETURN QUERY
  SELECT 
    t.id,
    'spike'::TEXT,
    CASE 
      WHEN t.amount > v_mean + (5 * COALESCE(v_std_dev, 0)) THEN 'critical'
      WHEN t.amount > v_mean + (4 * COALESCE(v_std_dev, 0)) THEN 'high'
      WHEN t.amount > v_mean + (3 * COALESCE(v_std_dev, 0)) THEN 'medium'
      ELSE 'low'
    END::TEXT,
    'Transaction amount significantly higher than average'::TEXT,
    v_mean,
    t.amount,
    ROUND(((t.amount - v_mean) / NULLIF(v_mean, 0) * 100)::NUMERIC, 2),
    ROUND((1 - (1 / (1 + calculate_statistical_deviation(t.amount, v_mean, v_std_dev))))::NUMERIC, 2)
  FROM finance_transactions t
  WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '1 day'
    AND t.amount > v_threshold_high
    AND NOT EXISTS (
      SELECT 1 FROM finance_anomalies a 
      WHERE a.transaction_id = t.id 
        AND a.anomaly_type = 'spike'
        AND a.status NOT IN ('resolved', 'false_positive')
    );

  -- Detect drops (unusually low amounts for typically high-value transactions)
  RETURN QUERY
  SELECT 
    t.id,
    'drop'::TEXT,
    CASE 
      WHEN t.amount < v_mean - (5 * COALESCE(v_std_dev, 0)) THEN 'critical'
      WHEN t.amount < v_mean - (4 * COALESCE(v_std_dev, 0)) THEN 'high'
      WHEN t.amount < v_mean - (3 * COALESCE(v_std_dev, 0)) THEN 'medium'
      ELSE 'low'
    END::TEXT,
    'Transaction amount significantly lower than average'::TEXT,
    v_mean,
    t.amount,
    ROUND(((v_mean - t.amount) / NULLIF(v_mean, 0) * 100)::NUMERIC, 2),
    ROUND((1 - (1 / (1 + calculate_statistical_deviation(t.amount, v_mean, v_std_dev))))::NUMERIC, 2)
  FROM finance_transactions t
  WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '1 day'
    AND t.amount < v_threshold_low
    AND t.amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM finance_anomalies a 
      WHERE a.transaction_id = t.id 
        AND a.anomaly_type = 'drop'
        AND a.status NOT IN ('resolved', 'false_positive')
    );

  -- Detect potential duplicates (same amount, same day, same type)
  RETURN QUERY
  SELECT 
    t1.id,
    'duplicate'::TEXT,
    'high'::TEXT,
    'Potential duplicate transaction detected'::TEXT,
    NULL::DECIMAL,
    t1.amount,
    NULL::DECIMAL,
    0.85::DECIMAL
  FROM finance_transactions t1
  WHERE t1.transaction_date >= CURRENT_DATE - INTERVAL '1 day'
    AND EXISTS (
      SELECT 1 FROM finance_transactions t2
      WHERE t2.id != t1.id
        AND t2.amount = t1.amount
        AND t2.transaction_date = t1.transaction_date
        AND t2.type = t1.type
        AND t2.created_at > t1.created_at
    )
    AND NOT EXISTS (
      SELECT 1 FROM finance_anomalies a 
      WHERE a.transaction_id = t1.id 
        AND a.anomaly_type = 'duplicate'
        AND a.status NOT IN ('resolved', 'false_positive')
    );

  -- Detect velocity anomalies (too many transactions in short time)
  RETURN QUERY
  SELECT 
    t.id,
    'velocity'::TEXT,
    'medium'::TEXT,
    'High transaction velocity detected'::TEXT,
    5::DECIMAL,
    COUNT(*)::DECIMAL,
    NULL::DECIMAL,
    0.75::DECIMAL
  FROM finance_transactions t
  WHERE t.transaction_date >= CURRENT_DATE - INTERVAL '1 hour'
  GROUP BY t.id, t.source_module, t.source_id
  HAVING COUNT(*) > 10
    AND NOT EXISTS (
      SELECT 1 FROM finance_anomalies a 
      WHERE a.transaction_id = t.id 
        AND a.anomaly_type = 'velocity'
        AND a.status NOT IN ('resolved', 'false_positive')
    );
END;
$$;

-- Function to auto-detect and record anomalies
CREATE OR REPLACE FUNCTION auto_detect_anomalies()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_anomaly RECORD;
BEGIN
  -- Detect anomalies
  FOR v_anomaly IN 
    SELECT * FROM detect_transaction_anomalies()
  LOOP
    -- Insert anomaly record
    INSERT INTO finance_anomalies (
      transaction_id,
      anomaly_type,
      severity,
      description,
      expected_value,
      actual_value,
      deviation_percent,
      confidence_score,
      suggested_actions,
      status
    ) VALUES (
      v_anomaly.transaction_id,
      v_anomaly.anomaly_type,
      v_anomaly.severity,
      v_anomaly.description,
      v_anomaly.expected_value,
      v_anomaly.actual_value,
      v_anomaly.deviation_percent,
      v_anomaly.confidence_score,
      CASE v_anomaly.anomaly_type
        WHEN 'spike' THEN jsonb_build_array(
          'Verify transaction legitimacy',
          'Check for data entry errors',
          'Review approval workflow'
        )
        WHEN 'drop' THEN jsonb_build_array(
          'Verify transaction completeness',
          'Check for missing data',
          'Review transaction source'
        )
        WHEN 'duplicate' THEN jsonb_build_array(
          'Check for duplicate entries',
          'Verify transaction uniqueness',
          'Review data import process'
        )
        WHEN 'velocity' THEN jsonb_build_array(
          'Review transaction source',
          'Check for automated processes',
          'Verify rate limiting'
        )
        ELSE jsonb_build_array('Investigate anomaly')
      END,
      'open'
    );
    
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_finance_anomalies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_finance_anomalies_updated_at
  BEFORE UPDATE ON finance_anomalies
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_anomalies_updated_at();

CREATE TRIGGER trigger_update_finance_anomaly_rules_updated_at
  BEFORE UPDATE ON finance_anomaly_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_anomalies_updated_at();

-- Enable RLS
ALTER TABLE finance_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_anomaly_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for finance_anomalies
CREATE POLICY "Finance admins can view all anomalies"
  ON finance_anomalies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('Finance Admin', 'Admin')
    )
  );

CREATE POLICY "Finance admins can insert anomalies"
  ON finance_anomalies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('Finance Admin', 'Admin')
    )
  );

CREATE POLICY "Finance admins can update anomalies"
  ON finance_anomalies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('Finance Admin', 'Admin')
    )
  );

-- RLS Policies for finance_anomaly_rules
CREATE POLICY "Finance admins can manage anomaly rules"
  ON finance_anomaly_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('Finance Admin', 'Admin')
    )
  );

-- Insert default anomaly detection rules
INSERT INTO finance_anomaly_rules (name, description, rule_type, entity_type, conditions, severity, is_active) VALUES
  ('High Value Transaction', 'Detect transactions above PKR 1,000,000', 'threshold', 'transaction', 
   '{"field": "amount", "operator": ">", "value": 1000000}'::jsonb, 'high', true),
  ('Rapid Transaction Velocity', 'Detect more than 10 transactions per hour', 'velocity', 'transaction',
   '{"count": 10, "window": "1 hour"}'::jsonb, 'medium', true),
  ('Large Expense Claim', 'Detect expense claims above PKR 100,000', 'threshold', 'expense',
   '{"field": "amount", "operator": ">", "value": 100000}'::jsonb, 'high', true),
  ('Statistical Outlier', 'Detect transactions beyond 3 standard deviations', 'statistical', 'transaction',
   '{"method": "z-score", "threshold": 3}'::jsonb, 'medium', true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON finance_anomalies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON finance_anomaly_rules TO authenticated;
GRANT EXECUTE ON FUNCTION detect_transaction_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_detect_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_statistical_deviation(DECIMAL, DECIMAL, DECIMAL) TO authenticated;

-- Add comments
COMMENT ON TABLE finance_anomalies IS 'Stores detected financial anomalies for investigation';
COMMENT ON TABLE finance_anomaly_rules IS 'Configurable rules for anomaly detection';
COMMENT ON FUNCTION detect_transaction_anomalies() IS 'Detects anomalies in recent transactions using statistical methods';
COMMENT ON FUNCTION auto_detect_anomalies() IS 'Automatically detects and records anomalies';
COMMENT ON FUNCTION calculate_statistical_deviation(DECIMAL, DECIMAL, DECIMAL) IS 'Calculates z-score for statistical anomaly detection';
