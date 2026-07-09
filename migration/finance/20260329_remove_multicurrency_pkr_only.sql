-- =====================================================
-- Remove Multi-Currency Support - PKR Only Migration
-- =====================================================
-- Removes all multi-currency functionality and sets PKR as the only currency
-- Updates all existing tables to use PKR by default
-- =====================================================

-- =====================================================
-- 1. Drop Currency Management Tables and Functions
-- =====================================================

-- Drop user currency preferences
DROP TABLE IF EXISTS user_currency_preferences CASCADE;

-- Drop system currencies table
DROP TABLE IF EXISTS system_currencies CASCADE;

-- Drop currency-related functions
DROP FUNCTION IF EXISTS set_default_currency(VARCHAR);
DROP FUNCTION IF EXISTS get_default_currency();
DROP FUNCTION IF EXISTS get_user_currency(UUID);
DROP FUNCTION IF EXISTS convert_currency(DECIMAL, VARCHAR, VARCHAR);

-- =====================================================
-- 2. Update Finance Tables to PKR Only
-- =====================================================

-- Update finance_accounts table
ALTER TABLE finance_accounts 
  ALTER COLUMN currency SET DEFAULT 'PKR';

-- Update existing accounts to PKR
UPDATE finance_accounts 
SET currency = 'PKR' 
WHERE currency != 'PKR';

-- Update finance_ledger_entries table
ALTER TABLE finance_ledger_entries 
  ALTER COLUMN currency SET DEFAULT 'PKR';

-- Update existing ledger entries to PKR
UPDATE finance_ledger_entries 
SET currency = 'PKR' 
WHERE currency != 'PKR';

-- Update finance_transactions table
ALTER TABLE finance_transactions 
  ALTER COLUMN currency SET DEFAULT 'PKR';

-- Update existing transactions to PKR
UPDATE finance_transactions 
SET currency = 'PKR' 
WHERE currency != 'PKR';

-- =====================================================
-- 3. Add Comments for PKR-Only System
-- =====================================================

COMMENT ON COLUMN finance_accounts.currency IS 'Currency code - PKR only (Pakistani Rupee)';
COMMENT ON COLUMN finance_ledger_entries.currency IS 'Currency code - PKR only (Pakistani Rupee)';
COMMENT ON COLUMN finance_transactions.currency IS 'Currency code - PKR only (Pakistani Rupee)';

-- =====================================================
-- 4. Create Helper Function for Currency Display
-- =====================================================

-- Function to format amount in PKR
CREATE OR REPLACE FUNCTION format_pkr_amount(p_amount DECIMAL(15, 2))
RETURNS TEXT AS $$
BEGIN
  RETURN '₨ ' || TO_CHAR(p_amount, 'FM999,999,999,990.00');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION format_pkr_amount(DECIMAL) IS 'Formats amount with PKR symbol and proper formatting';

-- =====================================================
-- 5. Update Future Tables (if they exist)
-- =====================================================

-- Update finance_order_data if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_order_data') THEN
    ALTER TABLE finance_order_data ALTER COLUMN currency SET DEFAULT 'PKR';
    UPDATE finance_order_data SET currency = 'PKR' WHERE currency != 'PKR';
  END IF;
END $$;

-- Update finance_delivery_data if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_delivery_data') THEN
    -- No currency column expected in delivery data
    NULL;
  END IF;
END $$;

-- Update finance_invoices if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_invoices') THEN
    ALTER TABLE finance_invoices ALTER COLUMN currency SET DEFAULT 'PKR';
    UPDATE finance_invoices SET currency = 'PKR' WHERE currency != 'PKR';
  END IF;
END $$;

-- Update finance_expenses if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_expenses') THEN
    ALTER TABLE finance_expenses ALTER COLUMN currency SET DEFAULT 'PKR';
    UPDATE finance_expenses SET currency = 'PKR' WHERE currency != 'PKR';
  END IF;
END $$;

-- Update finance_budgets if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_budgets') THEN
    -- No currency column expected in budgets
    NULL;
  END IF;
END $$;

-- Update finance_exchange_rates if it exists (drop it as not needed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_exchange_rates') THEN
    DROP TABLE finance_exchange_rates CASCADE;
  END IF;
END $$;

-- Update finance_receipt_vault if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_receipt_vault') THEN
    -- No currency column expected in receipt vault
    NULL;
  END IF;
END $$;

-- =====================================================
-- 6. Verification Query
-- =====================================================

-- Query to verify all currency columns are set to PKR
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check finance_accounts
  SELECT COUNT(*) INTO v_count FROM finance_accounts WHERE currency != 'PKR';
  IF v_count > 0 THEN
    RAISE WARNING 'Found % accounts with non-PKR currency', v_count;
  END IF;
  
  -- Check finance_ledger_entries
  SELECT COUNT(*) INTO v_count FROM finance_ledger_entries WHERE currency != 'PKR';
  IF v_count > 0 THEN
    RAISE WARNING 'Found % ledger entries with non-PKR currency', v_count;
  END IF;
  
  -- Check finance_transactions
  SELECT COUNT(*) INTO v_count FROM finance_transactions WHERE currency != 'PKR';
  IF v_count > 0 THEN
    RAISE WARNING 'Found % transactions with non-PKR currency', v_count;
  END IF;
  
  RAISE NOTICE 'Currency migration to PKR-only completed successfully';
END $$;
