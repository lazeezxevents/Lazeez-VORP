-- Finance Forecasts Schema
-- Supports AI-powered revenue forecasting, anomaly detection, and optimization

-- Forecasts table
CREATE TABLE IF NOT EXISTS finance_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'cash_flow', 'commission')),
  method TEXT NOT NULL CHECK (method IN ('linear', 'seasonal', 'ml', 'exponential')),
  baseline_data JSONB NOT NULL,
  predictions JSONB NOT NULL,
  confidence_intervals JSONB,
  accuracy_metrics JSONB,
  trend_direction TEXT CHECK (trend_direction IN ('increasing', 'decreasing', 'stable')),
  growth_rate DECIMAL(10, 4),
  seasonality_detected BOOLEAN DEFAULT FALSE,
  seasonality_pattern JSONB,
  recommendations TEXT[],
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  forecast_period_start DATE NOT NULL,
  forecast_period_end DATE NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anomalies table
CREATE TABLE IF NOT EXISTS finance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'revenue', 'expense', 'commission', 'payout')),
  entity_id UUID NOT NULL,
  anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('spike', 'drop', 'pattern_break', 'outlier', 'duplicate')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  expected_value DECIMAL(15, 2),
  actual_value DECIMAL(15, 2),
  deviation_percentage DECIMAL(10, 2),
  description TEXT NOT NULL,
  suggested_actions TEXT[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Commission optimization recommendations table
CREATE TABLE IF NOT EXISTS finance_commission_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  current_rate DECIMAL(5, 4) NOT NULL,
  recommended_rate DECIMAL(5, 4) NOT NULL,
  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(3, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  projected_impact JSONB NOT NULL,
  vendor_performance_metrics JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented')),
  implemented_at TIMESTAMPTZ,
  actual_results JSONB
);

-- Forecast accuracy tracking
CREATE TABLE IF NOT EXISTS finance_forecast_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id UUID NOT NULL REFERENCES finance_forecasts(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  predicted_value DECIMAL(15, 2) NOT NULL,
  actual_value DECIMAL(15, 2),
  error_percentage DECIMAL(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(forecast_id, period_date)
);

-- Indexes for performance
CREATE INDEX idx_finance_forecasts_type ON finance_forecasts(type);
CREATE INDEX idx_finance_forecasts_created_at ON finance_forecasts(created_at DESC);
CREATE INDEX idx_finance_forecasts_period ON finance_forecasts(forecast_period_start, forecast_period_end);
CREATE INDEX idx_finance_anomalies_entity ON finance_anomalies(entity_type, entity_id);
CREATE INDEX idx_finance_anomalies_severity ON finance_anomalies(severity, status);
CREATE INDEX idx_finance_anomalies_detected_at ON finance_anomalies(detected_at DESC);
CREATE INDEX idx_finance_commission_optimizations_vendor ON finance_commission_optimizations(vendor_id);
CREATE INDEX idx_finance_commission_optimizations_status ON finance_commission_optimizations(status);
CREATE INDEX idx_finance_forecast_accuracy_forecast ON finance_forecast_accuracy(forecast_id);

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_finance_forecast_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_finance_forecasts_timestamp
  BEFORE UPDATE ON finance_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_forecast_timestamp();

-- Function to calculate forecast accuracy
CREATE OR REPLACE FUNCTION calculate_forecast_accuracy(
  p_forecast_id UUID,
  p_period_date DATE,
  p_actual_value DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_predicted_value DECIMAL;
  v_error_percentage DECIMAL;
BEGIN
  -- Get predicted value for this period
  SELECT (predictions->>(p_period_date::TEXT))::DECIMAL
  INTO v_predicted_value
  FROM finance_forecasts
  WHERE id = p_forecast_id;

  IF v_predicted_value IS NOT NULL THEN
    -- Calculate error percentage
    v_error_percentage := ABS((p_actual_value - v_predicted_value) / NULLIF(v_predicted_value, 0)) * 100;

    -- Insert or update accuracy record
    INSERT INTO finance_forecast_accuracy (
      forecast_id,
      period_date,
      predicted_value,
      actual_value,
      error_percentage
    ) VALUES (
      p_forecast_id,
      p_period_date,
      v_predicted_value,
      p_actual_value,
      v_error_percentage
    )
    ON CONFLICT (forecast_id, period_date)
    DO UPDATE SET
      actual_value = EXCLUDED.actual_value,
      error_percentage = EXCLUDED.error_percentage,
      recorded_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomalies in transactions
CREATE OR REPLACE FUNCTION detect_transaction_anomalies()
RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
  v_avg_amount DECIMAL;
  v_stddev_amount DECIMAL;
  v_deviation DECIMAL;
  v_threshold DECIMAL := 2.5; -- 2.5 standard deviations
BEGIN
  -- Calculate average and standard deviation for recent transactions
  SELECT 
    AVG(amount),
    STDDEV(amount)
  INTO v_avg_amount, v_stddev_amount
  FROM finance_transactions
  WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days';

  -- Check recent transactions for anomalies
  FOR v_transaction IN
    SELECT *
    FROM finance_transactions
    WHERE transaction_date >= CURRENT_DATE - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM finance_anomalies
      WHERE entity_type = 'transaction'
      AND entity_id = finance_transactions.id
    )
  LOOP
    v_deviation := ABS(v_transaction.amount - v_avg_amount) / NULLIF(v_stddev_amount, 0);

    IF v_deviation > v_threshold THEN
      INSERT INTO finance_anomalies (
        entity_type,
        entity_id,
        anomaly_type,
        severity,
        expected_value,
        actual_value,
        deviation_percentage,
        description,
        suggested_actions
      ) VALUES (
        'transaction',
        v_transaction.id,
        CASE 
          WHEN v_transaction.amount > v_avg_amount THEN 'spike'
          ELSE 'drop'
        END,
        CASE 
          WHEN v_deviation > 4 THEN 'critical'
          WHEN v_deviation > 3 THEN 'high'
          ELSE 'medium'
        END,
        v_avg_amount,
        v_transaction.amount,
        ((v_transaction.amount - v_avg_amount) / NULLIF(v_avg_amount, 0)) * 100,
        format('Transaction amount deviates by %.1f standard deviations from the mean', v_deviation),
        ARRAY['Review transaction details', 'Verify with source system', 'Check for data entry errors']
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE finance_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_commission_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_forecast_accuracy ENABLE ROW LEVEL SECURITY;

-- Forecasts: Finance users can view and create
CREATE POLICY finance_forecasts_select ON finance_forecasts
  FOR SELECT
  USING (true); -- All authenticated users can view

CREATE POLICY finance_forecasts_insert ON finance_forecasts
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY finance_forecasts_update ON finance_forecasts
  FOR UPDATE
  USING (created_by = auth.uid());

-- Anomalies: Finance users can view and manage
CREATE POLICY finance_anomalies_select ON finance_anomalies
  FOR SELECT
  USING (true);

CREATE POLICY finance_anomalies_insert ON finance_anomalies
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY finance_anomalies_update ON finance_anomalies
  FOR UPDATE
  USING (true);

-- Commission optimizations: Finance users can view and manage
CREATE POLICY finance_commission_optimizations_select ON finance_commission_optimizations
  FOR SELECT
  USING (true);

CREATE POLICY finance_commission_optimizations_insert ON finance_commission_optimizations
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY finance_commission_optimizations_update ON finance_commission_optimizations
  FOR UPDATE
  USING (true);

-- Forecast accuracy: Read-only for all
CREATE POLICY finance_forecast_accuracy_select ON finance_forecast_accuracy
  FOR SELECT
  USING (true);

CREATE POLICY finance_forecast_accuracy_insert ON finance_forecast_accuracy
  FOR INSERT
  WITH CHECK (true);
