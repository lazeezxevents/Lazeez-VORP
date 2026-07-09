-- =====================================================
-- Data Retention Policies
-- =====================================================
-- Description: Archive transactions older than 7 years with legal hold support
-- Requirements: 29.1, 29.2, 29.3
-- Task: 48.2
-- =====================================================

-- =====================================================
-- Transaction Archive Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_transactions_archive (
  id UUID PRIMARY KEY,
  transaction_number VARCHAR(50) NOT NULL,
  transaction_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL,
  description TEXT,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PKR',
  status VARCHAR(20) NOT NULL,
  source_module VARCHAR(50),
  source_id UUID,
  journal_entry_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  -- Archive metadata
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id),
  archive_reason TEXT
);

-- Indexes for archive table
CREATE INDEX idx_finance_transactions_archive_date 
  ON finance_transactions_archive(transaction_date);
CREATE INDEX idx_finance_transactions_archive_number 
  ON finance_transactions_archive(transaction_number);
CREATE INDEX idx_finance_transactions_archive_archived_at 
  ON finance_transactions_archive(archived_at);

-- =====================================================
-- Journal Entry Archive Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_journal_entries_archive (
  id UUID PRIMARY KEY,
  entry_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  -- Archive metadata
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id),
  archive_reason TEXT
);

-- Indexes for archive table
CREATE INDEX idx_finance_journal_entries_archive_date 
  ON finance_journal_entries_archive(entry_date);
CREATE INDEX idx_finance_journal_entries_archive_number 
  ON finance_journal_entries_archive(entry_number);

-- =====================================================
-- Ledger Entry Archive Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_ledger_entries_archive (
  id UUID PRIMARY KEY,
  journal_entry_id UUID NOT NULL,
  account_id UUID NOT NULL,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'PKR',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  
  -- Archive metadata
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Indexes for archive table
CREATE INDEX idx_finance_ledger_entries_archive_journal 
  ON finance_ledger_entries_archive(journal_entry_id);
CREATE INDEX idx_finance_ledger_entries_archive_account 
  ON finance_ledger_entries_archive(account_id);

-- =====================================================
-- Legal Hold Table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Hold details
  hold_name VARCHAR(255) NOT NULL,
  hold_reason TEXT NOT NULL,
  case_number VARCHAR(100),
  
  -- Entity references
  entity_type VARCHAR(50) NOT NULL,
  entity_ids UUID[] NOT NULL,
  
  -- Hold period
  hold_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hold_end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_by UUID REFERENCES auth.users(id),
  released_at TIMESTAMPTZ,
  release_reason TEXT
);

-- Indexes for legal holds
CREATE INDEX idx_finance_legal_holds_entity 
  ON finance_legal_holds(entity_type, is_active);
CREATE INDEX idx_finance_legal_holds_active 
  ON finance_legal_holds(is_active, hold_end_date);

-- =====================================================
-- Archive Summary Table
-- =====================================================
-- Maintains summary statistics for archived periods

CREATE TABLE IF NOT EXISTS finance_archive_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Summary statistics
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_income DECIMAL(15, 2) NOT NULL DEFAULT 0,
  
  -- Journal entry statistics
  total_journal_entries INTEGER NOT NULL DEFAULT 0,
  total_ledger_entries INTEGER NOT NULL DEFAULT 0,
  
  -- Archive metadata
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id),
  
  UNIQUE(period_start, period_end)
);

-- Index for archive summaries
CREATE INDEX idx_finance_archive_summaries_period 
  ON finance_archive_summaries(period_start, period_end);

-- =====================================================
-- Function: Check if entity is under legal hold
-- =====================================================

CREATE OR REPLACE FUNCTION is_under_legal_hold(
  p_entity_type VARCHAR(50),
  p_entity_id UUID
)
RETURNS BOOLEAN AS $
DECLARE
  v_hold_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_hold_count
  FROM finance_legal_holds
  WHERE entity_type = p_entity_type
    AND p_entity_id = ANY(entity_ids)
    AND is_active = TRUE
    AND (hold_end_date IS NULL OR hold_end_date >= CURRENT_DATE);
  
  RETURN v_hold_count > 0;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- Function: Archive old transactions
-- =====================================================

