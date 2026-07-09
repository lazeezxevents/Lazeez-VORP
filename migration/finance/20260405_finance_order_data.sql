-- =====================================================
-- Finance Order Data Table Migration
-- =====================================================
-- Creates table for storing order financial breakdown
-- Used for vendor payout calculations and financial tracking
--
-- Requirements: 6.1, 6.2
-- Task: 17.1 Create finance_order_data table
-- =====================================================

-- =====================================================
-- 1. Finance Order Data Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_order_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order Reference
  order_id UUID NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Financial Breakdown
  order_amount DECIMAL(15, 2) NOT NULL CHECK (order_amount >= 0),
  upfront_amount DECIMAL(15, 2) DEFAULT 0 CHECK (upfront_amount >= 0),
  remaining_amount DECIMAL(15, 2) DEFAULT 0 CHECK (remaining_amount >= 0),
  commission_amount DECIMAL(15, 2) DEFAULT 0 CHECK (commission_amount >= 0),
  commission_rate DECIMAL(5, 2) DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  net_payout DECIMAL(15, 2) DEFAULT 0 CHECK (net_payout >= 0),
  
  -- Delivery Information
  delivery_charge DECIMAL(10, 2) DEFAULT 0,
  rider_commission DECIMAL(10, 2) DEFAULT 0,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'PKR',
  
  -- Payment Status
  upfront_paid BOOLEAN DEFAULT FALSE,
  remaining_paid BOOLEAN DEFAULT FALSE,
  payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Payment Dates
  upfront_paid_at TIMESTAMPTZ,
  remaining_paid_at TIMESTAMPTZ,
  
  -- Metadata
  order_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT check_amounts CHECK (order_amount = upfront_amount + remaining_amount),
  CONSTRAINT check_net_payout CHECK (net_payout = remaining_amount - commission_amount)
);

-- =====================================================
-- 2. Indexes for Performance
-- =====================================================

CREATE INDEX idx_finance_order_data_order ON finance_order_data(order_id);
CREATE INDEX idx_finance_order_data_vendor ON finance_order_data(vendor_id);
CREATE INDEX idx_finance_order_data_order_number ON finance_order_data(order_number);
CREATE INDEX idx_finance_order_data_payout_status ON finance_order_data(payout_status);
CREATE INDEX idx_finance_order_data_created_at ON finance_order_data(created_at);
CREATE INDEX idx_finance_order_data_order_date ON finance_order_data(order_date);

-- =====================================================
-- 3. Function: Calculate Net Payout
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_net_payout(
  p_remaining_amount DECIMAL,
  p_commission_amount DECIMAL
)
RETURNS DECIMAL AS $
BEGIN
  RETURN GREATEST(0, p_remaining_amount - p_commission_amount);
END;
$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 4. Function: Record Order Financial Data
-- =====================================================

