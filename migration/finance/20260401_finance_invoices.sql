-- Migration: Finance Invoices and Invoice Line Items
-- Task 13.1: Create finance_invoices and finance_invoice_line_items tables
-- Requirements: 7.1, 7.2

-- Create finance_invoices table
CREATE TABLE IF NOT EXISTS finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  amount_due DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  currency VARCHAR(3) DEFAULT 'PKR',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create finance_invoice_line_items table
CREATE TABLE IF NOT EXISTS finance_invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES finance_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  amount DECIMAL(15, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON finance_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON finance_invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON finance_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON finance_invoice_line_items(invoice_id);

-- Enable Row Level Security
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for finance_invoices
-- Admin and finance users can view all invoices
CREATE POLICY "Finance users can view all invoices"
  ON finance_invoices FOR SELECT
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

-- Admin and finance users can insert invoices
CREATE POLICY "Finance users can insert invoices"
  ON finance_invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- Admin and finance users can update invoices
CREATE POLICY "Finance users can update invoices"
  ON finance_invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- Admin can delete invoices
CREATE POLICY "Admin can delete invoices"
  ON finance_invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.main_role = 'admin'
    )
  );

-- RLS Policies for finance_invoice_line_items
-- Finance users can view all line items
CREATE POLICY "Finance users can view all line items"
  ON finance_invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- Finance users can insert line items
CREATE POLICY "Finance users can insert line items"
  ON finance_invoice_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'finance_admin', 'finance_manager')
    )
  );

-- Finance users can update line items
CREATE POLICY "Finance users can update line items"
  ON finance_invoice_line_items FOR UPDATE
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

-- Admin can delete line items
CREATE POLICY "Admin can delete line items"
  ON finance_invoice_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.main_role = 'admin'
    )
  );

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  invoice_number VARCHAR(50);
BEGIN
  -- Get the next invoice number
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM finance_invoices
  WHERE invoice_number LIKE 'INV-%';
  
  -- Format as INV-XXXXXX
  invoice_number := 'INV-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status based on payment
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update amount_due
  NEW.amount_due := NEW.total_amount - NEW.amount_paid;
  
  -- Update status based on payment
  IF NEW.amount_paid >= NEW.total_amount THEN
    NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    -- Partial payment, keep current status unless it's draft
    IF NEW.status = 'draft' THEN
      NEW.status := 'sent';
    END IF;
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.status NOT IN ('paid', 'void') THEN
    NEW.status := 'overdue';
  END IF;
  
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice status
CREATE TRIGGER trigger_update_invoice_status
  BEFORE UPDATE ON finance_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status();

-- Function to check overdue invoices (can be called by cron job)
CREATE OR REPLACE FUNCTION check_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE finance_invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE due_date < CURRENT_DATE
    AND status IN ('sent', 'draft')
    AND amount_due > 0;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE finance_invoices IS 'Stores invoices for vendor subscriptions and services';
COMMENT ON TABLE finance_invoice_line_items IS 'Stores line items for each invoice';
COMMENT ON COLUMN finance_invoices.status IS 'Invoice status: draft, sent, paid, overdue, void';
COMMENT ON COLUMN finance_invoices.amount_due IS 'Calculated as total_amount - amount_paid';
COMMENT ON FUNCTION generate_invoice_number() IS 'Generates sequential invoice numbers in format INV-XXXXXX';
COMMENT ON FUNCTION update_invoice_status() IS 'Automatically updates invoice status based on payment and due date';
COMMENT ON FUNCTION check_overdue_invoices() IS 'Marks invoices as overdue when past due date';
