-- =====================================================
-- Revenue Journal Entry Performance Optimization
-- =====================================================
-- Optimizes revenue journal entry creation for 100ms performance requirement
-- Adds indexes, monitoring, and performance enhancements
--
-- Requirements: 2.2, 2.6
-- Task: 7.3 Implement revenue journal entry creation
-- =====================================================

-- =====================================================
-- 1. Performance Indexes
-- =====================================================

-- Index for fast account lookups by code (Cash account: 1010)
CREATE INDEX IF NOT EXISTS idx_finance_accounts_code_active 
  ON finance_accounts(code) 
  WHERE is_active = true;

-- Index for fast account lookups by type and subtype
CREATE INDEX IF NOT EXISTS idx_finance_accounts_type_subtype_active 
  ON finance_accounts(type, sub_type) 
  WHERE is_active = true;

-- Composite index for transaction queries by source
CREATE INDEX IF NOT EXISTS idx_finance_transactions_source_module_id 
  ON finance_transactions(source_module, source_id, status);

-- Index for journal entry lookups by reference (order traceability)
CREATE INDEX IF NOT EXISTS idx_finance_journal_entries_reference 
  ON finance_journal_entries(reference);

-- Index for ledger entries by journal entry (for balance calculations)
CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_journal_account 
  ON finance_ledger_entries(journal_entry_id, account_id);

-- =====================================================
-- 2. Performance Monitoring Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type VARCHAR(50) NOT NULL,
  operation_id UUID,
  execution_time_ms INTEGER NOT NULL,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX idx_finance_performance_metrics_operation 
  ON finance_performance_metrics(operation_type, created_at DESC);

CREATE INDEX idx_finance_performance_metrics_slow_queries 
  ON finance_performance_metrics(execution_time_ms DESC) 
  WHERE execution_time_ms > 100;

-- =====================================================
-- 3. Optimized Revenue Journal Entry Function
-- =====================================================

CREATE OR REPLACE FUNCTION create_revenue_journal_entry_optimized(
  p_order_id UUID,
  p_vendor_id UUID,
  p_order_amount DECIMAL(15, 2),
  p_entry_date DATE,
  p_description TEXT,
  p_reference VARCHAR(100),
  p_created_by UUID
)
RETURNS TABLE(
  journal_entry_id UUID,
  transaction_id UUID,
  execution_time_ms INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_execution_time_ms INTEGER;
  v_journal_entry_id UUID;
  v_transaction_id UUID;
  v_entry_number VARCHAR(50);
  v_cash_account_id UUID;
  v_revenue_account_id UUID;
  v_success BOOLEAN := FALSE;
  v_error_message TEXT;
BEGIN
  -- Start performance timer
  v_start_time := clock_timestamp();
  
  BEGIN
    -- Get account IDs with optimized query (uses indexes)
    SELECT id INTO v_cash_account_id
    FROM finance_accounts
    WHERE code = '1010' AND is_active = true
    LIMIT 1;
    
    SELECT id INTO v_revenue_account_id
    FROM finance_accounts
    WHERE type = 'revenue' AND is_active = true
    LIMIT 1;
    
    -- Validate accounts exist
    IF v_cash_account_id IS NULL OR v_revenue_account_id IS NULL THEN
      RAISE EXCEPTION 'Required accounts not found';
    END IF;
    
    -- Generate entry number
    SELECT generate_journal_entry_number() INTO v_entry_number;
    
    -- Create journal entry
    INSERT INTO finance_journal_entries (
      entry_number,
      entry_date,
      description,
      reference,
      status,
      created_by
    ) VALUES (
      v_entry_number,
      p_entry_date,
      p_description,
      p_reference,
      'draft',
      p_created_by
    )
    RETURNING id INTO v_journal_entry_id;
    
    -- Create ledger entries (batch insert for performance)
    INSERT INTO finance_ledger_entries (
      journal_entry_id,
      account_id,
      debit,
      credit,
      currency,
      description
    ) VALUES
      (v_journal_entry_id, v_cash_account_id, p_order_amount, 0, 'PKR', 'Cash received from order'),
      (v_journal_entry_id, v_revenue_account_id, 0, p_order_amount, 'PKR', 'Revenue from order');
    
    -- Post the journal entry (update account balances)
    PERFORM post_journal_entry(v_journal_entry_id, p_created_by);
    
    -- Create transaction record
    INSERT INTO finance_transactions (
      transaction_number,
      transaction_date,
      type,
      description,
      amount,
      currency,
      status,
      source_module,
      source_id,
      journal_entry_id,
      created_by
    ) VALUES (
      'REV-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
      p_entry_date,
      'revenue',
      p_description,
      p_order_amount,
      'PKR',
      'posted',
      'delivery',
      p_order_id,
      v_journal_entry_id,
      p_created_by
    )
    RETURNING id INTO v_transaction_id;
    
    v_success := TRUE;
    
  EXCEPTION WHEN OTHERS THEN
    v_error_message := SQLERRM;
    v_success := FALSE;
    RAISE WARNING 'Revenue journal entry creation failed: %', v_error_message;
  END;
  
  -- Calculate execution time
  v_end_time := clock_timestamp();
  v_execution_time_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::INTEGER;
  
  -- Log performance metrics
  INSERT INTO finance_performance_metrics (
    operation_type,
    operation_id,
    execution_time_ms,
    success,
    error_message,
    metadata
  ) VALUES (
    'revenue_journal_entry',
    v_journal_entry_id,
    v_execution_time_ms,
    v_success,
    v_error_message,
    jsonb_build_object(
      'order_id', p_order_id,
      'vendor_id', p_vendor_id,
      'order_amount', p_order_amount,
      'reference', p_reference
    )
  );
  
  -- Alert if performance threshold exceeded
  IF v_execution_time_ms > 100 THEN
    RAISE WARNING 'Revenue journal entry exceeded 100ms threshold: % ms for order %', 
      v_execution_time_ms, p_order_id;
  END IF;
  
  -- Return results
  RETURN QUERY SELECT 
    v_journal_entry_id,
    v_transaction_id,
    v_execution_time_ms,
    v_success;
    
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. Performance Analysis Views
-- =====================================================

-- View for monitoring revenue journal entry performance
CREATE OR REPLACE VIEW finance_revenue_performance_stats AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(*) AS total_operations,
  COUNT(*) FILTER (WHERE success = true) AS successful_operations,
  COUNT(*) FILTER (WHERE success = false) AS failed_operations,
  AVG(execution_time_ms) AS avg_execution_time_ms,
  MIN(execution_time_ms) AS min_execution_time_ms,
  MAX(execution_time_ms) AS max_execution_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) AS median_execution_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) AS p95_execution_time_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) AS p99_execution_time_ms,
  COUNT(*) FILTER (WHERE execution_time_ms > 100) AS operations_exceeding_100ms,
  ROUND(100.0 * COUNT(*) FILTER (WHERE execution_time_ms > 100) / COUNT(*), 2) AS pct_exceeding_100ms
