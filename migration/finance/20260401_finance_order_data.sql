-- =====================================================
-- Finance Order Data Table
-- =====================================================
-- Stores complete financial breakdown for each order
-- Links to orders from Delivery Module
-- Tracks revenue, commissions, and platform revenue
-- Requirements: 6.1, 6.2, 2.1
-- Task: 10.1

CREATE TABLE IF NOT EXISTS finance_order_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL,
  rider_id UUID,
  order_amount DECIMAL(15, 2) NOT NULL CHECK (order_amount >= 0),
  delivery_charge DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount >= 0),
  vendor_commission DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (vendor_commission >= 0),
  rider_commission DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (rider_commission >= 0),
  platform_revenue DECIMAL(15, 2) NOT NULL CHECK (platform_revenue >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payout_released BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_finance_order_data_vendor ON finance_order_data(vendor_id);
CREATE INDEX idx_finance_order_data_rider ON finance_order_data(rider_id);
CREATE INDEX idx_finance_order_data_order ON finance_order_data(order_id);
CREATE INDEX idx_finance_order_data_completed ON finance_order_data(completed_at);
CREATE INDEX idx_finance_order_data_status ON finance_order_data(payment_status);

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_finance_order_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_order_data_updated_at
  BEFORE UPDATE ON finance_order_data
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_order_data_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE finance_order_data ENABLE ROW LEVEL SECURITY;

-- Finance users can view all order data
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
        OR cr.name IN ('Finance Admin', 'Finance Manager', 'Accountant')
      )
    )
  );

-- Finance admins can insert order data
CREATE POLICY "Finance admins can insert order data"
  ON finance_order_data
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
        OR cr.name IN ('Finance Admin')
      )
    )
  );

-- Finance admins can update order data
CREATE POLICY "Finance admins can update order data"
  ON finance_order_data
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
        OR cr.name IN ('Finance Admin')
      )
    )
  );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_order_data IS 'Financial breakdown for each completed order including commissions and platform revenue';
COMMENT ON COLUMN finance_order_data.order_id IS 'Reference to order from Delivery Module';
COMMENT ON COLUMN finance_order_data.vendor_id IS 'Vendor who fulfilled the order';
COMMENT ON COLUMN finance_order_data.rider_id IS 'Rider who delivered the order (if applicable)';
COMMENT ON COLUMN finance_order_data.order_amount IS 'Order subtotal amount (excluding delivery charge)';
COMMENT ON COLUMN finance_order_data.delivery_charge IS 'Delivery charge for the order';
COMMENT ON COLUMN finance_order_data.total_amount IS 'Total order amount (order_amount + delivery_charge)';
COMMENT ON COLUMN finance_order_data.vendor_commission IS 'Commission amount deducted for vendor';
COMMENT ON COLUMN finance_order_data.rider_commission IS 'Commission amount paid to rider';
COMMENT ON COLUMN finance_order_data.platform_revenue IS 'Net revenue retained by platform after commissions';
COMMENT ON COLUMN finance_order_data.payment_status IS 'Payment status: pending, completed, failed';
COMMENT ON COLUMN finance_order_data.payout_released IS 'Whether payout has been released to vendor';
COMMENT ON COLUMN finance_order_data.completed_at IS 'Timestamp when order was completed';
