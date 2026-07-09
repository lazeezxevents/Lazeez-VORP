-- =====================================================
-- Order Completion Event Handler Migration
-- =====================================================
-- Creates event handling infrastructure for order completion events
-- from the Delivery Module to trigger revenue recording
--
-- Requirements: 2.1, 2.8
-- Task: 7.2 Create order completion event handler
-- =====================================================

-- =====================================================
-- 1. Delivery Orders Table (Placeholder)
-- =====================================================
-- This is a placeholder table structure for delivery orders
-- Will be replaced/extended when Delivery Module is fully implemented

CREATE TABLE IF NOT EXISTS delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Order Financial Data
  order_amount DECIMAL(15, 2) NOT NULL CHECK (order_amount >= 0),
  currency VARCHAR(3) DEFAULT 'PKR',
  
  -- Order Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  
  -- Delivery Information
  rider_id UUID,
  delivery_distance DECIMAL(10, 2),
  delivery_charge DECIMAL(10, 2),
  
  -- Timestamps
  order_date TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- 2. Indexes for Performance
-- =====================================================

CREATE INDEX idx_delivery_orders_vendor ON delivery_orders(vendor_id);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(status);
CREATE INDEX idx_delivery_orders_completed_at ON delivery_orders(completed_at);
CREATE INDEX idx_delivery_orders_order_number ON delivery_orders(order_number);

-- =====================================================
-- 3. Order Completion Event Handler Function
-- =====================================================
-- This function is triggered when an order status changes to 'completed'
-- It handles:
-- - Revenue recording in General Ledger
-- - Commission calculation
-- - Vendor threshold tracking
-- - Error handling with retry queue

CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_revenue_recorded BOOLEAN := FALSE;
  v_error_message TEXT;
  v_vendor_profile_exists BOOLEAN;
  v_threshold_reached BOOLEAN := FALSE;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Set completion timestamp if not already set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
    
    BEGIN
      -- Check if vendor financial profile exists
      SELECT EXISTS(
        SELECT 1 FROM finance_vendor_profiles WHERE vendor_id = NEW.vendor_id
      ) INTO v_vendor_profile_exists;
      
      -- Initialize vendor profile if it doesn't exist
      IF NOT v_vendor_profile_exists THEN
        PERFORM initialize_vendor_financial_profile(NEW.vendor_id);
      END IF;
      
      -- Insert revenue event into processing queue
      -- This will be picked up by the application layer (RevenueManagerService)
      INSERT INTO finance_revenue_events (
        event_type,
        order_id,
        vendor_id,
        order_amount,
        currency,
        event_data,
        status,
        created_at
      ) VALUES (
        'order_completed',
        NEW.id,
        NEW.vendor_id,
        NEW.order_amount,
        NEW.currency,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'order_date', NEW.order_date,
          'completed_at', NEW.completed_at,
          'rider_id', NEW.rider_id,
          'delivery_distance', NEW.delivery_distance,
          'delivery_charge', NEW.delivery_charge
        ),
        'pending',
        NOW()
      );
      
      -- Increment vendor threshold counter
      v_threshold_reached := increment_vendor_threshold(NEW.vendor_id);
      
      -- If threshold reached, create subscription billing event
      IF v_threshold_reached THEN
        INSERT INTO finance_revenue_events (
          event_type,
          vendor_id,
          order_amount,
          currency,
          event_data,
          status,
          created_at
        ) VALUES (
          'subscription_threshold_reached',
          NEW.vendor_id,
          0,
          'PKR',
          jsonb_build_object(
            'trigger_order_id', NEW.id,
            'trigger_order_number', NEW.order_number
          ),
          'pending',
          NOW()
        );
      END IF;
      
      v_revenue_recorded := TRUE;
      
      -- Log successful event creation
      RAISE NOTICE 'Order completion event created for order %', NEW.order_number;
      
    EXCEPTION WHEN OTHERS THEN
      -- Requirement 2.8: Log error and queue for retry without blocking order completion
      v_error_message := SQLERRM;
      
      -- Log error to finance_error_log
      INSERT INTO finance_error_log (
        error_type,
        entity_type,
        entity_id,
        error_message,
        error_data,
        retry_count,
        created_at
      ) VALUES (
        'revenue_recording_failed',
        'delivery_order',
        NEW.id,
        v_error_message,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'vendor_id', NEW.vendor_id,
          'order_amount', NEW.order_amount
        ),
        0,
        NOW()
      );
      
      -- Log to application logs
      RAISE WARNING 'Failed to create revenue event for order %: %', NEW.order_number, v_error_message;
      
      -- Don't block the order completion - let it proceed
      v_revenue_recorded := FALSE;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Revenue Events Queue Table
