-- Migration: Finance Invoices and Invoice Line Items
-- Description: Create tables for invoice management system
-- Requirements: 7.1, 7.2
-- Date: 2026-04-03

-- =====================================================
-- INVOICES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE RESTRICT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(15, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid DECIMAL(15, 2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due DECIMAL(15, 2) NOT NULL CHECK (amount_due >= 0),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  currency VARCHAR(3) DEFAULT 'PKR',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure amount_due = total_amount - amount_paid
  CONSTRAINT check_amount_due CHECK (amount_due = total_amount - amount_paid),
  -- Ensure amount_paid <= total_amount
  CONSTRAINT check_amount_paid CHECK (amount_paid <= total_amount)
);

-- =====================================================
-- INVOICE LINE ITEMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES finance_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
  tax_rate DECIMAL(5, 2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure amount = quantity * unit_price
  CONSTRAINT check_line_amount CHECK (amount = quantity * unit_price)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Invoice indexes for performance
CREATE INDEX idx_finance_invoices_vendor ON finance_invoices(vendor_id);
CREATE INDEX idx_finance_invoices_status ON finance_invoices(status);
CREATE INDEX idx_finance_invoices_due_date ON finance_invoices(due_date);
CREATE INDEX idx_finance_invoices_issue_date ON finance_invoices(issue_date);
CREATE INDEX idx_finance_invoices_created_at ON finance_invoices(created_at);

-- Line items index
CREATE INDEX idx_finance_invoice_line_items_invoice ON finance_invoice_line_items(invoice_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate sequential invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  invoice_num VARCHAR(50);
BEGIN
  -- Get the next invoice number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM finance_invoices
  WHERE invoice_number LIKE 'INV-%';
  
  -- Format as INV-XXXXXX (6 digits with leading zeros)
  invoice_num := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status based on payment
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If fully paid, mark as paid
  IF NEW.amount_paid >= NEW.total_amount THEN
    NEW.status := 'paid';
  -- If overdue and not paid, mark as overdue
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_paid < NEW.total_amount AND NEW.status != 'void' THEN
    NEW.status := 'overdue';
  -- If partially paid and was draft, mark as sent
  ELSIF NEW.amount_paid > 0 AND OLD.status = 'draft' THEN
    NEW.status := 'sent';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check for overdue invoices
CREATE OR REPLACE FUNCTION check_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE finance_invoices
  SET status = 'overdue'
  WHERE due_date < CURRENT_DATE
    AND amount_paid < total_amount
    AND status IN ('draft', 'sent');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update invoice status on payment changes
CREATE TRIGGER trigger_update_invoice_status
  BEFORE UPDATE OF amount_paid ON finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- Trigger to update updated_at timestamp
CREATE TRIGGER trigger_finance_invoices_updated_at
  BEFORE UPDATE ON finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Finance admins and managers can view all invoices
CREATE POLICY "Finance staff can view all invoices"
  ON finance_invoices FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE role IN ('finance_admin', 'finance_manager', 'accountant')
    )
  );

-- Finance admins and accountants can create invoices
CREATE POLICY "Finance staff can create invoices"
  ON finance_invoices FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE role IN ('finance_admin', 'accountant')
    )
  );

-- Finance admins and accountants can update invoices
CREATE POLICY "Finance staff can update invoices"
  ON finance_invoices FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles 
      WHERE role IN ('finance_admin', 'accountant')
    )
  );

-- Vendors can view their own invoices
CREATE POLICY "Vendors can view own invoices"
  ON finance_invoices FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
  );

-- Line items inherit invoice permissions
CREATE POLICY "Finance staff can view line items"
  ON finance_invoice_line_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM finance_invoices
      WHERE auth.uid() IN (
        SELECT user_id FROM user_roles 
        WHERE role IN ('finance_admin', 'finance_manager', 'accountant')
      )
    )
  );

CREATE POLICY "Finance staff can manage line items"
  ON finance_invoice_line_items FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM finance_invoices
      WHERE auth.uid() IN (
        SELECT user_id FROM user_roles 
        WHERE role IN ('finance_admin', 'accountant')
      )
    )
  );

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for invoice summary with vendor details
CREATE OR REPLACE VIEW finance_invoice_summary AS
SELECT 
  i.id,
  i.invoice_number,
  i.vendor_id,
  v.name as vendor_name,
  i.issue_date,
  i.due_date,
  i.total_amount,
  i.amount_paid,
  i.amount_due,
  i.status,
  i.currency,
  CASE 
    WHEN i.status = 'paid' THEN 0
    WHEN i.due_date < CURRENT_DATE THEN CURRENT_DATE - i.due_date
    ELSE 0
  END as days_overdue,
  (SELECT COUNT(*) FROM finance_invoice_line_items WHERE invoice_id = i.id) as line_item_count,
  i.created_at,
  i.updated_at
FROM finance_invoices i
LEFT JOIN vendors v ON i.vendor_id = v.id;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE finance_invoices IS 'Stores invoice headers for subscription billing and services';
COMMENT ON TABLE finance_invoice_line_items IS 'Stores individual line items for each invoice';
COMMENT ON FUNCTION generate_invoice_number() IS 'Generates sequential invoice numbers in format INV-XXXXXX';
COMMENT ON FUNCTION update_invoice_status() IS 'Automatically updates invoice status based on payment and due date';
COMMENT ON FUNCTION check_overdue_invoices() IS 'Batch function to mark overdue invoices (run daily via cron)';
COMMENT ON VIEW finance_invoice_summary IS 'Provides invoice summary with vendor details and calculated fields';
