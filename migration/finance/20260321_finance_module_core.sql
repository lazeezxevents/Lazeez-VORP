-- =====================================================
-- Finance Module Core Migration
-- =====================================================
-- PREREQUISITES:
--   - Master consolidated system migration (20260320_master_consolidated_system.sql)
--   - Required tables: role_assignments, custom_roles, employee_invitations
--   - See docs/TWO_LAYER_ROLE_SYSTEM.md for role system architecture
--   - See docs/SQL_MIGRATION_GUIDE.md for migration order
-- =====================================================
-- This migration creates the foundational tables for the Finance Module
-- including chart of accounts, journal entries, ledger entries, transactions,
-- and audit logs.
--
-- Requirements: 1.1, 1.2, 1.3, 1.8, 2.1, 19.1, 19.2
--
-- ROLE SYSTEM INTEGRATION:
-- This module uses the 2-layer role system:
--   Layer 1 (main_role): admin, manager, employee
--   Layer 2 (designation): Custom roles with granular permissions
--
-- Finance Permissions Structure (in custom_roles.permissions JSONB):
-- {
--   "finance": {
--     "view": true,              -- View financial data
--     "manage": true,            -- Manage accounts and settings
--     "create_entries": true,    -- Create journal entries
--     "post_entries": true,      -- Post journal entries
--     "view_reports": true,      -- View financial reports
--     "manage_payments": true,   -- Process payments
--     "view_audit": true         -- View audit logs (admin only)
--   }
-- }
--
-- Example Finance Designations to Create:
-- 1. "Finance Manager" (manager) - Full finance access
-- 2. "Accountant" (employee) - Create/view entries, view reports
-- 3. "Finance Analyst" (employee) - View only access
-- =====================================================

-- =====================================================
-- Pre-flight Dependency Check
-- =====================================================
-- Verify that the master consolidated migration has been applied
-- This migration depends on the 2-layer role system tables

DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  -- Check for required role system tables
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'role_assignments') THEN
    missing_tables := array_append(missing_tables, 'role_assignments');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_roles') THEN
    missing_tables := array_append(missing_tables, 'custom_roles');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_invitations') THEN
    missing_tables := array_append(missing_tables, 'employee_invitations');
  END IF;
  
  -- Raise error if any tables are missing
  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION E'Finance Module migration requires the 2-layer role system tables.\n\nMissing tables: %\n\nPlease apply migration 20260320_master_consolidated_system.sql first.\n\nSee docs/SQL_MIGRATION_GUIDE.md for migration order and troubleshooting.', array_to_string(missing_tables, ', ');
  END IF;
  
  RAISE NOTICE 'Pre-flight check passed: All required role system tables exist';
END $$;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Chart of Accounts (finance_accounts)
-- =====================================================
-- Stores the hierarchical chart of accounts structure
-- Supports multi-currency and parent-child relationships

CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  sub_type VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'USD',
  balance DECIMAL(15, 2) DEFAULT 0,
  parent_account_id UUID REFERENCES finance_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_finance_accounts_code ON finance_accounts(code);
CREATE INDEX idx_finance_accounts_type ON finance_accounts(type);
CREATE INDEX idx_finance_accounts_parent ON finance_accounts(parent_account_id);
CREATE INDEX idx_finance_accounts_active ON finance_accounts(is_active);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_finance_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_accounts_updated_at();

-- RLS Policies for finance_accounts
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;

-- Users with finance.view permission can view accounts
CREATE POLICY "Users with finance permission can view accounts"
  ON finance_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN role_assignments ra ON ra.user_id = p.id
      JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          cr.permissions->>'finance' IS NOT NULL
          OR p.main_role = 'admin'
        )
    )
  );

-- Users with finance.manage permission or admins can manage accounts
CREATE POLICY "Users with finance manage permission can manage accounts"
  ON finance_accounts
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
-- 2. Journal Entries (finance_journal_entries)
-- =====================================================
-- Stores journal entry headers with status tracking