FROM finance_performance_metrics
WHERE operation_type = 'revenue_journal_entry'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- View for identifying slow operations
CREATE OR REPLACE VIEW finance_slow_revenue_operations AS
SELECT
  id,
  operation_id,
  execution_time_ms,
  success,
  error_message,
  metadata->>'order_id' AS order_id,
  metadata->>'vendor_id' AS vendor_id,
  metadata->>'order_amount' AS order_amount,
  created_at
FROM finance_performance_metrics
WHERE operation_type = 'revenue_journal_entry'
  AND execution_time_ms > 100
ORDER BY execution_time_ms DESC;

-- =====================================================
-- 5. Materialized View for Account Balance Cache
-- =====================================================

-- Materialized view for fast account balance lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS finance_account_balances_cache AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(le.debit - le.credit), 0) AS balance,
  a.currency,
  NOW() AS last_updated
FROM finance_accounts a
LEFT JOIN finance_ledger_entries le ON le.account_id = a.id
LEFT JOIN finance_journal_entries je ON je.id = le.journal_entry_id
WHERE a.is_active = true
  AND (je.status = 'posted' OR je.status IS NULL)
GROUP BY a.id, a.code, a.name, a.type, a.currency;

-- Index on materialized view
CREATE UNIQUE INDEX idx_finance_account_balances_cache_account 
  ON finance_account_balances_cache(account_id);

CREATE INDEX idx_finance_account_balances_cache_code 
  ON finance_account_balances_cache(account_code);

-- Function to refresh balance cache
CREATE OR REPLACE FUNCTION refresh_account_balances_cache()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY finance_account_balances_cache;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Automated Cache Refresh
-- =====================================================

-- Trigger to refresh cache after journal entry posting
CREATE OR REPLACE FUNCTION trigger_refresh_account_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh cache asynchronously (doesn't block the transaction)
  PERFORM pg_notify('refresh_account_balances', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_journal_entry_posted
  AFTER UPDATE OF status ON finance_journal_entries
  FOR EACH ROW
  WHEN (NEW.status = 'posted' AND OLD.status != 'posted')
  EXECUTE FUNCTION trigger_refresh_account_balances();

-- =====================================================
-- 7. RLS Policies for New Tables
-- =====================================================

ALTER TABLE finance_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance admins can view performance metrics"
  ON finance_performance_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role = 'admin'
          OR (cr.permissions->'finance'->>'view' = 'true')
        )
    )
  );

-- =====================================================
-- 8. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_performance_metrics IS 'Performance monitoring for finance operations with execution time tracking';
COMMENT ON FUNCTION create_revenue_journal_entry_optimized IS 'Optimized function for creating revenue journal entries with performance monitoring (target: <100ms)';
COMMENT ON VIEW finance_revenue_performance_stats IS 'Hourly statistics for revenue journal entry performance';
COMMENT ON VIEW finance_slow_revenue_operations IS 'Operations exceeding 100ms performance threshold';
COMMENT ON MATERIALIZED VIEW finance_account_balances_cache IS 'Cached account balances for fast lookups';

COMMENT ON COLUMN finance_performance_metrics.execution_time_ms IS 'Execution time in milliseconds (target: <100ms for revenue operations)';
COMMENT ON COLUMN finance_performance_metrics.operation_type IS 'Type of operation: revenue_journal_entry, commission_calculation, etc.';
COMMENT ON COLUMN finance_performance_metrics.metadata IS 'JSONB containing operation-specific data for analysis';

