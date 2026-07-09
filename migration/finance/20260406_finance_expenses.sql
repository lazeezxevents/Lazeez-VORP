-- =====================================================
-- Finance Expenses Table Migration
-- =====================================================
-- Creates the finance_expenses table for employee expense management
-- including submission, approval workflows, and reimbursement tracking
--
-- Requirements: 9.1, 9.2
-- =====================================================

-- =====================================================
-- 1. Finance Expenses Table
-- =====================================================
-- Stores employee expense submissions with approval workflow and reimbursement tracking

CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Employee and Basic Info
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'PKR',
  expense_date DATE NOT NULL,
  description TEXT,
  
  -- Receipt and Documentation
  receipt_vault_id UUID REFERENCES finance_receipt_vault(id) ON DELETE SET NULL,
  
  -- Status Tracking
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending_approval', 'approved', 'rejected', 'reimbursed')),
  
  -- Submission Tracking
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Approval Tracking
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Rejection Tracking
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  
  -- Reimbursement Tracking
  reimbursed_at TIMESTAMPTZ,
  reimbursement_transaction_id TEXT,
  
  -- Optional Associations
  project_id UUID,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  
  -- Policy and Workflow
  policy_violation_flags JSONB,
  approval_chain JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_approved_requires_approver CHECK (
    (approved_at IS NULL AND approved_by IS NULL) OR
    (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  ),
  CONSTRAINT check_rejected_requires_details CHECK (
    (rejected_at IS NULL AND rejected_by IS NULL AND rejection_reason IS NULL) OR
    (rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND rejection_reason IS NOT NULL)
  )
);

-- =====================================================
-- 2. Indexes for Performance
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_finance_expenses_employee ON finance_expenses(employee_id);
CREATE INDEX idx_finance_expenses_status ON finance_expenses(status);
CREATE INDEX idx_finance_expenses_expense_date ON finance_expenses(expense_date);

-- Composite indexes for common queries
CREATE INDEX idx_finance_expenses_employee_status ON finance_expenses(employee_id, status);

-- Approval and workflow indexes
CREATE INDEX idx_finance_expenses_approved_by ON finance_expenses(approved_by);
CREATE INDEX idx_finance_expenses_submitted_at ON finance_expenses(submitted_at);

-- Optional association indexes
CREATE INDEX idx_finance_expenses_project ON finance_expenses(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_finance_expenses_vendor ON finance_expenses(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_finance_expenses_receipt ON finance_expenses(receipt_vault_id) WHERE receipt_vault_id IS NOT NULL;

-- =====================================================
-- 3. Updated Timestamp Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_finance_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER finance_expenses_updated_at
  BEFORE UPDATE ON finance_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_expenses_updated_at();

-- =====================================================
-- 4. RLS Policies
-- =====================================================

ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;

-- Employees can view their own expenses
CREATE POLICY "Employees can view own expenses"
  ON finance_expenses
  FOR SELECT
  USING (employee_id = auth.uid());

-- Managers can view expenses from their department
CREATE POLICY "Managers can view department expenses"
  ON finance_expenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND p.main_role IN ('manager', 'admin')
        AND (
          -- Manager can see expenses from employees in their department
          employee_id IN (
            SELECT e.id FROM profiles e
            WHERE e.department_id = p.department_id
          )
          OR p.main_role = 'admin'
        )
    )
  );

-- Finance admins can view all expenses
CREATE POLICY "Finance admins can view all expenses"
  ON finance_expenses
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

-- Approvers can view expenses pending their approval
CREATE POLICY "Approvers can view pending expenses"
  ON finance_expenses
  FOR SELECT
  USING (
    status = 'pending_approval'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.main_role IN ('manager', 'admin')
    )
  );

-- Employees can submit expenses
CREATE POLICY "Employees can submit expenses"
  ON finance_expenses
  FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
    AND status = 'submitted'
  );

-- Employees can update their own draft/submitted expenses
CREATE POLICY "Employees can update own submitted expenses"
  ON finance_expenses
  FOR UPDATE
  USING (
    employee_id = auth.uid()
    AND status IN ('submitted', 'pending_approval')
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND status IN ('submitted', 'pending_approval')
  );

-- Approvers can approve/reject expenses
CREATE POLICY "Approvers can approve or reject expenses"
  ON finance_expenses
  FOR UPDATE
  USING (
    status IN ('submitted', 'pending_approval')
    AND EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role IN ('manager', 'admin')
          OR (cr.permissions->'finance'->>'manage' = 'true')
        )
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected', 'pending_approval')
  );

