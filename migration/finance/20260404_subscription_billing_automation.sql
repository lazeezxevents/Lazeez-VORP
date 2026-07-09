-- =====================================================
-- Subscription Billing Automation Migration
-- =====================================================
-- Creates infrastructure for automated subscription billing including:
-- - Cycle-based billing scheduler using pg_cron
-- - Database functions for billing cycle processing
-- - Support for monthly, quarterly, and annual cycles
--
-- Requirements: 5.5, 5.6, 5.10
-- Task: 14.2 Implement billing cycle scheduler
-- =====================================================

-- =====================================================
-- 1. Enable pg_cron Extension
-- =====================================================
-- pg_cron allows scheduling of database functions
-- Note: This requires superuser privileges and may need to be enabled manually

-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Note: If pg_cron is not available, the cycle-based billing can be triggered
-- by application-level schedulers (e.g., cron jobs, scheduled tasks)

-- =====================================================
-- 2. Billing Cycle Configuration Table
-- =====================================================
-- Stores billing cycle configuration for vendors

CREATE TABLE IF NOT EXISTS finance_billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Cycle Configuration
  cycle_type VARCHAR(20) NOT NULL CHECK (cycle_type IN ('monthly', 'quarterly', 'annual')),
  cycle_day INTEGER NOT NULL CHECK (cycle_day >= 1 AND cycle_day <= 31),
  
  -- Billing Amounts
  base_amount DECIMAL(15, 2) NOT NULL CHECK (base_amount >= 0),
  currency VARCHAR(3) DEFAULT 'PKR',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_billed_at TIMESTAMPTZ,
  next_billing_date DATE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint: one active cycle per vendor
  UNIQUE(vendor_id, is_active)
);

-- =====================================================
-- 3. Indexes for Performance
-- =====================================================

CREATE INDEX idx_billing_cycles_vendor ON finance_billing_cycles(vendor_id);
CREATE INDEX idx_billing_cycles_next_billing ON finance_billing_cycles(next_billing_date) WHERE is_active = TRUE;
CREATE INDEX idx_billing_cycles_active ON finance_billing_cycles(is_active);

-- =====================================================
-- 4. Function: Calculate Next Billing Date
-- =====================================================
-- Calculates the next billing date based on cycle type

CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  p_current_date DATE,
  p_cycle_type VARCHAR,
  p_cycle_day INTEGER
)
RETURNS DATE AS $$
DECLARE
  v_next_date DATE;
  v_days_in_month INTEGER;
BEGIN
  CASE p_cycle_type
    WHEN 'monthly' THEN
      -- Add 1 month
      v_next_date := p_current_date + INTERVAL '1 month';
      
      -- Adjust to cycle day
      v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_date) + INTERVAL '1 month' - INTERVAL '1 day'));
      v_next_date := DATE_TRUNC('month', v_next_date) + (LEAST(p_cycle_day, v_days_in_month) - 1) * INTERVAL '1 day';
      
    WHEN 'quarterly' THEN
      -- Add 3 months
      v_next_date := p_current_date + INTERVAL '3 months';
      
      -- Adjust to cycle day
      v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_date) + INTERVAL '1 month' - INTERVAL '1 day'));
      v_next_date := DATE_TRUNC('month', v_next_date) + (LEAST(p_cycle_day, v_days_in_month) - 1) * INTERVAL '1 day';
      
    WHEN 'annual' THEN
      -- Add 1 year
      v_next_date := p_current_date + INTERVAL '1 year';
      
      -- Adjust to cycle day
      v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_date) + INTERVAL '1 month' - INTERVAL '1 day'));
      v_next_date := DATE_TRUNC('month', v_next_date) + (LEAST(p_cycle_day, v_days_in_month) - 1) * INTERVAL '1 day';
      
    ELSE
      RAISE EXCEPTION 'Invalid cycle type: %', p_cycle_type;
  END CASE;
  
  RETURN v_next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. Function: Process Cycle-Based Billing
-- =====================================================
-- Processes all billing cycles that are due
-- This function is called by pg_cron or application scheduler

CREATE OR REPLACE FUNCTION process_cycle_based_billing()
RETURNS TABLE(
  vendor_id UUID,
  cycle_id UUID,
  event_id UUID,
  status TEXT
) AS $$
DECLARE
  v_cycle RECORD;
  v_event_id UUID;
