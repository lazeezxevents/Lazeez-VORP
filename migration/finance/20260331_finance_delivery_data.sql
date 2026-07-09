-- =====================================================
-- Finance Delivery Data Table Migration
-- =====================================================
-- Creates table to track delivery financial data including
-- rider commissions, distances, routes, and delivery charges
--
-- Requirements: 4.5
-- Task: 9.1 Create finance_delivery_data table
-- =====================================================

-- =====================================================
-- 1. Finance Delivery Data Table
-- =====================================================
-- Stores comprehensive delivery financial information for commission
-- calculation, receipt tracking, and financial reporting

CREATE TABLE IF NOT EXISTS finance_delivery_data (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  delivery_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Location Data (JSONB for flexibility)
  pickup_location JSONB DEFAULT '{}',
  delivery_location JSONB DEFAULT '{}',
  
  -- Distance and Route Information
  distance DECIMAL(10, 2) NOT NULL CHECK (distance >= 0),
  optimized_route JSONB DEFAULT '{}',
  
  -- Financial Data
  delivery_charge DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  rider_commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0 CHECK (rider_commission_rate >= 0 AND rider_commission_rate <= 100),
  rider_commission_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (rider_commission_amount >= 0),
  
  -- Tier Information
  tier_applied VARCHAR(100),
  
  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT fk_delivery_order CHECK (delivery_id = order_id)
);

-- =====================================================
-- 2. Indexes for Performance
-- =====================================================

-- Index on rider_id for rider commission queries
CREATE INDEX idx_finance_delivery_data_rider 
  ON finance_delivery_data(rider_id);

-- Index on order_id for order-related queries
CREATE INDEX idx_finance_delivery_data_order 
  ON finance_delivery_data(order_id);

-- Index on delivery_id for delivery-related queries
CREATE INDEX idx_finance_delivery_data_delivery 
  ON finance_delivery_data(delivery_id);

-- Index on completed_at for time-based queries and reporting
CREATE INDEX idx_finance_delivery_data_completed 
  ON finance_delivery_data(completed_at);

-- Composite index for vendor-based queries
CREATE INDEX idx_finance_delivery_data_vendor_completed 
  ON finance_delivery_data(vendor_id, completed_at);

-- =====================================================
-- 3. Row Level Security (RLS)
-- =====================================================

ALTER TABLE finance_delivery_data ENABLE ROW LEVEL SECURITY;

-- Finance users can view delivery data
CREATE POLICY "Finance users can view delivery data"
  ON finance_delivery_data
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

-- Admins can manage delivery data
CREATE POLICY "Admins can manage delivery data"
  ON finance_delivery_data
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.main_role = 'admin'
    )
  );

