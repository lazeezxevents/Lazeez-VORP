-- Finance Module: Row-Level Security Policies
-- Comprehensive RLS policies for all finance tables
-- Requirement: 26.9 - Security hardening

-- ============================================================================
-- PRE-FLIGHT CHECKS & HARDENING
-- ============================================================================

-- Ensure vendors table has user_id for RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'user_id') THEN
            ALTER TABLE public.vendors ADD COLUMN user_id UUID REFERENCES auth.users(id);
            RAISE NOTICE 'Added missing user_id column to vendors table';
        END IF;
    END IF;
END $$;

-- Enable RLS on all finance tables (safely)
DO $$ 
DECLARE
    t_name TEXT;
    tables_to_enable TEXT[] := ARRAY[
        'finance_accounts', 'finance_journal_entries', 'finance_ledger_entries', 
        'finance_transactions', 'finance_audit_log', 'finance_vendor_profiles', 
        'finance_order_data', 'finance_delivery_data', 'finance_invoices', 
        'finance_invoice_line_items', 'finance_expenses', 'finance_receipt_vault', 
        'finance_budgets', 'finance_budget_allocations', 'finance_forecasts', 
        'finance_anomalies', 'finance_tax_jurisdictions', 'finance_tax_calculations', 
        'finance_compliance_audit_trail', 'finance_fraud_rules', 'finance_fraud_alerts'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables_to_enable
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t_name) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t_name);
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping RLS enablement', t_name;
        END IF;
    END LOOP;
END $$;