BEGIN
  -- Find all active billing cycles that are due
  FOR v_cycle IN
    SELECT *
    FROM finance_billing_cycles
    WHERE is_active = TRUE
      AND next_billing_date <= CURRENT_DATE
    ORDER BY next_billing_date ASC
  LOOP
    BEGIN
      -- Create subscription billing event
      INSERT INTO finance_revenue_events (
        event_type,
        vendor_id,
        order_amount,
        currency,
        event_data,
        status,
        created_at
      ) VALUES (
        'subscription_cycle_due',
        v_cycle.vendor_id,
        v_cycle.base_amount,
        v_cycle.currency,
        jsonb_build_object(
          'cycle_id', v_cycle.id,
          'cycle_type', v_cycle.cycle_type,
          'cycle_day', v_cycle.cycle_day,
          'billing_date', v_cycle.next_billing_date
        ),
        'pending',
        NOW()
      )
      RETURNING id INTO v_event_id;
      
      -- Update billing cycle with next billing date
      UPDATE finance_billing_cycles
      SET
        last_billed_at = NOW(),
        next_billing_date = calculate_next_billing_date(
          next_billing_date,
          cycle_type,
          cycle_day
        ),
        updated_at = NOW()
      WHERE id = v_cycle.id;
      
      -- Return success
      RETURN QUERY SELECT
        v_cycle.vendor_id,
        v_cycle.id,
        v_event_id,
        'success'::TEXT;
      
      RAISE NOTICE 'Created billing event % for vendor % (cycle %)',
        v_event_id, v_cycle.vendor_id, v_cycle.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other cycles
      INSERT INTO finance_error_log (
        error_type,
        entity_type,
        entity_id,
        error_message,
        error_data,
        retry_count,
        created_at
      ) VALUES (
        'cycle_billing_failed',
        'billing_cycle',
        v_cycle.id,
        SQLERRM,
        jsonb_build_object(
          'vendor_id', v_cycle.vendor_id,
          'cycle_type', v_cycle.cycle_type,
          'next_billing_date', v_cycle.next_billing_date
        ),
        0,
        NOW()
      );
      
      -- Return failure
      RETURN QUERY SELECT
        v_cycle.vendor_id,
        v_cycle.id,
        NULL::UUID,
        'failed'::TEXT;
      
      RAISE WARNING 'Failed to create billing event for vendor % (cycle %): %',
        v_cycle.vendor_id, v_cycle.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Function: Initialize Billing Cycle for Vendor
-- =====================================================
-- Creates a billing cycle configuration for a vendor

