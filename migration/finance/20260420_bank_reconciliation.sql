-- =====================================================
-- Bank Reconciliation System
-- =====================================================
-- Description: Database schema for bank reconciliation
-- Requirements: 23.1, 23.2, 23.4, 23.5, 23.6, 23.8
-- Task: 27.1, 27.2, 27.3
-- =====================================================

-- =====================================================
-- Bank Statements Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_bank_statements (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Statement Metadata
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  statement_date DATE NOT NULL,
  statement_period_start DATE NOT NULL,
  statement_period_end DATE NOT NULL,
  
  -- Balances
  opening_balance DECIMAL(15, 2) NOT NULL,
  closing_balance DECIMAL(15, 2) NOT NULL,
  
  -- Import Details
  file_name VARCHAR(255),
  file_format VARCHAR(10) CHECK (file_format IN ('CSV', 'OFX', 'QBO')),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES auth.users(id),
  
  -- Status
  reconciliation_status VARCHAR(20) DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'in_progress', 'completed', 'discrepancy')),
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Bank Transactions Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_bank_transactions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  statement_id UUID NOT NULL REFERENCES finance_bank_statements(id) ON DELETE CASCADE,
  
  -- Transaction Details
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(100),
  
  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  
  -- Balance
  running_balance DECIMAL(15, 2),
  
  -- Matching
  matched BOOLEAN DEFAULT FALSE,
  matched_ledger_entry_id UUID REFERENCES finance_ledger_entries(id),
  match_confidence DECIMAL(5, 2), -- 0-100 percentage
  match_method VARCHAR(20) CHECK (match_method IN ('exact', 'fuzzy', 'manual')),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Reconciliation Reports Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_reconciliation_reports (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  statement_id UUID NOT NULL REFERENCES finance_bank_statements(id) ON DELETE CASCADE,
  
  -- Report Details
  report_date DATE NOT NULL,
  reconciliation_period_start DATE NOT NULL,
  reconciliation_period_end DATE NOT NULL,
  
  -- Balances
  book_balance DECIMAL(15, 2) NOT NULL,
  bank_balance DECIMAL(15, 2) NOT NULL,
  difference DECIMAL(15, 2) NOT NULL,
  
  -- Matching Statistics
  total_bank_transactions INTEGER NOT NULL DEFAULT 0,
  matched_transactions INTEGER NOT NULL DEFAULT 0,
  unmatched_bank_transactions INTEGER NOT NULL DEFAULT 0,
  unmatched_book_transactions INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'approved')),
  
  -- Notes
  notes TEXT,
  discrepancies JSONB, -- Array of discrepancy details
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_bank_statements_account ON finance_bank_statements(account_number);
CREATE INDEX idx_bank_statements_date ON finance_bank_statements(statement_date);
CREATE INDEX idx_bank_statements_status ON finance_bank_statements(reconciliation_status);

CREATE INDEX idx_bank_transactions_statement ON finance_bank_transactions(statement_id);
CREATE INDEX idx_bank_transactions_date ON finance_bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_matched ON finance_bank_transactions(matched);
CREATE INDEX idx_bank_transactions_ledger ON finance_bank_transactions(matched_ledger_entry_id);

CREATE INDEX idx_reconciliation_reports_statement ON finance_reconciliation_reports(statement_id);
CREATE INDEX idx_reconciliation_reports_date ON finance_reconciliation_reports(report_date);
CREATE INDEX idx_reconciliation_reports_status ON finance_reconciliation_reports(status);

-- =====================================================
-- Functions
-- =====================================================

-- Function to calculate reconciliation difference
CREATE OR REPLACE FUNCTION calculate_reconciliation_difference(
  p_statement_id UUID
)
RETURNS TABLE (
  book_balance DECIMAL(15, 2),
  bank_balance DECIMAL(15, 2),
  difference DECIMAL(15, 2),
  matched_count INTEGER,
  unmatched_bank_count INTEGER,
  unmatched_book_count INTEGER
) AS $$
DECLARE
  v_bank_balance DECIMAL(15, 2);
  v_book_balance DECIMAL(15, 2);
  v_matched_count INTEGER;
  v_unmatched_bank_count INTEGER;
  v_unmatched_book_count INTEGER;