-- Finance admins can process reimbursements
CREATE POLICY "Finance admins can process reimbursements"
  ON finance_expenses
  FOR UPDATE
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN role_assignments ra ON ra.user_id = p.id
      LEFT JOIN custom_roles cr ON cr.id = ra.role_id
      WHERE p.id = auth.uid()
        AND (
          p.main_role = 'admin'
          OR (cr.permissions->'finance'->>'manage_payments' = 'true')
        )
    )
  )
  WITH CHECK (
    status = 'reimbursed'
  );

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function to approve expense
CREATE OR REPLACE FUNCTION approve_expense(
  p_expense_id UUID,
  p_approver_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expense RECORD;
  v_approval_entry JSONB;
BEGIN
  -- Get expense details
  SELECT * INTO v_expense
  FROM finance_expenses
  WHERE id = p_expense_id
    AND status IN ('submitted', 'pending_approval');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found or not in approvable status';
  END IF;
  
  -- Create approval entry for chain
  v_approval_entry := jsonb_build_object(
    'approver_id', p_approver_id,
    'approved_at', NOW(),
    'notes', p_notes,
    'action', 'approved'
  );
  
  -- Update expense
  UPDATE finance_expenses
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_approver_id,
    approval_chain = COALESCE(approval_chain, '[]'::jsonb) || v_approval_entry,
    updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject expense
CREATE OR REPLACE FUNCTION reject_expense(
  p_expense_id UUID,
  p_rejector_id UUID,
  p_rejection_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expense RECORD;
  v_rejection_entry JSONB;
BEGIN
  -- Validate rejection reason
  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Get expense details
  SELECT * INTO v_expense
  FROM finance_expenses
  WHERE id = p_expense_id
    AND status IN ('submitted', 'pending_approval');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found or not in rejectable status';
  END IF;
  
  -- Create rejection entry for chain
  v_rejection_entry := jsonb_build_object(
    'rejector_id', p_rejector_id,
    'rejected_at', NOW(),
    'reason', p_rejection_reason,
    'action', 'rejected'
  );
  
  -- Update expense
  UPDATE finance_expenses
  SET 
    status = 'rejected',
    rejected_at = NOW(),
    rejected_by = p_rejector_id,
    rejection_reason = p_rejection_reason,
    approval_chain = COALESCE(approval_chain, '[]'::jsonb) || v_rejection_entry,
    updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process reimbursement
CREATE OR REPLACE FUNCTION process_reimbursement(
  p_expense_id UUID,
  p_transaction_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expense RECORD;
BEGIN
  -- Get expense details
  SELECT * INTO v_expense
  FROM finance_expenses
  WHERE id = p_expense_id
    AND status = 'approved';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found or not in approved status';
  END IF;
  
  -- Update expense
  UPDATE finance_expenses
  SET 
    status = 'reimbursed',
    reimbursed_at = NOW(),
    reimbursement_transaction_id = p_transaction_id,
    updated_at = NOW()
  WHERE id = p_expense_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get expense summary by employee
CREATE OR REPLACE FUNCTION get_employee_expense_summary(
  p_employee_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_submitted NUMERIC,
  total_approved NUMERIC,
  total_rejected NUMERIC,
  total_reimbursed NUMERIC,
  pending_count INTEGER,
  approved_count INTEGER,
  rejected_count INTEGER,
  reimbursed_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status = 'submitted' THEN amount ELSE 0 END), 0) as total_submitted,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_approved,
    COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as total_rejected,
    COALESCE(SUM(CASE WHEN status = 'reimbursed' THEN amount ELSE 0 END), 0) as total_reimbursed,
    COUNT(CASE WHEN status IN ('submitted', 'pending_approval') THEN 1 END)::INTEGER as pending_count,
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER as approved_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END)::INTEGER as rejected_count,
    COUNT(CASE WHEN status = 'reimbursed' THEN 1 END)::INTEGER as reimbursed_count
  FROM finance_expenses
  WHERE employee_id = p_employee_id
    AND (p_start_date IS NULL OR expense_date >= p_start_date)
    AND (p_end_date IS NULL OR expense_date <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Views for Reporting
-- =====================================================

-- View for expense summary with employee details
CREATE OR REPLACE VIEW finance_expense_summary AS
SELECT 
  e.id,
  e.employee_id,
  p.full_name as employee_name,
  p.department_id,
  e.category,
  e.amount,
  e.currency,
  e.expense_date,
  e.description,
  e.status,
  e.submitted_at,
  e.approved_at,
  e.approved_by,
  ap.full_name as approver_name,
  e.rejected_at,
  e.rejected_by,
  rp.full_name as rejector_name,
  e.rejection_reason,
  e.reimbursed_at,
  e.reimbursement_transaction_id,
  e.receipt_vault_id,
  e.project_id,
  e.vendor_id,
  e.created_at,
  e.updated_at
FROM finance_expenses e
LEFT JOIN profiles p ON e.employee_id = p.id
LEFT JOIN profiles ap ON e.approved_by = ap.id
LEFT JOIN profiles rp ON e.rejected_by = rp.id;

-- =====================================================
-- 7. Comments for Documentation
-- =====================================================

COMMENT ON TABLE finance_expenses IS 'Employee expense submissions with approval workflow and reimbursement tracking';
COMMENT ON COLUMN finance_expenses.employee_id IS 'Employee who submitted the expense';
COMMENT ON COLUMN finance_expenses.category IS 'Expense category (travel, meals, supplies, etc.)';
COMMENT ON COLUMN finance_expenses.amount IS 'Expense amount (must be positive)';
COMMENT ON COLUMN finance_expenses.status IS 'Current status: submitted, pending_approval, approved, rejected, reimbursed';
COMMENT ON COLUMN finance_expenses.receipt_vault_id IS 'Link to receipt in receipt vault for audit trail';
COMMENT ON COLUMN finance_expenses.approval_chain IS 'JSONB array tracking approval workflow history';
COMMENT ON COLUMN finance_expenses.policy_violation_flags IS 'JSONB object flagging any policy violations';

COMMENT ON FUNCTION approve_expense(UUID, UUID, TEXT) IS 'Approves an expense and updates approval chain';
COMMENT ON FUNCTION reject_expense(UUID, UUID, TEXT) IS 'Rejects an expense with required reason';
COMMENT ON FUNCTION process_reimbursement(UUID, TEXT) IS 'Processes reimbursement for approved expense';
COMMENT ON FUNCTION get_employee_expense_summary(UUID, DATE, DATE) IS 'Returns expense summary statistics for an employee';

COMMENT ON VIEW finance_expense_summary IS 'Expense summary with employee and approver details for reporting';