CREATE OR REPLACE FUNCTION archive_old_transactions(
  p_archive_before_date DATE DEFAULT NULL
)
RETURNS TABLE (
  archived_transactions INTEGER,
  archived_journal_entries INTEGER,
  archived_ledger_entries INTEGER,
  period_start DATE,
  period_end DATE
) AS $
DECLARE
  v_archive_date DATE;
  v_archived_txn_count INTEGER;
  v_archived_je_count INTEGER;
  v_archived_le_count INTEGER;
  v_period_start DATE;
  v_period_end DATE;
  v_total_revenue DECIMAL(15, 2);
  v_total_expenses DECIMAL(15, 2);
BEGIN
  -- Default to 7 years ago
  v_archive_date := COALESCE(p_archive_before_date, CURRENT_DATE - INTERVAL '7 years');
  
  -- Calculate period
  SELECT MIN(transaction_date), MAX(transaction_date)
  INTO v_period_start, v_period_end
  FROM finance_transactions
  WHERE transaction_date < v_archive_date
    AND NOT is_under_legal_hold('transaction', id);
  
  IF v_period_start IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, NULL::DATE, NULL::DATE;
    RETURN;
  END IF;
  
  -- Calculate summary statistics
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_total_revenue, v_total_expenses
  FROM finance_transactions
  WHERE transaction_date < v_archive_date
    AND NOT is_under_legal_hold('transaction', id);
  
  -- Archive transactions
  WITH archived_txn AS (
    INSERT INTO finance_transactions_archive
    SELECT 
      id, transaction_number, transaction_date, type, description,
      amount, currency, status, source_module, source_id,
      journal_entry_id, created_by, created_at, updated_at,
      NOW(), auth.uid(), 'Automatic 7-year retention policy'
    FROM finance_transactions
    WHERE transaction_date < v_archive_date
      AND NOT is_under_legal_hold('transaction', id)
    RETURNING id
  ),
  deleted_txn AS (
    DELETE FROM finance_transactions
    WHERE id IN (SELECT id FROM archived_txn)
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_archived_txn_count FROM deleted_txn;
  
  -- Archive journal entries
  WITH archived_je AS (
    INSERT INTO finance_journal_entries_archive
    SELECT 
      je.id, je.entry_number, je.entry_date, je.description, je.reference,
      je.status, je.created_by, je.posted_by, je.posted_at,
      je.created_at, je.updated_at,
      NOW(), auth.uid(), 'Automatic 7-year retention policy'
    FROM finance_journal_entries je
    WHERE je.entry_date < v_archive_date
      AND NOT is_under_legal_hold('journal_entry', je.id)
      AND NOT EXISTS (
        SELECT 1 FROM finance_transactions t
        WHERE t.journal_entry_id = je.id
      )
    RETURNING id
  ),
  archived_le AS (
    INSERT INTO finance_ledger_entries_archive
    SELECT 
      le.id, le.journal_entry_id, le.account_id, le.debit, le.credit,
      le.currency, le.description, le.created_at,
      NOW(), auth.uid()
    FROM finance_ledger_entries le
    WHERE le.journal_entry_id IN (SELECT id FROM archived_je)
    RETURNING id
  ),
  deleted_le AS (
    DELETE FROM finance_ledger_entries
    WHERE journal_entry_id IN (SELECT id FROM archived_je)
    RETURNING id
  ),
  deleted_je AS (
    DELETE FROM finance_journal_entries
    WHERE id IN (SELECT id FROM archived_je)
    RETURNING id
  )
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM deleted_je),
    (SELECT COUNT(*)::INTEGER FROM deleted_le)
  INTO v_archived_je_count, v_archived_le_count;
  
  -- Create archive summary
  INSERT INTO finance_archive_summaries (
    period_start,
    period_end,
    total_transactions,
    total_revenue,
    total_expenses,
    net_income,
    total_journal_entries,
    total_ledger_entries,
    archived_by
  ) VALUES (
    v_period_start,
    v_period_end,
    v_archived_txn_count,
    v_total_revenue,
    v_total_expenses,
    v_total_revenue - v_total_expenses,
    v_archived_je_count,
    v_archived_le_count,
    auth.uid()
  )
  ON CONFLICT (period_start, period_end) DO UPDATE SET
    total_transactions = finance_archive_summaries.total_transactions + EXCLUDED.total_transactions,
    total_revenue = finance_archive_summaries.total_revenue + EXCLUDED.total_revenue,
    total_expenses = finance_archive_summaries.total_expenses + EXCLUDED.total_expenses,
    net_income = finance_archive_summaries.net_income + EXCLUDED.net_income,
    total_journal_entries = finance_archive_summaries.total_journal_entries + EXCLUDED.total_journal_entries,
    total_ledger_entries = finance_archive_summaries.total_ledger_entries + EXCLUDED.total_ledger_entries;
  
  RETURN QUERY SELECT 
    v_archived_txn_count,
    v_archived_je_count,
    v_archived_le_count,
    v_period_start,
    v_period_end;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Create legal hold
