-- Finance FX Transactions Table
-- Tracks foreign exchange transactions and gains/losses
-- Requirements: 17.7, 17.8

-- Create finance_fx_transactions table
CREATE TABLE IF NOT EXISTS finance_fx_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  from_amount DECIMAL(20, 2) NOT NULL CHECK (from_amount >= 0),
  to_amount DECIMAL(20, 2) NOT NULL CHECK (to_amount >= 0),
  exchange_rate DECIMAL(20, 10) NOT NULL CHECK (exchange_rate > 0),
  fx_gain_loss DECIMAL(20, 2) NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_fx_transactions_transaction_id ON finance_fx_transactions(transaction_id);
CREATE INDEX idx_fx_transactions_date ON finance_fx_transactions(transaction_date DESC);
CREATE INDEX idx_fx_transactions_from_currency ON finance_fx_transactions(from_currency);
CREATE INDEX idx_fx_transactions_to_currency ON finance_fx_transactions(to_currency);
CREATE INDEX idx_fx_transactions_created_by ON finance_fx_transactions(created_by);

-- Add comments
COMMENT ON TABLE finance_fx_transactions IS 'Foreign exchange transactions with gain/loss tracking';
COMMENT ON COLUMN finance_fx_transactions.fx_gain_loss IS 'FX gain (positive) or loss (negative) in base currency';

-- Enable RLS
ALTER TABLE finance_fx_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read FX transactions"
  ON finance_fx_transactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert FX transactions"
  ON finance_fx_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Allow admins and finance staff to manage FX transactions"
  ON finance_fx_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'staff')
    )
  );