CREATE OR REPLACE FUNCTION record_order_financial_data(
  p_order_id UUID,
  p_order_number VARCHAR,
  p_vendor_id UUID,
  p_order_amount DECIMAL,
  p_upfront_amount DECIMAL,
  p_commission_rate DECIMAL,
  p_delivery_charge DECIMAL DEFAULT 0,
  p_rider_commission DECIMAL DEFAULT 0,
  p_order_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $
DECLARE
  v_remaining_amount DECIMAL;
  v_commission_amount DECIMAL;
  v_net_payout DECIMAL;
  v_order_data_id UUID;
BEGIN
  -- Calculate amounts
  v_remaining_amount := p_order_amount - p_upfront_amount;
  v_commission_amount := v_remaining_amount * (p_commission_rate / 100);
  v_net_payout := calculate_net_payout(v_remaining_amount, v_commission_amount);
  
  -- Insert order financial data
  INSERT INTO finance_order_data (
    order_id,
    order_number,
    vendor_id,
    order_amount,
    upfront_amount,
    remaining_amount,
    commission_amount,
    commission_rate,
    net_payout,
    delivery_charge,
    rider_commission,
    currency,
    payout_status,
    order_date,
    created_at
  ) VALUES (
    p_order_id,
    p_order_number,
    p_vendor_id,
    p_order_amount,
    p_upfront_amount,
    v_remaining_amount,
    v_commission_amount,
    p_commission_rate,
    v_net_payout,
    p_delivery_charge,
    p_rider_commission,
    'PKR',
    'pending',
    p_order_date,
    NOW()
  )
  RETURNING id INTO v_order_data_id;
  
  RAISE NOTICE 'Recorded order financial data % for order %', v_order_data_id, p_order_number;
  
  RETURN v_order_data_id;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Function: Mark Upfront Payment Paid
-- =====================================================

CREATE OR REPLACE FUNCTION mark_upfront_paid(p_order_id UUID)
RETURNS VOID AS $
BEGIN
  UPDATE finance_order_data
  SET
    upfront_paid = TRUE,
    upfront_paid_at = NOW(),
    updated_at = NOW()
  WHERE order_id = p_order_id;
  
  RAISE NOTICE 'Marked upfront payment as paid for order %', p_order_id;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Function: Mark Remaining Payment Paid
-- =====================================================

CREATE OR REPLACE FUNCTION mark_remaining_paid(p_order_id UUID)
RETURNS VOID AS $
BEGIN
  UPDATE finance_order_data
  SET
    remaining_paid = TRUE,
    remaining_paid_at = NOW(),
    payout_status = 'completed',
    updated_at = NOW()
  WHERE order_id = p_order_id;
  
  RAISE NOTICE 'Marked remaining payment as paid for order %', p_order_id;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Function: Get Vendor Payout Summary
-- =====================================================

CREATE OR REPLACE FUNCTION get_vendor_payout_summary(
  p_vendor_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_orders BIGINT,
  total_order_amount DECIMAL,
  total_upfront_amount DECIMAL,
  total_remaining_amount DECIMAL,
  total_commission_amount DECIMAL,
  total_net_payout DECIMAL,
  pending_payout DECIMAL,
  completed_payout DECIMAL
) AS $
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(order_amount), 0),
    COALESCE(SUM(upfront_amount), 0),
    COALESCE(SUM(remaining_amount), 0),
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(net_payout), 0),
    COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN net_payout ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payout_status = 'completed' THEN net_payout ELSE 0 END), 0)
  FROM finance_order_data
  WHERE vendor_id = p_vendor_id
    AND (p_start_date IS NULL OR order_date >= p_start_date)
    AND (p_end_date IS NULL OR order_date <= p_end_date);
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Updated Timestamp Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_finance_order_data_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER finance_order_data_updated_at
  BEFORE UPDATE ON finance_order_data
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_order_data_updated_at();

-- =====================================================
-- 9. RLS Policies
-- =====================================================

ALTER TABLE finance_order_data ENABLE ROW LEVEL SECURITY;

-- Finance users can view order data
CREATE POLICY "Finance users can view order data"
  ON finance_order_data
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

-- Finance admins can manage order data
CREATE POLICY "Finance admins can manage order data"
  ON finance_order_data
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
-- 10. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_order_data IS 'Stores order financial breakdown for vendor payout calculations';

COMMENT ON FUNCTION calculate_net_payout(DECIMAL, DECIMAL) IS 'Calculates net payout amount after commission deduction';
COMMENT ON FUNCTION record_order_financial_data(UUID, VARCHAR, UUID, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TIMESTAMPTZ) IS 'Records financial breakdown for an order';
COMMENT ON FUNCTION mark_upfront_paid(UUID) IS 'Marks upfront payment as paid for an order';
COMMENT ON FUNCTION mark_remaining_paid(UUID) IS 'Marks remaining payment as paid and completes payout';
COMMENT ON FUNCTION get_vendor_payout_summary(UUID, DATE, DATE) IS 'Gets payout summary for a vendor within date range';

COMMENT ON COLUMN finance_order_data.order_amount IS 'Total order amount';
COMMENT ON COLUMN finance_order_data.upfront_amount IS 'Upfront payment amount (paid to vendor immediately)';
COMMENT ON COLUMN finance_order_data.remaining_amount IS 'Remaining amount (paid after order completion)';
COMMENT ON COLUMN finance_order_data.commission_amount IS 'Platform commission deducted from remaining amount';
COMMENT ON COLUMN finance_order_data.net_payout IS 'Net amount paid to vendor (remaining - commission)';
COMMENT ON COLUMN finance_order_data.payout_status IS 'Status of payout: pending, processing, completed, failed';

-- =====================================================
-- 11. Example Usage
-- =====================================================

-- Record order financial data
-- SELECT record_order_financial_data(
--   'order-uuid-here',
--   'ORD-12345',
--   'vendor-uuid-here',
--   10000.00,  -- order amount
--   3000.00,   -- upfront amount (30%)
--   15.00,     -- commission rate (15%)
--   200.00,    -- delivery charge
--   50.00,     -- rider commission
--   NOW()
-- );

-- Mark upfront payment as paid
-- SELECT mark_upfront_paid('order-uuid-here');

-- Mark remaining payment as paid
-- SELECT mark_remaining_paid('order-uuid-here');

-- Get vendor payout summary
-- SELECT * FROM get_vendor_payout_summary(
--   'vendor-uuid-here',
--   '2024-01-01',
--   '2024-12-31'
-- );