-- Helper function to check if user has finance role
CREATE OR REPLACE FUNCTION has_finance_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN role_assignments ra ON ra.user_id = p.id
    LEFT JOIN custom_roles cr ON cr.id = ra.role_id
    WHERE p.id = auth.uid()
    AND (
      p.main_role = 'admin'
      OR cr.permissions->>'finance' IS NOT NULL
      OR p.main_role = required_role
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is finance admin
CREATE OR REPLACE FUNCTION is_finance_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user owns the record
CREATE OR REPLACE FUNCTION is_record_owner(owner_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CHART OF ACCOUNTS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_accounts') THEN
    DROP POLICY IF EXISTS "finance_accounts_admin_all" ON finance_accounts;
    CREATE POLICY "finance_accounts_admin_all" ON finance_accounts FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_accounts_staff_select" ON finance_accounts;
    CREATE POLICY "finance_accounts_staff_select" ON finance_accounts FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- JOURNAL ENTRIES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_journal_entries') THEN
    DROP POLICY IF EXISTS "finance_journal_entries_admin_all" ON finance_journal_entries;
    CREATE POLICY "finance_journal_entries_admin_all" ON finance_journal_entries FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_journal_entries_staff_select" ON finance_journal_entries;
    CREATE POLICY "finance_journal_entries_staff_select" ON finance_journal_entries FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_journal_entries_staff_insert" ON finance_journal_entries;
    CREATE POLICY "finance_journal_entries_staff_insert" ON finance_journal_entries FOR INSERT TO authenticated WITH CHECK (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- LEDGER ENTRIES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_ledger_entries') THEN
    DROP POLICY IF EXISTS "finance_ledger_entries_admin_all" ON finance_ledger_entries;
    CREATE POLICY "finance_ledger_entries_admin_all" ON finance_ledger_entries FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_ledger_entries_staff_select" ON finance_ledger_entries;
    CREATE POLICY "finance_ledger_entries_staff_select" ON finance_ledger_entries FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- TRANSACTIONS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_transactions') THEN
    DROP POLICY IF EXISTS "finance_transactions_admin_all" ON finance_transactions;
    CREATE POLICY "finance_transactions_admin_all" ON finance_transactions FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_transactions_staff_select" ON finance_transactions;
    CREATE POLICY "finance_transactions_staff_select" ON finance_transactions FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_transactions_staff_insert" ON finance_transactions;
    CREATE POLICY "finance_transactions_staff_insert" ON finance_transactions FOR INSERT TO authenticated WITH CHECK (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- AUDIT LOG POLICIES (Read-only for most users)
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_audit_log') THEN
    DROP POLICY IF EXISTS "finance_audit_log_admin_select" ON finance_audit_log;
    CREATE POLICY "finance_audit_log_admin_select" ON finance_audit_log FOR SELECT TO authenticated USING (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_audit_log_system_insert" ON finance_audit_log;
    CREATE POLICY "finance_audit_log_system_insert" ON finance_audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- VENDOR PROFILES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_vendor_profiles') THEN
    DROP POLICY IF EXISTS "finance_vendor_profiles_admin_all" ON finance_vendor_profiles;
    CREATE POLICY "finance_vendor_profiles_admin_all" ON finance_vendor_profiles FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_vendor_profiles_staff_select" ON finance_vendor_profiles;
    CREATE POLICY "finance_vendor_profiles_staff_select" ON finance_vendor_profiles FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_vendor_profiles_staff_update" ON finance_vendor_profiles;
    CREATE POLICY "finance_vendor_profiles_staff_update" ON finance_vendor_profiles FOR UPDATE TO authenticated USING (has_finance_role('staff')) WITH CHECK (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_vendor_profiles_vendor_select" ON finance_vendor_profiles;
    CREATE POLICY "finance_vendor_profiles_vendor_select" ON finance_vendor_profiles FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM vendors
        WHERE vendors.id = finance_vendor_profiles.vendor_id
        AND (vendors.user_id = auth.uid() OR vendors.created_by = auth.uid())
      )
    );
  END IF;
END $$;

-- ============================================================================
-- ORDER DATA POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_order_data') THEN
    DROP POLICY IF EXISTS "finance_order_data_admin_all" ON finance_order_data;
    CREATE POLICY "finance_order_data_admin_all" ON finance_order_data FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_order_data_staff_select" ON finance_order_data;
    CREATE POLICY "finance_order_data_staff_select" ON finance_order_data FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_order_data_vendor_select" ON finance_order_data;
    CREATE POLICY "finance_order_data_vendor_select" ON finance_order_data FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM vendors
        WHERE vendors.id = finance_order_data.vendor_id
        AND (vendors.user_id = auth.uid() OR vendors.created_by = auth.uid())
      )
    );
  END IF;
END $$;

-- ============================================================================
-- DELIVERY DATA POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_delivery_data') THEN
    DROP POLICY IF EXISTS "finance_delivery_data_admin_all" ON finance_delivery_data;
    CREATE POLICY "finance_delivery_data_admin_all" ON finance_delivery_data FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_delivery_data_staff_select" ON finance_delivery_data;
    CREATE POLICY "finance_delivery_data_staff_select" ON finance_delivery_data FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- INVOICES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_invoices') THEN
    DROP POLICY IF EXISTS "finance_invoices_admin_all" ON finance_invoices;
    CREATE POLICY "finance_invoices_admin_all" ON finance_invoices FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_invoices_staff_select" ON finance_invoices;
    CREATE POLICY "finance_invoices_staff_select" ON finance_invoices FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_invoices_staff_insert" ON finance_invoices;
    CREATE POLICY "finance_invoices_staff_insert" ON finance_invoices FOR INSERT TO authenticated WITH CHECK (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_invoices_vendor_select" ON finance_invoices;
    CREATE POLICY "finance_invoices_vendor_select" ON finance_invoices FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM vendors
        WHERE vendors.id = finance_invoices.vendor_id
        AND (vendors.user_id = auth.uid() OR vendors.created_by = auth.uid())
      )
    );
  END IF;
END $$;

-- ============================================================================
-- INVOICE LINE ITEMS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_invoice_line_items') THEN
    DROP POLICY IF EXISTS "finance_invoice_line_items_admin_all" ON finance_invoice_line_items;
    CREATE POLICY "finance_invoice_line_items_admin_all" ON finance_invoice_line_items FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_invoice_line_items_staff_select" ON finance_invoice_line_items;
    CREATE POLICY "finance_invoice_line_items_staff_select" ON finance_invoice_line_items FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_invoice_line_items_staff_insert" ON finance_invoice_line_items;
    CREATE POLICY "finance_invoice_line_items_staff_insert" ON finance_invoice_line_items FOR INSERT TO authenticated WITH CHECK (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_invoice_line_items_vendor_select" ON finance_invoice_line_items;
    CREATE POLICY "finance_invoice_line_items_vendor_select" ON finance_invoice_line_items FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM finance_invoices fi
        JOIN vendors v ON v.id = fi.vendor_id
        WHERE fi.id = finance_invoice_line_items.invoice_id
        AND (v.user_id = auth.uid() OR v.created_by = auth.uid())
      )
    );
  END IF;
