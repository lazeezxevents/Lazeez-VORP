-- Finance Expenses Table Migration
-- Task 18.1: Create finance_expenses table
-- Requirements: 9.1, 9.2

-- Create finance_expenses table
CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'PKR',
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  receipt_vault_id UUID REFERENCES finance_receipt_vault(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending_approval', 'approved', 'rejected', 'reimbursed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  reimbursed_at TIMESTAMPTZ,
  reimbursement_transaction_id UUID,
  project_id UUID,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  policy_violations JSONB DEFAULT '[]'::jsonb,
  approval_chain JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_finance_expenses_employee_id ON finance_expenses(employee_id);
CREATE INDEX idx_finance_expenses_status ON finance_expenses(status);
CREATE INDEX idx_finance_expenses_expense_date ON finance_expenses(expense_date);
CREATE INDEX idx_finance_expenses_category ON finance_expenses(category);
CREATE INDEX idx_finance_expenses_submitted_at ON finance_expenses(submitted_at);
CREATE INDEX idx_finance_expenses_approved_by ON finance_expenses(approved_by);

-- Create composite index for common queries
CREATE INDEX idx_finance_expenses_employee_status ON finance_expenses(employee_id, status);
CREATE INDEX idx_finance_expenses_status_date ON finance_expenses(status, expense_date);

-- Enable Row Level Security
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees can view their own expenses
CREATE POLICY "Employees can view own expenses"
  ON finance_expenses
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR
    -- Managers can view their team's expenses
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'hr', 'manager')
    )
    OR
    -- Finance team can view all expenses
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager', 'accountant')
    )
  );

-- RLS Policy: Employees can insert their own expenses
CREATE POLICY "Employees can submit expenses"
  ON finance_expenses
  FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
  );

-- RLS Policy: Employees can update their own submitted expenses
CREATE POLICY "Employees can update own submitted expenses"
  ON finance_expenses
  FOR UPDATE
  USING (
    employee_id = auth.uid()
    AND status = 'submitted'
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND status = 'submitted'
  );

-- RLS Policy: Managers and finance team can update expenses for approval
CREATE POLICY "Managers can approve/reject expenses"
  ON finance_expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'hr', 'manager', 'finance_admin', 'finance_manager')
    )
  );

-- RLS Policy: Finance team can process reimbursements
CREATE POLICY "Finance team can process reimbursements"
  ON finance_expenses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager', 'accountant')
    )
    AND status = 'approved'
  );

-- Create updated_at trigger
CREATE TRIGGER update_finance_expenses_updated_at
  BEFORE UPDATE ON finance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create audit log trigger for expense changes
CREATE OR REPLACE FUNCTION log_expense_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO finance_audit_log (
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at
    ) VALUES (
      'expense',
      NEW.id,
      'update',
      to_jsonb(OLD),
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO finance_audit_log (
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at
    ) VALUES (
      'expense',
      NEW.id,
      'create',
      NULL,
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER expense_audit_trigger
  AFTER INSERT OR UPDATE ON finance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION log_expense_changes();

-- Create function to get expenses by employee
CREATE OR REPLACE FUNCTION get_employee_expenses(
  p_employee_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  amount DECIMAL,
  currency TEXT,
  expense_date DATE,
  description TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  receipt_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.category,
    e.amount,
    e.currency,
    e.expense_date,
    e.description,
    e.status,
    e.submitted_at,
    e.approved_at,
    e.receipt_url
  FROM finance_expenses e
  WHERE e.employee_id = p_employee_id
    AND (p_start_date IS NULL OR e.expense_date >= p_start_date)
    AND (p_end_date IS NULL OR e.expense_date <= p_end_date)
    AND (p_status IS NULL OR e.status = p_status)
  ORDER BY e.expense_date DESC, e.submitted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get pending approvals for a manager
CREATE OR REPLACE FUNCTION get_pending_expense_approvals(
  p_approver_id UUID
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  employee_name TEXT,
  category TEXT,
  amount DECIMAL,
  currency TEXT,
  expense_date DATE,
  description TEXT,
  receipt_url TEXT,
  submitted_at TIMESTAMPTZ,
  days_pending INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_id,
    p.full_name as employee_name,
    e.category,
    e.amount,
    e.currency,
    e.expense_date,
    e.description,
    e.receipt_url,
    e.submitted_at,
    EXTRACT(DAY FROM NOW() - e.submitted_at)::INTEGER as days_pending
  FROM finance_expenses e
  JOIN profiles p ON p.id = e.employee_id
  WHERE e.status IN ('submitted', 'pending_approval')
  ORDER BY e.submitted_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate expense totals by category
CREATE OR REPLACE FUNCTION get_expense_totals_by_category(
  p_start_date DATE,
  p_end_date DATE,
  p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total_amount DECIMAL,
  expense_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.category,
    SUM(e.amount) as total_amount,
    COUNT(*)::BIGINT as expense_count
  FROM finance_expenses e
  WHERE e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date
    AND e.status IN ('approved', 'reimbursed')
    AND (p_employee_id IS NULL OR e.employee_id = p_employee_id)
  GROUP BY e.category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE finance_expenses IS 'Stores employee expense submissions with approval workflow tracking';
COMMENT ON COLUMN finance_expenses.employee_id IS 'Reference to the employee who submitted the expense';
COMMENT ON COLUMN finance_expenses.category IS 'Expense category (travel, meals, supplies, etc.)';
COMMENT ON COLUMN finance_expenses.amount IS 'Expense amount in specified currency';
COMMENT ON COLUMN finance_expenses.status IS 'Current status: submitted, pending_approval, approved, rejected, reimbursed';
COMMENT ON COLUMN finance_expenses.approval_chain IS 'JSON array tracking approval workflow history';
COMMENT ON COLUMN finance_expenses.policy_violations IS 'JSON array of detected policy violations';
COMMENT ON COLUMN finance_expenses.receipt_vault_id IS 'Link to receipt in receipt vault for audit trail';
