-- Create finance_budgets table
CREATE TABLE IF NOT EXISTS finance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period VARCHAR(50) NOT NULL, -- 'annual', 'quarterly', 'monthly'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount >= 0),
  allocated_amount DECIMAL(15, 2) DEFAULT 0 CHECK (allocated_amount >= 0),
  spent_amount DECIMAL(15, 2) DEFAULT 0 CHECK (spent_amount >= 0),
  remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - spent_amount) STORED,
  utilization_percent DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_amount > 0 THEN (spent_amount / total_amount * 100)
      ELSE 0
    END
  ) STORED,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'revised')),
  alert_threshold_75 BOOLEAN DEFAULT false,
  alert_threshold_90 BOOLEAN DEFAULT false,
  alert_threshold_100 BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create finance_budget_allocations table
CREATE TABLE IF NOT EXISTS finance_budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES finance_budgets(id) ON DELETE CASCADE,
  category VARCHAR(255) NOT NULL,
  allocated_amount DECIMAL(15, 2) NOT NULL CHECK (allocated_amount >= 0),
  spent_amount DECIMAL(15, 2) DEFAULT 0 CHECK (spent_amount >= 0),
  remaining_amount DECIMAL(15, 2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
  utilization_percent DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN allocated_amount > 0 THEN (spent_amount / allocated_amount * 100)
      ELSE 0
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create finance_budget_revisions table for tracking changes
CREATE TABLE IF NOT EXISTS finance_budget_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES finance_budgets(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  previous_amount DECIMAL(15, 2) NOT NULL,
  new_amount DECIMAL(15, 2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_finance_budgets_fiscal_year ON finance_budgets(fiscal_year);
CREATE INDEX idx_finance_budgets_department ON finance_budgets(department_id);
CREATE INDEX idx_finance_budgets_status ON finance_budgets(status);
CREATE INDEX idx_finance_budgets_dates ON finance_budgets(start_date, end_date);
CREATE INDEX idx_finance_budget_allocations_budget ON finance_budget_allocations(budget_id);
CREATE INDEX idx_finance_budget_allocations_category ON finance_budget_allocations(category);
CREATE INDEX idx_finance_budget_revisions_budget ON finance_budget_revisions(budget_id);

-- Create function to update budget spent amount when expenses are recorded
CREATE OR REPLACE FUNCTION update_budget_spending()
RETURNS TRIGGER AS $$
BEGIN
  -- Update budget allocation spent amount
  UPDATE finance_budget_allocations
  SET 
    spent_amount = spent_amount + NEW.amount,
    updated_at = NOW()
  WHERE 
    budget_id IN (
      SELECT id FROM finance_budgets 
      WHERE status = 'active' 
      AND start_date <= NEW.expense_date 
      AND end_date >= NEW.expense_date
      AND (department_id = NEW.department_id OR department_id IS NULL)
    )
    AND category = NEW.category;

  -- Update parent budget spent amount
  UPDATE finance_budgets
  SET 
    spent_amount = spent_amount + NEW.amount,
    updated_at = NOW()
  WHERE 
    status = 'active'
    AND start_date <= NEW.expense_date
    AND end_date >= NEW.expense_date
    AND (department_id = NEW.department_id OR department_id IS NULL);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expense recording
CREATE TRIGGER trigger_update_budget_spending
AFTER INSERT ON finance_expenses
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION update_budget_spending();

-- Create function to check budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check 75% threshold
  IF NEW.utilization_percent >= 75 AND OLD.alert_threshold_75 = false THEN
    NEW.alert_threshold_75 = true;
    -- Trigger notification (would integrate with notification system)
  END IF;

  -- Check 90% threshold
  IF NEW.utilization_percent >= 90 AND OLD.alert_threshold_90 = false THEN
    NEW.alert_threshold_90 = true;
    -- Trigger notification
  END IF;

  -- Check 100% threshold
  IF NEW.utilization_percent >= 100 AND OLD.alert_threshold_100 = false THEN
    NEW.alert_threshold_100 = true;
    -- Trigger notification
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for budget alerts
CREATE TRIGGER trigger_check_budget_alerts
BEFORE UPDATE ON finance_budgets
FOR EACH ROW
WHEN (OLD.spent_amount IS DISTINCT FROM NEW.spent_amount)
EXECUTE FUNCTION check_budget_alerts();

-- Add RLS policies
ALTER TABLE finance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_budget_revisions ENABLE ROW LEVEL SECURITY;

-- Finance admins can do everything
CREATE POLICY finance_budgets_admin_all ON finance_budgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY finance_budget_allocations_admin_all ON finance_budget_allocations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin')
    )
  );

CREATE POLICY finance_budget_revisions_admin_all ON finance_budget_revisions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin')
    )
  );

-- Department managers can view their department budgets
CREATE POLICY finance_budgets_manager_view ON finance_budgets
  FOR SELECT
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
      AND main_role = 'manager'
    )
  );

-- Employees can view budgets for their department
CREATE POLICY finance_budgets_employee_view ON finance_budgets
  FOR SELECT
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE finance_budgets IS 'Stores budget information for fiscal periods';
COMMENT ON TABLE finance_budget_allocations IS 'Stores budget allocations by category';
COMMENT ON TABLE finance_budget_revisions IS 'Tracks budget revision history';
COMMENT ON COLUMN finance_budgets.utilization_percent IS 'Automatically calculated as (spent / total) * 100';
COMMENT ON COLUMN finance_budgets.remaining_amount IS 'Automatically calculated as total - spent';