CREATE TABLE IF NOT EXISTS finance_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  created_by UUID REFERENCES auth.users(id),
  posted_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_finance_journal_entries_number ON finance_journal_entries(entry_number);
CREATE INDEX idx_finance_journal_entries_date ON finance_journal_entries(entry_date);
CREATE INDEX idx_finance_journal_entries_status ON finance_journal_entries(status);
CREATE INDEX idx_finance_journal_entries_created_by ON finance_journal_entries(created_by);

-- Updated timestamp trigger
CREATE TRIGGER finance_journal_entries_updated_at
  BEFORE UPDATE ON finance_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_accounts_updated_at();

-- RLS Policies for finance_journal_entries
ALTER TABLE finance_journal_entries ENABLE ROW LEVEL SECURITY;

-- Users with finance.view permission can view journal entries
CREATE POLICY "Users with finance permission can view journal entries"
  ON finance_journal_entries
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

-- Users with finance permission can create journal entries
CREATE POLICY "Users with finance permission can create journal entries"
  ON finance_journal_entries
  FOR INSERT
  WITH CHECK (
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

-- Only creators or admins can update draft entries
CREATE POLICY "Users can update own draft journal entries"
  ON finance_journal_entries
  FOR UPDATE
  USING (
    status = 'draft' AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin'
      )
    )
  );

-- =====================================================
-- 3. Ledger Entries (finance_ledger_entries)
-- =====================================================
-- Stores individual debit/credit entries for each journal entry

CREATE TABLE IF NOT EXISTS finance_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES finance_journal_entries(id) ON DELETE CASCADE,
  account_id UUID REFERENCES finance_accounts(id),
  debit DECIMAL(15, 2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15, 2) DEFAULT 0 CHECK (credit >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Indexes for performance
CREATE INDEX idx_finance_ledger_entries_journal ON finance_ledger_entries(journal_entry_id);
CREATE INDEX idx_finance_ledger_entries_account ON finance_ledger_entries(account_id);
CREATE INDEX idx_finance_ledger_entries_created_at ON finance_ledger_entries(created_at);

-- RLS Policies for finance_ledger_entries
ALTER TABLE finance_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Users with finance permission can view ledger entries
CREATE POLICY "Users with finance permission can view ledger entries"
  ON finance_ledger_entries
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

-- Users with finance permission can create ledger entries
CREATE POLICY "Users with finance permission can create ledger entries"
  ON finance_ledger_entries
  FOR INSERT
  WITH CHECK (
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
-- 4. Transactions (finance_transactions)
-- =====================================================
-- Stores high-level transaction records linked to source systems

CREATE TABLE IF NOT EXISTS finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('revenue', 'expense', 'transfer', 'adjustment')),
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'void')),
  source_module VARCHAR(50),
  source_id UUID,
  journal_entry_id UUID REFERENCES finance_journal_entries(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_finance_transactions_number ON finance_transactions(transaction_number);
CREATE INDEX idx_finance_transactions_date ON finance_transactions(transaction_date);
CREATE INDEX idx_finance_transactions_type ON finance_transactions(type);
CREATE INDEX idx_finance_transactions_status ON finance_transactions(status);
CREATE INDEX idx_finance_transactions_source ON finance_transactions(source_module, source_id);
CREATE INDEX idx_finance_transactions_created_at ON finance_transactions(created_at);

-- Updated timestamp trigger
CREATE TRIGGER finance_transactions_updated_at
  BEFORE UPDATE ON finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_accounts_updated_at();

-- RLS Policies for finance_transactions
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- Users with finance permission can view all transactions
CREATE POLICY "Users with finance permission can view transactions"
  ON finance_transactions
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

-- Users can view their own expense transactions
CREATE POLICY "Users can view own expense transactions"
  ON finance_transactions
  FOR SELECT
  USING (
    type = 'expense' AND 
    source_module = 'expense' AND
    created_by = auth.uid()
  );

-- =====================================================
-- 5. Audit Log (finance_audit_log)
-- =====================================================
-- Immutable audit trail for all financial changes

CREATE TABLE IF NOT EXISTS finance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX idx_finance_audit_log_entity ON finance_audit_log(entity_type, entity_id);
CREATE INDEX idx_finance_audit_log_changed_at ON finance_audit_log(changed_at);
CREATE INDEX idx_finance_audit_log_changed_by ON finance_audit_log(changed_by);

-- Make audit log append-only (no updates or deletes)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON finance_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON finance_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- RLS Policies for finance_audit_log
ALTER TABLE finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON finance_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND main_role = 'admin'
    )
  );