-- =====================================================
-- Queue table for revenue events to be processed by application layer

CREATE TABLE IF NOT EXISTS finance_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('order_completed', 'subscription_threshold_reached', 'manual_adjustment')),
  order_id UUID REFERENCES delivery_orders(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  order_amount DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'PKR',
  event_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. Error Log Table
-- =====================================================
-- Stores errors for retry processing

CREATE TABLE IF NOT EXISTS finance_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  error_message TEXT,
  error_data JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. Indexes for Queue Tables
-- =====================================================

CREATE INDEX idx_finance_revenue_events_status ON finance_revenue_events(status);
CREATE INDEX idx_finance_revenue_events_vendor ON finance_revenue_events(vendor_id);
CREATE INDEX idx_finance_revenue_events_created_at ON finance_revenue_events(created_at);
CREATE INDEX idx_finance_revenue_events_order ON finance_revenue_events(order_id);

CREATE INDEX idx_finance_error_log_status ON finance_error_log(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_finance_error_log_retry ON finance_error_log(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- =====================================================
-- 7. Attach Trigger to Orders Table
-- =====================================================

CREATE TRIGGER order_completion_trigger
  BEFORE UPDATE ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_completion();

-- =====================================================
-- 8. Updated Timestamp Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_delivery_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_orders_updated_at
  BEFORE UPDATE ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_orders_updated_at();

CREATE OR REPLACE FUNCTION update_finance_revenue_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_revenue_events_updated_at
  BEFORE UPDATE ON finance_revenue_events
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_revenue_events_updated_at();

CREATE OR REPLACE FUNCTION update_finance_error_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_error_log_updated_at
  BEFORE UPDATE ON finance_error_log
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_error_log_updated_at();

-- =====================================================
-- 9. RLS Policies
-- =====================================================

ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_error_log ENABLE ROW LEVEL SECURITY;

-- Delivery Orders Policies
CREATE POLICY "Users can view delivery orders"
  ON delivery_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage delivery orders"
  ON delivery_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin'
    )
  );

-- Revenue Events Policies
CREATE POLICY "Finance users can view revenue events"
  ON finance_revenue_events
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

CREATE POLICY "Finance users can manage revenue events"
  ON finance_revenue_events
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

-- Error Log Policies
CREATE POLICY "Finance users can view error logs"
  ON finance_error_log
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

-- =====================================================
-- 10. Helper Functions for Event Processing
-- =====================================================

-- Function to process pending revenue events
CREATE OR REPLACE FUNCTION process_revenue_event(p_event_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_event RECORD;
  v_success BOOLEAN := FALSE;
BEGIN
  -- Get event details
  SELECT * INTO v_event
  FROM finance_revenue_events
  WHERE id = p_event_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Revenue event not found or already processed: %', p_event_id;
  END IF;
  
  -- Mark as processing
  UPDATE finance_revenue_events
  SET status = 'processing', updated_at = NOW()
  WHERE id = p_event_id;
  
  -- Event will be processed by application layer (RevenueManagerService)
  -- This function is a placeholder for future direct processing
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as completed
CREATE OR REPLACE FUNCTION complete_revenue_event(p_event_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_revenue_events
  SET 
    status = 'completed',
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as failed
CREATE OR REPLACE FUNCTION fail_revenue_event(p_event_id UUID, p_error_message TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_revenue_events
  SET 
    status = 'failed',
    error_message = p_error_message,
    retry_count = retry_count + 1,
    updated_at = NOW()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. Comments for Documentation
-- =====================================================

COMMENT ON TABLE delivery_orders IS 'Placeholder table for delivery orders from Delivery Module';
COMMENT ON TABLE finance_revenue_events IS 'Queue table for revenue events to be processed by RevenueManagerService';
COMMENT ON TABLE finance_error_log IS 'Error log for failed revenue operations with retry tracking';

COMMENT ON FUNCTION handle_order_completion() IS 'Trigger function that creates revenue events when orders are completed';
COMMENT ON FUNCTION process_revenue_event(UUID) IS 'Marks a revenue event as processing';
COMMENT ON FUNCTION complete_revenue_event(UUID) IS 'Marks a revenue event as completed';
COMMENT ON FUNCTION fail_revenue_event(UUID, TEXT) IS 'Marks a revenue event as failed with error message';

COMMENT ON COLUMN finance_revenue_events.event_type IS 'Type of revenue event: order_completed, subscription_threshold_reached, manual_adjustment';
COMMENT ON COLUMN finance_revenue_events.event_data IS 'JSONB containing event-specific data (order details, delivery info, etc.)';
COMMENT ON COLUMN finance_error_log.next_retry_at IS 'Timestamp for next retry attempt (exponential backoff)';
