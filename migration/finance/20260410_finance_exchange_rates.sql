-- Finance Exchange Rates Table
-- Stores historical exchange rates for multi-currency support
-- Requirements: 17.4

-- Create finance_exchange_rates table
CREATE TABLE IF NOT EXISTS finance_exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(20, 10) NOT NULL CHECK (rate > 0),
  rate_date DATE NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique rate per currency pair per date
  CONSTRAINT unique_currency_pair_date UNIQUE (from_currency, to_currency, rate_date)
);

-- Create indexes for performance
CREATE INDEX idx_exchange_rates_from_currency ON finance_exchange_rates(from_currency);
CREATE INDEX idx_exchange_rates_to_currency ON finance_exchange_rates(to_currency);
CREATE INDEX idx_exchange_rates_rate_date ON finance_exchange_rates(rate_date DESC);
CREATE INDEX idx_exchange_rates_currency_pair ON finance_exchange_rates(from_currency, to_currency);

-- Add comments
COMMENT ON TABLE finance_exchange_rates IS 'Historical exchange rates for multi-currency support';
COMMENT ON COLUMN finance_exchange_rates.from_currency IS 'Source currency code (ISO 4217)';
COMMENT ON COLUMN finance_exchange_rates.to_currency IS 'Target currency code (ISO 4217)';
COMMENT ON COLUMN finance_exchange_rates.rate IS 'Exchange rate (1 from_currency = rate * to_currency)';
COMMENT ON COLUMN finance_exchange_rates.rate_date IS 'Date for which this rate is valid';
COMMENT ON COLUMN finance_exchange_rates.source IS 'Source of exchange rate (api, manual, system)';

-- Enable RLS
ALTER TABLE finance_exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read exchange rates
CREATE POLICY "Allow authenticated users to read exchange rates"
  ON finance_exchange_rates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and finance staff can insert/update exchange rates
CREATE POLICY "Allow admins and finance staff to manage exchange rates"
  ON finance_exchange_rates
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

-- Function to get latest exchange rate
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(20, 10)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rate DECIMAL(20, 10);
BEGIN
  -- If same currency, return 1
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;

  -- Get rate for specified date or most recent before that date
  SELECT rate INTO v_rate
  FROM finance_exchange_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND rate_date <= p_date
  ORDER BY rate_date DESC
  LIMIT 1;

  -- If no rate found, try inverse rate
  IF v_rate IS NULL THEN
    SELECT 1.0 / rate INTO v_rate
    FROM finance_exchange_rates
    WHERE from_currency = p_to_currency
      AND to_currency = p_from_currency
      AND rate_date <= p_date
    ORDER BY rate_date DESC
    LIMIT 1;
  END IF;

  RETURN v_rate;
END;
$$;

COMMENT ON FUNCTION get_exchange_rate IS 'Get exchange rate for currency pair on specific date, with fallback to inverse rate';

-- Function to convert currency amount
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount DECIMAL(20, 2),
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(20, 2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rate DECIMAL(20, 10);
  v_converted_amount DECIMAL(20, 2);
BEGIN
  -- Get exchange rate
  v_rate := get_exchange_rate(p_from_currency, p_to_currency, p_date);

  -- If no rate found, raise exception
  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'No exchange rate found for % to % on %', 
      p_from_currency, p_to_currency, p_date;
  END IF;

  -- Convert amount
  v_converted_amount := p_amount * v_rate;

  RETURN v_converted_amount;
END;
$$;

COMMENT ON FUNCTION convert_currency IS 'Convert amount from one currency to another using historical rates';

-- Insert base PKR rates (1 PKR = 1 PKR)
INSERT INTO finance_exchange_rates (from_currency, to_currency, rate, rate_date, source)
VALUES ('PKR', 'PKR', 1.0, CURRENT_DATE, 'system')
ON CONFLICT (from_currency, to_currency, rate_date) DO NOTHING;