-- Finance managers can insert and update delivery data
CREATE POLICY "Finance managers can manage delivery data"
  ON finance_delivery_data
  FOR INSERT
  WITH CHECK (
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

CREATE POLICY "Finance managers can update delivery data"
  ON finance_delivery_data
  FOR UPDATE
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

-- Riders can view their own delivery data
CREATE POLICY "Riders can view their own delivery data"
  ON finance_delivery_data
  FOR SELECT
  USING (rider_id = auth.uid());

-- =====================================================
-- 4. Updated Timestamp Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_finance_delivery_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_delivery_data_updated_at
  BEFORE UPDATE ON finance_delivery_data
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_delivery_data_updated_at();

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to calculate rider commission based on distance tiers
CREATE OR REPLACE FUNCTION calculate_rider_commission(
  p_distance DECIMAL,
  p_delivery_charge DECIMAL
)
RETURNS TABLE (
  commission_rate DECIMAL,
  commission_amount DECIMAL,
  tier_name VARCHAR
) AS $$
DECLARE
  v_tier RECORD;
  v_commission_rate DECIMAL := 0;
  v_commission_amount DECIMAL := 0;
  v_tier_name VARCHAR := 'default';
BEGIN
  -- Find applicable tier based on distance
  -- This is a placeholder - actual tier configuration should come from a config table
  -- For now, using simple tier logic:
  -- 0-5 km: 15%
  -- 5-10 km: 20%
  -- 10-15 km: 25%
  -- 15+ km: 30%
  
  IF p_distance <= 5 THEN
    v_commission_rate := 15.00;
    v_tier_name := '0-5km';
  ELSIF p_distance <= 10 THEN
    v_commission_rate := 20.00;
    v_tier_name := '5-10km';
  ELSIF p_distance <= 15 THEN
    v_commission_rate := 25.00;
    v_tier_name := '10-15km';
  ELSE
    v_commission_rate := 30.00;
    v_tier_name := '15+km';
  END IF;
  
  -- Calculate commission amount
  v_commission_amount := (p_delivery_charge * v_commission_rate) / 100;
  
  -- Ensure commission doesn't exceed delivery charge
  IF v_commission_amount > p_delivery_charge THEN
    v_commission_amount := p_delivery_charge;
  END IF;
  
  RETURN QUERY SELECT v_commission_rate, v_commission_amount, v_tier_name;
END;
$$ LANGUAGE plpgsql;

-- Function to record delivery receipt with commission calculation
CREATE OR REPLACE FUNCTION record_delivery_receipt(
  p_delivery_id UUID,
  p_order_id UUID,
  p_rider_id UUID,
  p_vendor_id UUID,
  p_pickup_location JSONB,
  p_delivery_location JSONB,
  p_distance DECIMAL,
  p_optimized_route JSONB,
  p_delivery_charge DECIMAL,
  p_completed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_commission_data RECORD;
  v_receipt_id UUID;
BEGIN
  -- Calculate rider commission
  SELECT * INTO v_commission_data
  FROM calculate_rider_commission(p_distance, p_delivery_charge);
  
  -- Insert delivery receipt
  INSERT INTO finance_delivery_data (
    delivery_id,
    order_id,
    rider_id,
    vendor_id,
    pickup_location,
    delivery_location,
    distance,
    optimized_route,
    delivery_charge,
    rider_commission_rate,
    rider_commission_amount,
    tier_applied,
    completed_at,
    created_at,
    updated_at
  ) VALUES (
    p_delivery_id,
    p_order_id,
    p_rider_id,
    p_vendor_id,
    p_pickup_location,
    p_delivery_location,
    p_distance,
    p_optimized_route,
    p_delivery_charge,
    v_commission_data.commission_rate,
    v_commission_data.commission_amount,
    v_commission_data.tier_name,
    p_completed_at,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_receipt_id;
  
  RETURN v_receipt_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_delivery_data IS 'Stores delivery financial data including rider commissions, distances, routes, and charges for financial tracking and reporting';

COMMENT ON COLUMN finance_delivery_data.delivery_id IS 'Reference to the delivery order';
COMMENT ON COLUMN finance_delivery_data.order_id IS 'Reference to the order (same as delivery_id for now)';
COMMENT ON COLUMN finance_delivery_data.rider_id IS 'Reference to the rider who completed the delivery';
COMMENT ON COLUMN finance_delivery_data.vendor_id IS 'Reference to the vendor associated with the order';
COMMENT ON COLUMN finance_delivery_data.pickup_location IS 'JSONB containing pickup location data (lat, lng, address)';
COMMENT ON COLUMN finance_delivery_data.delivery_location IS 'JSONB containing delivery location data (lat, lng, address)';
COMMENT ON COLUMN finance_delivery_data.distance IS 'Delivery distance in kilometers';
COMMENT ON COLUMN finance_delivery_data.optimized_route IS 'JSONB containing optimized route data';
COMMENT ON COLUMN finance_delivery_data.delivery_charge IS 'Total delivery charge in PKR';
COMMENT ON COLUMN finance_delivery_data.rider_commission_rate IS 'Commission rate percentage applied to the rider';
COMMENT ON COLUMN finance_delivery_data.rider_commission_amount IS 'Calculated commission amount in PKR';
COMMENT ON COLUMN finance_delivery_data.tier_applied IS 'Name of the distance tier applied for commission calculation';
COMMENT ON COLUMN finance_delivery_data.completed_at IS 'Timestamp when the delivery was completed';

COMMENT ON FUNCTION calculate_rider_commission(DECIMAL, DECIMAL) IS 'Calculates rider commission based on distance tiers and delivery charge';
COMMENT ON FUNCTION record_delivery_receipt(UUID, UUID, UUID, UUID, JSONB, JSONB, DECIMAL, JSONB, DECIMAL, TIMESTAMPTZ) IS 'Records a delivery receipt with automatic commission calculation';

-- =====================================================
-- 7. Validation Function
-- =====================================================

-- Function to validate delivery data integrity
CREATE OR REPLACE FUNCTION validate_delivery_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure commission amount doesn't exceed delivery charge
  IF NEW.rider_commission_amount > NEW.delivery_charge THEN
    RAISE EXCEPTION 'Rider commission amount (%) cannot exceed delivery charge (%)', 
      NEW.rider_commission_amount, NEW.delivery_charge;
  END IF;
  
  -- Ensure distance is positive
  IF NEW.distance < 0 THEN
    RAISE EXCEPTION 'Distance cannot be negative';
  END IF;
  
  -- Ensure commission rate is within valid range
  IF NEW.rider_commission_rate < 0 OR NEW.rider_commission_rate > 100 THEN
    RAISE EXCEPTION 'Commission rate must be between 0 and 100';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_delivery_data_trigger
  BEFORE INSERT OR UPDATE ON finance_delivery_data
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_data();

-- =====================================================
-- End of Migration
-- =====================================================