BEGIN
  -- Get bank balance from statement
  SELECT closing_balance INTO v_bank_balance
  FROM finance_bank_statements
  WHERE id = p_statement_id;
  
  -- Calculate book balance from matched transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN bt.transaction_type = 'credit' THEN bt.amount
      WHEN bt.transaction_type = 'debit' THEN -bt.amount
    END
  ), 0) INTO v_book_balance
  FROM finance_bank_transactions bt
  WHERE bt.statement_id = p_statement_id
    AND bt.matched = TRUE;
  
  -- Count matched transactions
  SELECT COUNT(*) INTO v_matched_count
  FROM finance_bank_transactions
  WHERE statement_id = p_statement_id
    AND matched = TRUE;
  
  -- Count unmatched bank transactions
  SELECT COUNT(*) INTO v_unmatched_bank_count
  FROM finance_bank_transactions
  WHERE statement_id = p_statement_id
    AND matched = FALSE;
  
  -- Count unmatched book transactions (ledger entries without bank match)
  SELECT COUNT(*) INTO v_unmatched_book_count
  FROM finance_ledger_entries le
  WHERE le.id NOT IN (
    SELECT matched_ledger_entry_id
    FROM finance_bank_transactions
    WHERE statement_id = p_statement_id
      AND matched = TRUE
      AND matched_ledger_entry_id IS NOT NULL
  );
  
  RETURN QUERY SELECT 
    v_book_balance,
    v_bank_balance,
    v_bank_balance - v_book_balance AS difference,
    v_matched_count,
    v_unmatched_bank_count,
    v_unmatched_book_count;
END;
$$ LANGUAGE plpgsql;

-- Function to match bank transaction with ledger entry
CREATE OR REPLACE FUNCTION match_bank_transaction(
  p_bank_transaction_id UUID,
  p_ledger_entry_id UUID,
  p_match_method VARCHAR(20),
  p_confidence DECIMAL(5, 2)
)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_bank_transactions
  SET 
    matched = TRUE,
    matched_ledger_entry_id = p_ledger_entry_id,
    match_method = p_match_method,
    match_confidence = p_confidence,
    matched_at = NOW(),
    matched_by = auth.uid()
  WHERE id = p_bank_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to unmatch bank transaction
CREATE OR REPLACE FUNCTION unmatch_bank_transaction(
  p_bank_transaction_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE finance_bank_transactions
  SET 
    matched = FALSE,
    matched_ledger_entry_id = NULL,
    match_method = NULL,
    match_confidence = NULL,
    matched_at = NULL,
    matched_by = NULL
  WHERE id = p_bank_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_bank_statements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_statements_updated_at
  BEFORE UPDATE ON finance_bank_statements
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_statements_updated_at();

CREATE TRIGGER bank_transactions_updated_at
  BEFORE UPDATE ON finance_bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_statements_updated_at();

CREATE TRIGGER reconciliation_reports_updated_at
  BEFORE UPDATE ON finance_reconciliation_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_statements_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE finance_bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_reconciliation_reports ENABLE ROW LEVEL SECURITY;

-- Finance users can view bank statements
CREATE POLICY "Finance users can view bank statements"
  ON finance_bank_statements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

-- Finance admins can manage bank statements
CREATE POLICY "Finance admins can manage bank statements"
  ON finance_bank_statements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- Finance users can view bank transactions
CREATE POLICY "Finance users can view bank transactions"
  ON finance_bank_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

-- Finance admins can manage bank transactions
CREATE POLICY "Finance admins can manage bank transactions"
  ON finance_bank_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- Finance users can view reconciliation reports
CREATE POLICY "Finance users can view reconciliation reports"
  ON finance_reconciliation_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager', 'finance_user')
    )
  );

-- Finance admins can manage reconciliation reports
CREATE POLICY "Finance admins can manage reconciliation reports"
  ON finance_reconciliation_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_bank_statements IS 'Stores imported bank statements for reconciliation';
COMMENT ON TABLE finance_bank_transactions IS 'Stores individual transactions from bank statements';
COMMENT ON TABLE finance_reconciliation_reports IS 'Stores reconciliation reports with matching statistics and discrepancies';

COMMENT ON FUNCTION calculate_reconciliation_difference(UUID) IS 'Calculates the difference between book and bank balances for a statement';
COMMENT ON FUNCTION match_bank_transaction(UUID, UUID, VARCHAR, DECIMAL) IS 'Matches a bank transaction with a ledger entry';
COMMENT ON FUNCTION unmatch_bank_transaction(UUID) IS 'Unmatches a bank transaction from its ledger entry';