END $$;

-- ============================================================================
-- EXPENSES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_expenses') THEN
    DROP POLICY IF EXISTS "finance_expenses_admin_all" ON finance_expenses;
    CREATE POLICY "finance_expenses_admin_all" ON finance_expenses FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_expenses_staff_select" ON finance_expenses;
    CREATE POLICY "finance_expenses_staff_select" ON finance_expenses FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_expenses_staff_update" ON finance_expenses;
    CREATE POLICY "finance_expenses_staff_update" ON finance_expenses FOR UPDATE TO authenticated USING (has_finance_role('staff')) WITH CHECK (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_expenses_employee_select" ON finance_expenses;
    CREATE POLICY "finance_expenses_employee_select" ON finance_expenses FOR SELECT TO authenticated USING (is_record_owner(employee_id));
    
    DROP POLICY IF EXISTS "finance_expenses_employee_insert" ON finance_expenses;
    CREATE POLICY "finance_expenses_employee_insert" ON finance_expenses FOR INSERT TO authenticated WITH CHECK (is_record_owner(employee_id));
    
    DROP POLICY IF EXISTS "finance_expenses_employee_update" ON finance_expenses;
    CREATE POLICY "finance_expenses_employee_update" ON finance_expenses FOR UPDATE TO authenticated USING (is_record_owner(employee_id) AND status = 'draft') WITH CHECK (is_record_owner(employee_id) AND status = 'draft');
  END IF;
END $$;

-- ============================================================================
-- RECEIPT VAULT POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_receipt_vault') THEN
    DROP POLICY IF EXISTS "finance_receipt_vault_admin_all" ON finance_receipt_vault;
    CREATE POLICY "finance_receipt_vault_admin_all" ON finance_receipt_vault FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_receipt_vault_staff_select" ON finance_receipt_vault;
    CREATE POLICY "finance_receipt_vault_staff_select" ON finance_receipt_vault FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_receipt_vault_user_select" ON finance_receipt_vault;
    CREATE POLICY "finance_receipt_vault_user_select" ON finance_receipt_vault FOR SELECT TO authenticated USING (is_record_owner(uploaded_by));
    
    DROP POLICY IF EXISTS "finance_receipt_vault_user_insert" ON finance_receipt_vault;
    CREATE POLICY "finance_receipt_vault_user_insert" ON finance_receipt_vault FOR INSERT TO authenticated WITH CHECK (is_record_owner(uploaded_by));
  END IF;
END $$;

-- ============================================================================
-- BUDGETS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_budgets') THEN
    DROP POLICY IF EXISTS "finance_budgets_admin_all" ON finance_budgets;
    CREATE POLICY "finance_budgets_admin_all" ON finance_budgets FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_budgets_staff_select" ON finance_budgets;
    CREATE POLICY "finance_budgets_staff_select" ON finance_budgets FOR SELECT TO authenticated USING (has_finance_role('staff'));
    
    DROP POLICY IF EXISTS "finance_budgets_manager_select" ON finance_budgets;
    CREATE POLICY "finance_budgets_manager_select" ON finance_budgets FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.main_role = 'manager'
        AND profiles.department_id = finance_budgets.department_id
      )
    );
  END IF;
END $$;