-- System can insert audit logs (no user restrictions)
CREATE POLICY "System can insert audit logs"
  ON finance_audit_log
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 6. Helper Functions
-- =====================================================

-- Function to generate next journal entry number
CREATE OR REPLACE FUNCTION generate_journal_entry_number()
RETURNS VARCHAR AS $$
DECLARE
  next_number INTEGER;
  year_prefix VARCHAR(4);
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM finance_journal_entries
  WHERE entry_number LIKE year_prefix || '%';
  
  RETURN year_prefix || LPAD(next_number::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next transaction number
CREATE OR REPLACE FUNCTION generate_transaction_number()
RETURNS VARCHAR AS $$
DECLARE
  next_number INTEGER;
  year_prefix VARCHAR(4);
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_number
  FROM finance_transactions
  WHERE transaction_number LIKE year_prefix || '%';
  
  RETURN 'TXN' || year_prefix || LPAD(next_number::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to validate journal entry balance
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(p_journal_entry_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_debits DECIMAL(15, 2);
  total_credits DECIMAL(15, 2);
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debits, total_credits
  FROM finance_ledger_entries
  WHERE journal_entry_id = p_journal_entry_id;
  
  -- Allow small rounding differences (0.01)
  RETURN ABS(total_debits - total_credits) < 0.01;
END;
$$ LANGUAGE plpgsql;

-- Function to post journal entry (atomic operation)
CREATE OR REPLACE FUNCTION post_journal_entry(p_journal_entry_id UUID, p_posted_by UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_balanced BOOLEAN;
  v_entry RECORD;
BEGIN
  -- Check if entry exists and is in draft status
  SELECT * INTO v_entry
  FROM finance_journal_entries
  WHERE id = p_journal_entry_id AND status = 'draft';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found or not in draft status';
  END IF;
  
  -- Validate balance
  v_is_balanced := validate_journal_entry_balance(p_journal_entry_id);
  
  IF NOT v_is_balanced THEN
    RAISE EXCEPTION 'Journal entry is not balanced';
  END IF;
  
  -- Update journal entry status
  UPDATE finance_journal_entries
  SET 
    status = 'posted',
    posted_by = p_posted_by,
    posted_at = NOW()
  WHERE id = p_journal_entry_id;
  
  -- Update account balances
  UPDATE finance_accounts a
  SET balance = balance + COALESCE(
    (SELECT SUM(debit - credit)
     FROM finance_ledger_entries
     WHERE journal_entry_id = p_journal_entry_id
       AND account_id = a.id), 0
  )
  WHERE id IN (
    SELECT DISTINCT account_id
    FROM finance_ledger_entries
    WHERE journal_entry_id = p_journal_entry_id
  );
  
  -- Create audit log entry
  INSERT INTO finance_audit_log (
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    'journal_entry',
    p_journal_entry_id,
    'posted',
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'posted', 'posted_at', NOW()),
    p_posted_by
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Seed Data - Standard Chart of Accounts
-- =====================================================
-- Insert standard chart of accounts structure

INSERT INTO finance_accounts (code, name, type, sub_type) VALUES
  -- Assets
  ('1000', 'Assets', 'asset', 'header'),
  ('1100', 'Current Assets', 'asset', 'header'),
  ('1110', 'Cash', 'asset', 'cash'),
  ('1120', 'Accounts Receivable', 'asset', 'receivable'),
  ('1130', 'Inventory', 'asset', 'inventory'),
  ('1200', 'Fixed Assets', 'asset', 'header'),
  ('1210', 'Property and Equipment', 'asset', 'fixed'),
  ('1220', 'Accumulated Depreciation', 'asset', 'contra'),
  
  -- Liabilities
  ('2000', 'Liabilities', 'liability', 'header'),
  ('2100', 'Current Liabilities', 'liability', 'header'),
  ('2110', 'Accounts Payable', 'liability', 'payable'),
  ('2120', 'Accounts Payable - Vendors', 'liability', 'payable'),
  ('2130', 'Accounts Payable - Riders', 'liability', 'payable'),
  ('2140', 'Accrued Expenses', 'liability', 'accrued'),
  ('2200', 'Long-term Liabilities', 'liability', 'header'),
  ('2210', 'Long-term Debt', 'liability', 'debt'),
  
  -- Equity
  ('3000', 'Equity', 'equity', 'header'),
  ('3100', 'Owner''s Equity', 'equity', 'capital'),
  ('3200', 'Retained Earnings', 'equity', 'retained'),
  
  -- Revenue
  ('4000', 'Revenue', 'revenue', 'header'),
  ('4100', 'Subscription Revenue', 'revenue', 'subscription'),
  ('4200', 'Commission Revenue', 'revenue', 'commission'),
  ('4300', 'Transaction Fees', 'revenue', 'fees'),
  ('4400', 'Service Charges', 'revenue', 'service'),
  ('4500', 'Other Revenue', 'revenue', 'other'),
  
  -- Expenses
  ('5000', 'Expenses', 'expense', 'header'),
  ('5100', 'Cost of Goods Sold', 'expense', 'cogs'),
  ('5200', 'Operating Expenses', 'expense', 'header'),
  ('5210', 'Commission Expense', 'expense', 'commission'),
  ('5220', 'Vendor Payouts', 'expense', 'payout'),
  ('5230', 'Rider Commissions', 'expense', 'commission'),
  ('5240', 'Salaries and Wages', 'expense', 'payroll'),
  ('5250', 'Marketing Expenses', 'expense', 'marketing'),
  ('5260', 'Technology Expenses', 'expense', 'technology'),
  ('5270', 'Administrative Expenses', 'expense', 'administrative'),
  ('5280', 'Other Expenses', 'expense', 'other')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE finance_accounts IS 'Chart of accounts with hierarchical structure';
COMMENT ON TABLE finance_journal_entries IS 'Journal entry headers with status tracking';
COMMENT ON TABLE finance_ledger_entries IS 'Individual debit/credit entries for journal entries';
COMMENT ON TABLE finance_transactions IS 'High-level transaction records linked to source systems';
COMMENT ON TABLE finance_audit_log IS 'Immutable audit trail for all financial changes';

COMMENT ON FUNCTION generate_journal_entry_number() IS 'Generates sequential journal entry numbers by year';
COMMENT ON FUNCTION generate_transaction_number() IS 'Generates sequential transaction numbers with TXN prefix';
COMMENT ON FUNCTION validate_journal_entry_balance(UUID) IS 'Validates that journal entry debits equal credits';
COMMENT ON FUNCTION post_journal_entry(UUID, UUID) IS 'Posts journal entry and updates account balances atomically';


-- =====================================================
-- VERIFICATION QUERIES (uncomment to test)
-- =====================================================

-- Check all required tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('role_assignments', 'custom_roles', 'employee_invitations', 'finance_accounts', 'finance_journal_entries', 'finance_ledger_entries', 'finance_transactions', 'finance_audit_log');

-- Verify role system schema structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'role_assignments' ORDER BY ordinal_position;

-- Test RLS policy compilation
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename LIKE 'finance_%';

-- Validate helper functions exist
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('generate_journal_entry_number', 'generate_transaction_number', 'validate_journal_entry_balance', 'post_journal_entry');

-- Check finance accounts seed data
-- SELECT code, name, type FROM finance_accounts ORDER BY code;
