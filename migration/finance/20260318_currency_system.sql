-- =====================================================
-- Currency Management System Migration
-- =====================================================
-- Creates tables and functions for global currency management
-- Supports default currency selection and user preferences
-- =====================================================

-- =====================================================
-- 1. System Currencies Table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(3) UNIQUE NOT NULL, -- ISO 4217 currency code
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  exchange_rate DECIMAL(15, 6) DEFAULT 1.0, -- Relative to base currency (PKR)
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one default currency
CREATE UNIQUE INDEX idx_system_currencies_default 
  ON system_currencies(is_default) 
  WHERE is_default = TRUE;

CREATE INDEX idx_system_currencies_code ON system_currencies(code);
CREATE INDEX idx_system_currencies_active ON system_currencies(is_active) WHERE is_active = TRUE;

-- =====================================================
-- 2. User Currency Preferences Table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_currency_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency_code VARCHAR(3) NOT NULL REFERENCES system_currencies(code),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_currency_preferences_user ON user_currency_preferences(user_id);
CREATE INDEX idx_user_currency_preferences_currency ON user_currency_preferences(currency_code);

-- =====================================================
-- 3. Updated Timestamp Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_system_currencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_currencies_updated_at
  BEFORE UPDATE ON system_currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_system_currencies_updated_at();

CREATE OR REPLACE FUNCTION update_user_currency_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_currency_preferences_updated_at
  BEFORE UPDATE ON user_currency_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_currency_preferences_updated_at();

-- =====================================================
-- 4. RLS Policies
-- =====================================================

ALTER TABLE system_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_currency_preferences ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active currencies
CREATE POLICY "Authenticated users can view active currencies"
  ON system_currencies
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Only admins can manage currencies
CREATE POLICY "Admins can manage currencies"
  ON system_currencies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND main_role = 'admin'
    )
  );

-- Users can view their own currency preferences
CREATE POLICY "Users can view own currency preferences"
  ON user_currency_preferences
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can manage their own currency preferences
CREATE POLICY "Users can manage own currency preferences"
  ON user_currency_preferences
  FOR ALL
  USING (user_id = auth.uid());

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to set default currency (admin only)
CREATE OR REPLACE FUNCTION set_default_currency(p_currency_code VARCHAR(3))
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT main_role = 'admin' INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can set default currency';
  END IF;
  
  -- Check if currency exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM system_currencies
    WHERE code = p_currency_code AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Currency % does not exist or is not active', p_currency_code;
  END IF;
  
  -- Remove default flag from all currencies
  UPDATE system_currencies
  SET is_default = FALSE
  WHERE is_default = TRUE;
  
  -- Set new default currency
  UPDATE system_currencies
  SET is_default = TRUE
  WHERE code = p_currency_code;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get default currency
CREATE OR REPLACE FUNCTION get_default_currency()
RETURNS TABLE (
  code VARCHAR(3),
  symbol VARCHAR(10),
  name VARCHAR(100),
  exchange_rate DECIMAL(15, 6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.code,
    sc.symbol,
    sc.name,
    sc.exchange_rate
  FROM system_currencies sc
  WHERE sc.is_default = TRUE AND sc.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's preferred currency (or default)
CREATE OR REPLACE FUNCTION get_user_currency(p_user_id UUID)
RETURNS TABLE (
  code VARCHAR(3),
  symbol VARCHAR(10),
  name VARCHAR(100),
  exchange_rate DECIMAL(15, 6)
) AS $$
BEGIN
  -- Try to get user preference
  RETURN QUERY
  SELECT 
    sc.code,
    sc.symbol,
    sc.name,
    sc.exchange_rate
  FROM user_currency_preferences ucp
  JOIN system_currencies sc ON sc.code = ucp.currency_code
  WHERE ucp.user_id = p_user_id AND sc.is_active = TRUE
  LIMIT 1;
  
  -- If no preference, return default
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT * FROM get_default_currency();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert amount between currencies
CREATE OR REPLACE FUNCTION convert_currency(
  p_amount DECIMAL(15, 2),
  p_from_currency VARCHAR(3),
  p_to_currency VARCHAR(3)
)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
  v_from_rate DECIMAL(15, 6);
  v_to_rate DECIMAL(15, 6);
  v_result DECIMAL(15, 2);
BEGIN
  -- Get exchange rates
  SELECT exchange_rate INTO v_from_rate
  FROM system_currencies
  WHERE code = p_from_currency AND is_active = TRUE;
  
  SELECT exchange_rate INTO v_to_rate
  FROM system_currencies
  WHERE code = p_to_currency AND is_active = TRUE;
  
  IF v_from_rate IS NULL OR v_to_rate IS NULL THEN
    RAISE EXCEPTION 'Invalid currency code';
  END IF;
  
  -- Convert: amount in base currency = amount / from_rate
  -- amount in target currency = base_amount * to_rate
  v_result := (p_amount / v_from_rate) * v_to_rate;
  
  RETURN ROUND(v_result, 2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Seed Default Currencies
-- =====================================================

INSERT INTO system_currencies (code, symbol, name, exchange_rate, is_default, is_active) VALUES
  ('PKR', '₨', 'Pakistani Rupee', 278.500000, TRUE, TRUE),
  ('USD', '$', 'United States Dollar', 1.000000, FALSE, TRUE),
  ('EUR', '€', 'Euro', 0.920000, FALSE, TRUE),
  ('GBP', '£', 'British Pound Sterling', 0.790000, FALSE, TRUE),
  ('JPY', '¥', 'Japanese Yen', 149.500000, FALSE, TRUE),
  ('AUD', 'A$', 'Australian Dollar', 1.530000, FALSE, TRUE),
  ('CAD', 'C$', 'Canadian Dollar', 1.360000, FALSE, TRUE),
  ('CHF', 'CHF', 'Swiss Franc', 0.880000, FALSE, TRUE),
  ('CNY', '¥', 'Chinese Yuan', 7.240000, FALSE, TRUE),
  ('INR', '₹', 'Indian Rupee', 83.120000, FALSE, TRUE),
  ('AED', 'د.إ', 'UAE Dirham', 3.673000, FALSE, TRUE),
  ('SAR', 'ر.س', 'Saudi Riyal', 3.750000, FALSE, TRUE),
  ('QAR', 'ر.ق', 'Qatari Riyal', 3.640000, FALSE, TRUE),
  ('KWD', 'د.ك', 'Kuwaiti Dinar', 0.307000, FALSE, TRUE),
  ('BHD', 'د.ب', 'Bahraini Dinar', 0.376000, FALSE, TRUE),
  ('OMR', 'ر.ع.', 'Omani Rial', 0.385000, FALSE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 7. Comments for Documentation
-- =====================================================

COMMENT ON TABLE system_currencies IS 'Global currency configuration with exchange rates and default currency';
COMMENT ON TABLE user_currency_preferences IS 'User-specific currency preferences';
COMMENT ON COLUMN system_currencies.exchange_rate IS 'Exchange rate relative to PKR (base currency)';
COMMENT ON COLUMN system_currencies.is_default IS 'Indicates the system-wide default currency';
COMMENT ON FUNCTION set_default_currency(VARCHAR) IS 'Sets the system default currency (admin only)';
COMMENT ON FUNCTION get_default_currency() IS 'Returns the current default currency';
COMMENT ON FUNCTION get_user_currency(UUID) IS 'Returns user preferred currency or default';
COMMENT ON FUNCTION convert_currency(DECIMAL, VARCHAR, VARCHAR) IS 'Converts amount between two currencies';
