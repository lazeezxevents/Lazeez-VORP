-- =====================================================
-- Finance Vendor Profiles Migration
-- =====================================================
-- Creates the finance_vendor_profiles table for managing vendor financial data
-- including commission rules, subscription data, and payment terms
--
-- Requirements: 3.7, 6.9
-- =====================================================

-- =====================================================
-- 1. Vendor Financial Profiles Table
-- =====================================================
-- Stores financial configuration and tracking data for each vendor

CREATE TABLE IF NOT EXISTS finance_vendor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID UNIQUE NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Commission Configuration
  commission_model VARCHAR(20) DEFAULT 'percentage' CHECK (commission_model IN ('flat', 'percentage', 'tiered', 'category_based')),
  commission_rate DECIMAL(5, 2),
  commission_rules JSONB DEFAULT '{}',
  
  -- Subscription Management
  subscription_id UUID,
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled', 'pending')),
  current_threshold INTEGER DEFAULT 0,
  threshold_limit INTEGER,
  
  -- Financial Tracking
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  total_commission_paid DECIMAL(15, 2) DEFAULT 0,
  total_payouts DECIMAL(15, 2) DEFAULT 0,
  outstanding_balance DECIMAL(15, 2) DEFAULT 0,
  
  -- Payment Configuration
  payment_terms VARCHAR(50),
  preferred_payment_method VARCHAR(50),
  bank_details JSONB,
  tax_id VARCHAR(50),
  
  -- Dates
  last_payout_date TIMESTAMPTZ,
  next_billing_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_vendor ON finance_vendor_profiles(vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_subscription_status ON finance_vendor_profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_finance_vendor_profiles_next_billing ON finance_vendor_profiles(next_billing_date);

-- =====================================================
-- 3. Updated Timestamp Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_finance_vendor_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_vendor_profiles_updated_at
  BEFORE UPDATE ON finance_vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_vendor_profiles_updated_at();

-- =====================================================
-- 4. RLS Policies
-- =====================================================

ALTER TABLE finance_vendor_profiles ENABLE ROW LEVEL SECURITY;

-- Users with finance permission can view vendor profiles
CREATE POLICY "Users with finance permission can view vendor profiles"
  ON finance_vendor_profiles
  FOR SELECT
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

-- Users with finance.manage permission can manage vendor profiles
CREATE POLICY "Users with finance manage permission can manage vendor profiles"
  ON finance_vendor_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role = 'admin'
          OR (cr.permissions->'finance'->>'manage' = 'true')
        )
    )
  );

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to initialize vendor financial profile
CREATE OR REPLACE FUNCTION initialize_vendor_financial_profile(p_vendor_id UUID)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Check if profile already exists
  SELECT id INTO v_profile_id
  FROM finance_vendor_profiles
  WHERE vendor_id = p_vendor_id;
  
  IF v_profile_id IS NOT NULL THEN
    RETURN v_profile_id;
  END IF;
  
  -- Create new profile with default values
  INSERT INTO finance_vendor_profiles (
    vendor_id,
    commission_model,
    commission_rate,
    subscription_status,
    current_threshold,
    threshold_limit
  ) VALUES (
    p_vendor_id,
    'percentage',
    10.00,
    'active',
    0,
    100
  )
  RETURNING id INTO v_profile_id;
  
  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update vendor threshold counter
CREATE OR REPLACE FUNCTION increment_vendor_threshold(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_threshold INTEGER;
  v_threshold_limit INTEGER;
  v_threshold_reached BOOLEAN := FALSE;
BEGIN
  -- Get current threshold values
  SELECT current_threshold, threshold_limit
  INTO v_current_threshold, v_threshold_limit
  FROM finance_vendor_profiles
  WHERE vendor_id = p_vendor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor financial profile not found for vendor_id: %', p_vendor_id;
  END IF;
  
  -- Increment threshold
  v_current_threshold := v_current_threshold + 1;
  
  -- Check if threshold reached
  IF v_current_threshold >= v_threshold_limit THEN
    v_threshold_reached := TRUE;
    v_current_threshold := 0; -- Reset counter
  END IF;
  
  -- Update profile
  UPDATE finance_vendor_profiles
  SET 
    current_threshold = v_current_threshold,
    updated_at = NOW()
  WHERE vendor_id = p_vendor_id;
  
  RETURN v_threshold_reached;
END;
$$ LANGUAGE plpgsql;

-- Function to update vendor financial totals
CREATE OR REPLACE FUNCTION update_vendor_financial_totals(
  p_vendor_id UUID,
  p_revenue_delta DECIMAL(15, 2) DEFAULT 0,
  p_commission_delta DECIMAL(15, 2) DEFAULT 0,
  p_payout_delta DECIMAL(15, 2) DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_vendor_profiles
  SET 
    total_revenue = total_revenue + p_revenue_delta,
    total_commission_paid = total_commission_paid + p_commission_delta,
    total_payouts = total_payouts + p_payout_delta,
    outstanding_balance = outstanding_balance + p_revenue_delta - p_payout_delta,
    updated_at = NOW()
  WHERE vendor_id = p_vendor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor financial profile not found for vendor_id: %', p_vendor_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_vendor_profiles IS 'Financial profiles for vendors including commission rules, subscription data, and payment terms';
COMMENT ON COLUMN finance_vendor_profiles.commission_model IS 'Commission calculation model: flat, percentage, tiered, or category_based';
COMMENT ON COLUMN finance_vendor_profiles.commission_rules IS 'JSONB structure containing detailed commission rules and tiers';
COMMENT ON COLUMN finance_vendor_profiles.current_threshold IS 'Current order count towards subscription threshold';
COMMENT ON COLUMN finance_vendor_profiles.threshold_limit IS 'Number of orders before subscription billing triggers';
COMMENT ON COLUMN finance_vendor_profiles.outstanding_balance IS 'Current amount owed to vendor';

COMMENT ON FUNCTION initialize_vendor_financial_profile(UUID) IS 'Creates a financial profile for a vendor with default values';
COMMENT ON FUNCTION increment_vendor_threshold(UUID) IS 'Increments vendor threshold counter and returns true if threshold reached';
COMMENT ON FUNCTION update_vendor_financial_totals(UUID, DECIMAL, DECIMAL, DECIMAL) IS 'Updates vendor financial totals (revenue, commission, payouts)';