-- ============================================================================
-- BUDGET ALLOCATIONS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_budget_allocations') THEN
    DROP POLICY IF EXISTS "finance_budget_allocations_admin_all" ON finance_budget_allocations;
    CREATE POLICY "finance_budget_allocations_admin_all" ON finance_budget_allocations FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_budget_allocations_staff_select" ON finance_budget_allocations;
    CREATE POLICY "finance_budget_allocations_staff_select" ON finance_budget_allocations FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- FORECASTS POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_forecasts') THEN
    DROP POLICY IF EXISTS "finance_forecasts_admin_all" ON finance_forecasts;
    CREATE POLICY "finance_forecasts_admin_all" ON finance_forecasts FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_forecasts_staff_select" ON finance_forecasts;
    CREATE POLICY "finance_forecasts_staff_select" ON finance_forecasts FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- ANOMALIES POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_anomalies') THEN
    DROP POLICY IF EXISTS "finance_anomalies_admin_all" ON finance_anomalies;
    CREATE POLICY "finance_anomalies_admin_all" ON finance_anomalies FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_anomalies_staff_select" ON finance_anomalies;
    CREATE POLICY "finance_anomalies_staff_select" ON finance_anomalies FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- TAX POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_tax_jurisdictions') THEN
    DROP POLICY IF EXISTS "finance_tax_jurisdictions_admin_all" ON finance_tax_jurisdictions;
    CREATE POLICY "finance_tax_jurisdictions_admin_all" ON finance_tax_jurisdictions FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_tax_jurisdictions_staff_select" ON finance_tax_jurisdictions;
    CREATE POLICY "finance_tax_jurisdictions_staff_select" ON finance_tax_jurisdictions FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_tax_calculations') THEN
    DROP POLICY IF EXISTS "finance_tax_calculations_admin_all" ON finance_tax_calculations;
    CREATE POLICY "finance_tax_calculations_admin_all" ON finance_tax_calculations FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_tax_calculations_staff_select" ON finance_tax_calculations;
    CREATE POLICY "finance_tax_calculations_staff_select" ON finance_tax_calculations FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- COMPLIANCE AUDIT TRAIL POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_compliance_audit_trail') THEN
    DROP POLICY IF EXISTS "finance_compliance_audit_trail_admin_select" ON finance_compliance_audit_trail;
    CREATE POLICY "finance_compliance_audit_trail_admin_select" ON finance_compliance_audit_trail FOR SELECT TO authenticated USING (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_compliance_audit_trail_system_insert" ON finance_compliance_audit_trail;
    CREATE POLICY "finance_compliance_audit_trail_system_insert" ON finance_compliance_audit_trail FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- FRAUD DETECTION POLICIES
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_fraud_rules') THEN
    DROP POLICY IF EXISTS "finance_fraud_rules_admin_all" ON finance_fraud_rules;
    CREATE POLICY "finance_fraud_rules_admin_all" ON finance_fraud_rules FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_fraud_rules_staff_select" ON finance_fraud_rules;
    CREATE POLICY "finance_fraud_rules_staff_select" ON finance_fraud_rules FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finance_fraud_alerts') THEN
    DROP POLICY IF EXISTS "finance_fraud_alerts_admin_all" ON finance_fraud_alerts;
    CREATE POLICY "finance_fraud_alerts_admin_all" ON finance_fraud_alerts FOR ALL TO authenticated USING (is_finance_admin()) WITH CHECK (is_finance_admin());
    
    DROP POLICY IF EXISTS "finance_fraud_alerts_staff_select" ON finance_fraud_alerts;
    CREATE POLICY "finance_fraud_alerts_staff_select" ON finance_fraud_alerts FOR SELECT TO authenticated USING (has_finance_role('staff'));
  END IF;
END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on helper functions
GRANT EXECUTE ON FUNCTION has_finance_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_finance_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_record_owner(UUID) TO authenticated;

-- Create indexes for performance (safely)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_main_role') THEN
      CREATE INDEX idx_profiles_main_role ON profiles(main_role);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_department_id') THEN
      CREATE INDEX idx_profiles_department_id ON profiles(department_id);
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_vendors_user_id') THEN
      CREATE INDEX idx_vendors_user_id ON vendors(user_id);
    END IF;
  END IF;
END $$;

COMMENT ON FUNCTION has_finance_role IS 'Check if user has required finance role or is admin';
COMMENT ON FUNCTION is_finance_admin IS 'Check if user is finance admin';
COMMENT ON FUNCTION is_record_owner IS 'Check if user owns the record';
