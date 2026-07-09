-- =====================================================
-- FX Transactions Table
-- =====================================================
-- Description: Tracks foreign exchange transactions and gain/loss
-- Requirements: 17.7, 17.8
-- Task: 46.5
-- =====================================================

-- =====================================================
-- FX Transactions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_fx_transactions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transaction Details
  transaction_date DATE NOT NULL,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  from_amount DECIMAL(15, 2) NOT NULL,
  to_amount DECIMAL(15, 2) NOT NULL,
  exchange_rate DECIMAL(15, 6) NOT NULL,
  
  -- Source Tracking
  source_transaction_id UUID,
  source_module VARCHAR(50),
  
  -- Gain/Loss Tracking
  realized_gain_loss DECIMAL(15, 2),
  unrealized_gain_loss DECIMAL(15, 2),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_fx_transactions_date ON finance_fx_transactions(transaction_date);
CREATE INDEX idx_fx_transactions_from_currency ON finance_fx_transactions(from_currency);
CREATE INDEX idx_fx_transactions_to_currency ON finance_fx_transactions(to_currency);
CREATE INDEX idx_fx_transactions_source ON finance_fx_transactions(source_transaction_id);
CREATE INDEX idx_fx_transactions_created_at ON finance_fx_transactions(created_at);

-- =====================================================
-- Functions
-- =====================================================

-- Function to calculate FX gain/loss
CREATE OR REPLACE FUNCTION calculate_fx_gain_loss(
  p_transaction_id UUID,
  p_current_rate DECIMAL(15, 6)
)
RETURNS TABLE (
  realized_gain_loss DECIMAL(15, 2),
  unrealized_gain_loss DECIMAL(15, 2)
) AS $$
DECLARE
  v_from_amount DECIMAL(15, 2);
  v_original_rate DECIMAL(15, 6);
  v_original_value DECIMAL(15, 2);
  v_current_value DECIMAL(15, 2);
BEGIN
  -- Get transaction details
  SELECT from_amount, exchange_rate
  INTO v_from_amount, v_original_rate
  FROM finance_fx_transactions
  WHERE id = p_transaction_id;
  
  -- Calculate original and current values
  v_original_value := v_from_amount * v_original_rate;
  v_current_value := v_from_amount * p_current_rate;
  
  -- Return gain/loss
  RETURN QUERY SELECT 
    v_current_value - v_original_value AS realized_gain_loss,
    v_current_value - v_original_value AS unrealized_gain_loss;
END;
$$ LANGUAGE plpgsql;

-- Function to get FX summary for a period
CREATE OR REPLACE FUNCTION get_fx_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_currency VARCHAR(3) DEFAULT NULL
)
RETURNS TABLE (
  total_transactions BIGINT,
  total_from_amount DECIMAL(15, 2),
  total_to_amount DECIMAL(15, 2),
  total_gain_loss DECIMAL(15, 2),
  currency_pairs JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_transactions,
    COALESCE(SUM(from_amount), 0) AS total_from_amount,
    COALESCE(SUM(to_amount), 0) AS total_to_amount,
    COALESCE(SUM(realized_gain_loss), 0) AS total_gain_loss,
    jsonb_agg(
      DISTINCT jsonb_build_object(
        'from', from_currency,
        'to', to_currency,
        'count', COUNT(*)
      )
    ) AS currency_pairs
  FROM finance_fx_transactions
  WHERE transaction_date >= p_start_date
    AND transaction_date <= p_end_date
    AND (p_currency IS NULL OR from_currency = p_currency OR to_currency = p_currency);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_fx_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fx_transactions_updated_at
  BEFORE UPDATE ON finance_fx_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_fx_transactions_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE finance_fx_transactions ENABLE ROW LEVEL SECURITY;

-- Finance users can view FX transactions
CREATE POLICY "Finance users can view FX transactions"
  ON finance_fx_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

-- Finance admins can manage FX transactions
CREATE POLICY "Finance admins can manage FX transactions"
  ON finance_fx_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_fx_transactions IS 'Tracks foreign exchange transactions and realized/unrealized gains and losses';
COMMENT ON COLUMN finance_fx_transactions.from_currency IS 'Source currency code (e.g., PKR, USD)';
COMMENT ON COLUMN finance_fx_transactions.to_currency IS 'Target currency code (e.g., PKR, USD)';
COMMENT ON COLUMN finance_fx_transactions.exchange_rate IS 'Exchange rate used for conversion';
COMMENT ON COLUMN finance_fx_transactions.realized_gain_loss IS 'Realized gain or loss on the transaction';
COMMENT ON COLUMN finance_fx_transactions.unrealized_gain_loss IS 'Unrealized gain or loss based on current rates';

COMMENT ON FUNCTION calculate_fx_gain_loss(UUID, DECIMAL) IS 'Calculates realized and unrealized FX gain/loss for a transaction';
COMMENT ON FUNCTION get_fx_summary(DATE, DATE, VARCHAR) IS 'Gets FX transaction summary for a period';
