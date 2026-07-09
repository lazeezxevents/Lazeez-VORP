-- =====================================================
-- Tax Calculation System
-- =====================================================
-- Description: Database schema for tax calculation and compliance
-- Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8
-- Task: 47.1, 47.2, 47.3
-- =====================================================

-- =====================================================
-- Tax Jurisdictions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_tax_jurisdictions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Jurisdiction Details
  jurisdiction_code VARCHAR(10) NOT NULL UNIQUE,
  jurisdiction_name VARCHAR(255) NOT NULL,
  country_code VARCHAR(3) NOT NULL,
  region VARCHAR(100),
  
  -- Tax Configuration
  tax_types JSONB NOT NULL DEFAULT '[]', -- Array of tax types (VAT, GST, income_tax, etc.)
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Tax Rules Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_tax_rules (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  jurisdiction_id UUID NOT NULL REFERENCES finance_tax_jurisdictions(id) ON DELETE CASCADE,
  
  -- Rule Details
  tax_type VARCHAR(50) NOT NULL CHECK (tax_type IN ('VAT', 'GST', 'income_tax', 'sales_tax', 'withholding_tax')),
  tax_rate DECIMAL(5, 2) NOT NULL, -- Percentage (e.g., 17.00 for 17%)
  
  -- Applicability
  applies_to VARCHAR(50) NOT NULL CHECK (applies_to IN ('sales', 'purchases', 'income', 'expenses', 'all')),
  category VARCHAR(100), -- Optional category filter
  threshold_amount DECIMAL(15, 2), -- Minimum amount for tax to apply
  
  -- Effective Period
  effective_from DATE NOT NULL,
  effective_to DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Tax Calculations Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_tax_calculations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  jurisdiction_id UUID NOT NULL REFERENCES finance_tax_jurisdictions(id),
  tax_rule_id UUID NOT NULL REFERENCES finance_tax_rules(id),
  
  -- Transaction Reference
  transaction_id UUID,
  transaction_type VARCHAR(50) NOT NULL,
  transaction_date DATE NOT NULL,
  
  -- Calculation Details
  taxable_amount DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL,
  
  -- Audit
  calculated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Tax Reports Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_tax_reports (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  jurisdiction_id UUID NOT NULL REFERENCES finance_tax_jurisdictions(id),
  
  -- Report Details
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('VAT', 'GST', 'income_tax', 'sales_tax', 'quarterly', 'annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Calculations
  total_sales DECIMAL(15, 2) NOT NULL DEFAULT 0,
  taxable_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_collected DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_paid DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_tax_liability DECIMAL(15, 2) NOT NULL DEFAULT 0,
  
  -- Filing Details
  filing_deadline DATE,
  filing_status VARCHAR(20) DEFAULT 'draft' CHECK (filing_status IN ('draft', 'pending', 'filed', 'paid')),
  filed_at TIMESTAMPTZ,
  filed_by UUID REFERENCES auth.users(id),
  
  -- Report Data
  report_data JSONB, -- Detailed breakdown
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_tax_jurisdictions_code ON finance_tax_jurisdictions(jurisdiction_code);
CREATE INDEX idx_tax_jurisdictions_country ON finance_tax_jurisdictions(country_code);

CREATE INDEX idx_tax_rules_jurisdiction ON finance_tax_rules(jurisdiction_id);
CREATE INDEX idx_tax_rules_type ON finance_tax_rules(tax_type);
CREATE INDEX idx_tax_rules_effective ON finance_tax_rules(effective_from, effective_to);

CREATE INDEX idx_tax_calculations_jurisdiction ON finance_tax_calculations(jurisdiction_id);
CREATE INDEX idx_tax_calculations_transaction ON finance_tax_calculations(transaction_id);
CREATE INDEX idx_tax_calculations_date ON finance_tax_calculations(transaction_date);

CREATE INDEX idx_tax_reports_jurisdiction ON finance_tax_reports(jurisdiction_id);
CREATE INDEX idx_tax_reports_period ON finance_tax_reports(period_start, period_end);
CREATE INDEX idx_tax_reports_status ON finance_tax_reports(filing_status);
CREATE INDEX idx_tax_reports_deadline ON finance_tax_reports(filing_deadline);

-- =====================================================
-- Functions
-- =====================================================

-- Function to calculate tax
CREATE OR REPLACE FUNCTION calculate_tax(
  p_jurisdiction_code VARCHAR(10),
  p_tax_type VARCHAR(50),
  p_taxable_amount DECIMAL(15, 2),
  p_transaction_date DATE
)
RETURNS TABLE (
  tax_amount DECIMAL(15, 2),
  tax_rate DECIMAL(5, 2),
  rule_id UUID
) AS $$
DECLARE
  v_jurisdiction_id UUID;
  v_rule RECORD;
BEGIN
  -- Get jurisdiction ID
  SELECT id INTO v_jurisdiction_id
  FROM finance_tax_jurisdictions
  WHERE jurisdiction_code = p_jurisdiction_code
    AND is_active = TRUE;
  
  IF v_jurisdiction_id IS NULL THEN
    RAISE EXCEPTION 'Jurisdiction not found: %', p_jurisdiction_code;
  END IF;
  
  -- Find applicable tax rule
  SELECT * INTO v_rule
  FROM finance_tax_rules
  WHERE jurisdiction_id = v_jurisdiction_id
    AND tax_type = p_tax_type
    AND is_active = TRUE
    AND effective_from <= p_transaction_date
    AND (effective_to IS NULL OR effective_to >= p_transaction_date)
    AND (threshold_amount IS NULL OR p_taxable_amount >= threshold_amount)
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_rule IS NULL THEN
    -- No applicable rule found, return zero tax
    RETURN QUERY SELECT 0::DECIMAL(15, 2), 0::DECIMAL(5, 2), NULL::UUID;
    RETURN;
  END IF;
  
  -- Calculate tax
  RETURN QUERY SELECT 
    ROUND(p_taxable_amount * v_rule.tax_rate / 100, 2) AS tax_amount,
    v_rule.tax_rate,
    v_rule.id AS rule_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate tax report
CREATE OR REPLACE FUNCTION generate_tax_report(
  p_jurisdiction_code VARCHAR(10),
  p_report_type VARCHAR(50),
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE (
  total_sales DECIMAL(15, 2),
  taxable_amount DECIMAL(15, 2),
  tax_collected DECIMAL(15, 2),
  tax_paid DECIMAL(15, 2),
  net_tax_liability DECIMAL(15, 2)
) AS $$
DECLARE
  v_jurisdiction_id UUID;
BEGIN
  -- Get jurisdiction ID
  SELECT id INTO v_jurisdiction_id
  FROM finance_tax_jurisdictions
  WHERE jurisdiction_code = p_jurisdiction_code;
  
  IF v_jurisdiction_id IS NULL THEN
    RAISE EXCEPTION 'Jurisdiction not found: %', p_jurisdiction_code;
  END IF;
  
  -- Calculate totals
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'sale' THEN taxable_amount ELSE 0 END), 0) AS total_sales,
    COALESCE(SUM(taxable_amount), 0) AS taxable_amount,
    COALESCE(SUM(CASE WHEN transaction_type = 'sale' THEN tax_amount ELSE 0 END), 0) AS tax_collected,
    COALESCE(SUM(CASE WHEN transaction_type = 'purchase' THEN tax_amount ELSE 0 END), 0) AS tax_paid,
    COALESCE(
      SUM(CASE WHEN transaction_type = 'sale' THEN tax_amount ELSE 0 END) -
      SUM(CASE WHEN transaction_type = 'purchase' THEN tax_amount ELSE 0 END),
      0
    ) AS net_tax_liability
  FROM finance_tax_calculations
  WHERE jurisdiction_id = v_jurisdiction_id
    AND transaction_date >= p_period_start
    AND transaction_date <= p_period_end;
END;
$$ LANGUAGE plpgsql;

-- Function to get next filing deadline
CREATE OR REPLACE FUNCTION get_next_filing_deadline(
  p_jurisdiction_code VARCHAR(10),
  p_report_type VARCHAR(50)
)
RETURNS DATE AS $$
DECLARE
  v_next_deadline DATE;
BEGIN
  -- Simple logic: quarterly deadlines on 15th of month following quarter end
  -- This should be customized based on actual jurisdiction requirements
  
  CASE p_report_type
    WHEN 'quarterly' THEN
      -- Next quarter end + 15 days
      v_next_deadline := DATE_TRUNC('quarter', CURRENT_DATE + INTERVAL '3 months') + INTERVAL '14 days';
    WHEN 'annual' THEN
      -- Next year end + 3 months + 15 days
      v_next_deadline := DATE_TRUNC('year', CURRENT_DATE + INTERVAL '1 year') + INTERVAL '3 months 14 days';
    ELSE
      -- Monthly: next month end + 15 days
      v_next_deadline := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') + INTERVAL '14 days';
  END CASE;
  
  RETURN v_next_deadline;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_tax_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tax_jurisdictions_updated_at
  BEFORE UPDATE ON finance_tax_jurisdictions
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_tables_updated_at();

CREATE TRIGGER tax_rules_updated_at
  BEFORE UPDATE ON finance_tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_tables_updated_at();

CREATE TRIGGER tax_reports_updated_at
  BEFORE UPDATE ON finance_tax_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_tables_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE finance_tax_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_tax_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_tax_reports ENABLE ROW LEVEL SECURITY;

-- Finance users can view tax data
CREATE POLICY "Finance users can view tax jurisdictions"
  ON finance_tax_jurisdictions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

CREATE POLICY "Finance users can view tax rules"
  ON finance_tax_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

CREATE POLICY "Finance users can view tax calculations"
  ON finance_tax_calculations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

CREATE POLICY "Finance users can view tax reports"
  ON finance_tax_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

-- Finance admins can manage tax data
CREATE POLICY "Finance admins can manage tax jurisdictions"
  ON finance_tax_jurisdictions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Finance admins can manage tax rules"
  ON finance_tax_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Finance admins can manage tax calculations"
  ON finance_tax_calculations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Finance admins can manage tax reports"
  ON finance_tax_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- =====================================================
-- Seed Data - Pakistan Tax Configuration
-- =====================================================

-- Insert Pakistan jurisdiction
INSERT INTO finance_tax_jurisdictions (jurisdiction_code, jurisdiction_name, country_code, tax_types)
VALUES (
  'PK',
  'Pakistan',
  'PAK',
  '["GST", "income_tax", "withholding_tax"]'::JSONB
) ON CONFLICT (jurisdiction_code) DO NOTHING;

-- Insert GST rule for Pakistan (17%)
INSERT INTO finance_tax_rules (
  jurisdiction_id,
  tax_type,
  tax_rate,
  applies_to,
  effective_from,
  is_active
)
SELECT 
  id,
  'GST',
  17.00,
  'sales',
  '2024-01-01',
  TRUE
FROM finance_tax_jurisdictions
WHERE jurisdiction_code = 'PK'
ON CONFLICT DO NOTHING;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_tax_jurisdictions IS 'Stores tax jurisdictions and their configurations';
COMMENT ON TABLE finance_tax_rules IS 'Stores tax rules for different jurisdictions and tax types';
COMMENT ON TABLE finance_tax_calculations IS 'Stores individual tax calculations for transactions';
COMMENT ON TABLE finance_tax_reports IS 'Stores tax reports for filing and compliance';

COMMENT ON FUNCTION calculate_tax(VARCHAR, VARCHAR, DECIMAL, DATE) IS 'Calculates tax amount based on jurisdiction, type, and amount';
COMMENT ON FUNCTION generate_tax_report(VARCHAR, VARCHAR, DATE, DATE) IS 'Generates tax report summary for a period';
COMMENT ON FUNCTION get_next_filing_deadline(VARCHAR, VARCHAR) IS 'Calculates the next tax filing deadline';