CREATE OR REPLACE FUNCTION initialize_billing_cycle(
  p_vendor_id UUID,
  p_cycle_type VARCHAR,
  p_cycle_day INTEGER,
  p_base_amount DECIMAL,
  p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_cycle_id UUID;
  v_next_billing_date DATE;
BEGIN
  -- Calculate first billing date
  v_next_billing_date := calculate_next_billing_date(
    p_start_date,
    p_cycle_type,
    p_cycle_day
  );
  
  -- Deactivate any existing active cycles for this vendor
  UPDATE finance_billing_cycles
  SET is_active = FALSE, updated_at = NOW()
  WHERE vendor_id = p_vendor_id AND is_active = TRUE;
  
  -- Create new billing cycle
  INSERT INTO finance_billing_cycles (
    vendor_id,
    cycle_type,
    cycle_day,
    base_amount,
    currency,
    is_active,
    next_billing_date,
    created_at
  ) VALUES (
    p_vendor_id,
    p_cycle_type,
    p_cycle_day,
    p_base_amount,
    'PKR',
    TRUE,
    v_next_billing_date,
    NOW()
  )
  RETURNING id INTO v_cycle_id;
  
  RAISE NOTICE 'Initialized billing cycle % for vendor % (next billing: %)',
    v_cycle_id, p_vendor_id, v_next_billing_date;
  
  RETURN v_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Function: Deactivate Billing Cycle
-- =====================================================

CREATE OR REPLACE FUNCTION deactivate_billing_cycle(p_vendor_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_billing_cycles
  SET is_active = FALSE, updated_at = NOW()
  WHERE vendor_id = p_vendor_id AND is_active = TRUE;
  
  RAISE NOTICE 'Deactivated billing cycle for vendor %', p_vendor_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. Scheduled Job (pg_cron)
-- =====================================================
-- Schedule the billing cycle processor to run daily at 2 AM
-- Uncomment if pg_cron is available

/*
SELECT cron.schedule(
  'process-subscription-billing',
  '0 2 * * *',  -- Every day at 2 AM
  $$ SELECT process_cycle_based_billing(); $$
);
*/

-- Alternative: Manual trigger function for application-level scheduling
-- Call this function from your application scheduler (e.g., Node.js cron job)

CREATE OR REPLACE FUNCTION trigger_billing_cycle_processing()
RETURNS JSONB AS $$
DECLARE
  v_results JSONB;
  v_success_count INTEGER := 0;
  v_failure_count INTEGER := 0;
  v_result RECORD;
BEGIN
  -- Process all due billing cycles
  FOR v_result IN
    SELECT * FROM process_cycle_based_billing()
  LOOP
    IF v_result.status = 'success' THEN
      v_success_count := v_success_count + 1;
    ELSE
      v_failure_count := v_failure_count + 1;
    END IF;
  END LOOP;
  
  -- Return summary
  v_results := jsonb_build_object(
    'success_count', v_success_count,
    'failure_count', v_failure_count,
    'processed_at', NOW()
  );
  
  RETURN v_results;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. Updated Timestamp Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_billing_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_cycles_updated_at
  BEFORE UPDATE ON finance_billing_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_cycles_updated_at();

-- =====================================================
-- 10. RLS Policies
-- =====================================================

ALTER TABLE finance_billing_cycles ENABLE ROW LEVEL SECURITY;

-- Finance users can view billing cycles
CREATE POLICY "Finance users can view billing cycles"
  ON finance_billing_cycles
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

-- Finance admins can manage billing cycles
CREATE POLICY "Finance admins can manage billing cycles"
  ON finance_billing_cycles
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
-- 11. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_billing_cycles IS 'Stores billing cycle configuration for vendors with cycle-based subscription billing';

COMMENT ON FUNCTION calculate_next_billing_date(DATE, VARCHAR, INTEGER) IS 'Calculates the next billing date based on cycle type (monthly, quarterly, annual) and cycle day';
COMMENT ON FUNCTION process_cycle_based_billing() IS 'Processes all billing cycles that are due and creates billing events';
COMMENT ON FUNCTION initialize_billing_cycle(UUID, VARCHAR, INTEGER, DECIMAL, DATE) IS 'Creates a billing cycle configuration for a vendor';
COMMENT ON FUNCTION deactivate_billing_cycle(UUID) IS 'Deactivates the active billing cycle for a vendor';
COMMENT ON FUNCTION trigger_billing_cycle_processing() IS 'Manual trigger for billing cycle processing (for application-level schedulers)';

COMMENT ON COLUMN finance_billing_cycles.cycle_type IS 'Billing cycle frequency: monthly, quarterly, or annual';
COMMENT ON COLUMN finance_billing_cycles.cycle_day IS 'Day of month for billing (1-31, adjusted for months with fewer days)';
COMMENT ON COLUMN finance_billing_cycles.next_billing_date IS 'Next scheduled billing date';
COMMENT ON COLUMN finance_billing_cycles.last_billed_at IS 'Timestamp of last successful billing';

-- =====================================================
-- 12. Example Usage
-- =====================================================

-- Initialize a monthly billing cycle for a vendor (billing on the 1st of each month)
-- SELECT initialize_billing_cycle(
--   'vendor-uuid-here',
--   'monthly',
--   1,
--   5000.00,
--   CURRENT_DATE
-- );

-- Initialize a quarterly billing cycle (billing on the 15th of each quarter)
-- SELECT initialize_billing_cycle(
--   'vendor-uuid-here',
--   'quarterly',
--   15,
--   12000.00,
--   CURRENT_DATE
-- );

-- Initialize an annual billing cycle (billing on the 1st of each year)
-- SELECT initialize_billing_cycle(
--   'vendor-uuid-here',
--   'annual',
--   1,
--   50000.00,
--   CURRENT_DATE
-- );

-- Manually trigger billing cycle processing
-- SELECT trigger_billing_cycle_processing();

-- Deactivate billing cycle for a vendor
-- SELECT deactivate_billing_cycle('vendor-uuid-here');