-- =====================================================

CREATE OR REPLACE FUNCTION create_legal_hold(
  p_hold_name VARCHAR(255),
  p_hold_reason TEXT,
  p_entity_type VARCHAR(50),
  p_entity_ids UUID[],
  p_case_number VARCHAR(100) DEFAULT NULL,
  p_hold_end_date DATE DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  v_hold_id UUID;
BEGIN
  INSERT INTO finance_legal_holds (
    hold_name,
    hold_reason,
    case_number,
    entity_type,
    entity_ids,
    hold_end_date,
    created_by
  ) VALUES (
    p_hold_name,
    p_hold_reason,
    p_case_number,
    p_entity_type,
    p_entity_ids,
    p_hold_end_date,
    auth.uid()
  )
  RETURNING id INTO v_hold_id;
  
  RETURN v_hold_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Release legal hold
-- =====================================================

CREATE OR REPLACE FUNCTION release_legal_hold(
  p_hold_id UUID,
  p_release_reason TEXT
)
RETURNS BOOLEAN AS $
BEGIN
  UPDATE finance_legal_holds
  SET 
    is_active = FALSE,
    released_by = auth.uid(),
    released_at = NOW(),
    release_reason = p_release_reason
  WHERE id = p_hold_id
    AND is_active = TRUE;
  
  RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Get archive summaries
-- =====================================================

CREATE OR REPLACE FUNCTION get_archive_summaries(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  period_start DATE,
  period_end DATE,
  total_transactions INTEGER,
  total_revenue DECIMAL(15, 2),
  total_expenses DECIMAL(15, 2),
  net_income DECIMAL(15, 2),
  total_journal_entries INTEGER,
  total_ledger_entries INTEGER,
  archived_at TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.period_start,
    s.period_end,
    s.total_transactions,
    s.total_revenue,
    s.total_expenses,
    s.net_income,
    s.total_journal_entries,
    s.total_ledger_entries,
    s.archived_at
  FROM finance_archive_summaries s
  WHERE (p_start_date IS NULL OR s.period_end >= p_start_date)
    AND (p_end_date IS NULL OR s.period_start <= p_end_date)
  ORDER BY s.period_start DESC;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Archive tables - admin only
ALTER TABLE finance_transactions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_journal_entries_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_ledger_entries_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_archive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived transactions"
  ON finance_transactions_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Admins can view archived journal entries"
  ON finance_journal_entries_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Admins can view archived ledger entries"
  ON finance_ledger_entries_archive FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Admins can manage legal holds"
  ON finance_legal_holds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY "Admins can view archive summaries"
  ON finance_archive_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role_name IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE finance_transactions_archive IS 'Archive for transactions older than 7 years';
COMMENT ON TABLE finance_journal_entries_archive IS 'Archive for journal entries older than 7 years';
COMMENT ON TABLE finance_ledger_entries_archive IS 'Archive for ledger entries older than 7 years';
COMMENT ON TABLE finance_legal_holds IS 'Legal holds preventing archival of specific entities';
COMMENT ON TABLE finance_archive_summaries IS 'Summary statistics for archived periods';

COMMENT ON FUNCTION is_under_legal_hold(VARCHAR, UUID) IS 'Checks if an entity is under active legal hold';
COMMENT ON FUNCTION archive_old_transactions(DATE) IS 'Archives transactions older than specified date (default 7 years)';
COMMENT ON FUNCTION create_legal_hold(VARCHAR, TEXT, VARCHAR, UUID[], VARCHAR, DATE) IS 'Creates a legal hold on specified entities';
COMMENT ON FUNCTION release_legal_hold(UUID, TEXT) IS 'Releases an active legal hold';
COMMENT ON FUNCTION get_archive_summaries(DATE, DATE) IS 'Retrieves archive summaries for specified period';

