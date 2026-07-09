-- Migration: Add invoice -> journal posting support
-- Date: 2026-05-00

-- =====================================================
-- Add columns to link invoices to journal entries and posting metadata
-- =====================================================

ALTER TABLE IF EXISTS finance_invoices
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES finance_journal_entries(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS finance_invoices
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES auth.users(id) NULL;

-- Index for fast lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_finance_invoices_journal_entry'
  ) THEN
    CREATE INDEX idx_finance_invoices_journal_entry ON finance_invoices(journal_entry_id);
  END IF;
END$$;


-- =====================================================
-- Posting configuration table
-- =====================================================

CREATE TABLE IF NOT EXISTS finance_invoice_posting_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_type VARCHAR(50) NOT NULL,
  revenue_account_id UUID NOT NULL REFERENCES finance_accounts(id),
  ar_account_id UUID NOT NULL REFERENCES finance_accounts(id),
  tax_account_id UUID REFERENCES finance_accounts(id),
  auto_post_on_send BOOLEAN DEFAULT true,
  auto_post_on_payment BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invoice_type)
);

-- Seed a sensible default if accounts exist (no-op if already seeded)
INSERT INTO finance_invoice_posting_config (invoice_type, revenue_account_id, ar_account_id)
SELECT 'service', fa_revenue.id, fa_ar.id
FROM (
  SELECT id FROM finance_accounts WHERE code = '4100' LIMIT 1
) fa_revenue,
(
  SELECT id FROM finance_accounts WHERE code = '1120' LIMIT 1
) fa_ar
ON CONFLICT (invoice_type) DO NOTHING;


-- =====================================================
-- RPC: journalize_invoice
-- Creates journal entry + ledger entries for an invoice and posts it
-- =====================================================

CREATE OR REPLACE FUNCTION journalize_invoice(
  p_invoice_id UUID,
  p_posted_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_config RECORD;
  v_journal_entry_id UUID;
  v_entry_number VARCHAR;
BEGIN
  -- Load invoice
  SELECT * INTO v_invoice FROM finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.journal_entry_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice already posted');
  END IF;

  -- Load posting config
  SELECT * INTO v_config FROM finance_invoice_posting_config WHERE invoice_type = 'service' AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No posting configuration found');
  END IF;

  -- Generate entry number
  v_entry_number := generate_journal_entry_number();

  -- Create journal entry
  INSERT INTO finance_journal_entries (entry_number, entry_date, description, reference, status, created_by)
  VALUES (v_entry_number, v_invoice.issue_date::DATE, 'Invoice: ' || v_invoice.invoice_number, 'INV:' || v_invoice.invoice_number, 'draft', p_posted_by)
  RETURNING id INTO v_journal_entry_id;

  -- Create ledger entries: DR AR, CR Revenue
  INSERT INTO finance_ledger_entries (journal_entry_id, account_id, debit, credit, currency, description)
  VALUES
    (v_journal_entry_id, v_config.ar_account_id, v_invoice.total_amount, 0, COALESCE(v_invoice.currency,'PKR'), 'AR for Invoice ' || v_invoice.invoice_number),
    (v_journal_entry_id, v_config.revenue_account_id, 0, v_invoice.total_amount, COALESCE(v_invoice.currency,'PKR'), 'Revenue for Invoice ' || v_invoice.invoice_number);

  -- Post journal entry using existing atomic function
  PERFORM post_journal_entry(v_journal_entry_id, p_posted_by);

  -- Link invoice and mark posted
  UPDATE finance_invoices SET journal_entry_id = v_journal_entry_id, posted_at = NOW(), posted_by = p_posted_by WHERE id = p_invoice_id;

  -- Audit
  INSERT INTO finance_audit_log (entity_type, entity_id, action, new_values, changed_by)
  VALUES ('invoice', p_invoice_id, 'post_to_ledger', jsonb_build_object('journal_entry_id', v_journal_entry_id), p_posted_by);

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'journal_entry_id', v_journal_entry_id, 'entry_number', v_entry_number, 'amount_posted', v_invoice.total_amount);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- RPC: journalize_payment
-- Creates journal entry for a payment against an invoice and posts it
-- =====================================================

CREATE OR REPLACE FUNCTION journalize_payment(
  p_invoice_id UUID,
  p_payment_amount NUMERIC,
  p_payment_date DATE,
  p_posted_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_config RECORD;
  v_journal_entry_id UUID;
  v_entry_number VARCHAR;
BEGIN
  SELECT * INTO v_invoice FROM finance_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  SELECT * INTO v_config FROM finance_invoice_posting_config WHERE invoice_type = 'service' AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No posting configuration found');
  END IF;

  v_entry_number := generate_journal_entry_number();

  INSERT INTO finance_journal_entries (entry_number, entry_date, description, reference, status, created_by)
  VALUES (v_entry_number, p_payment_date, 'Payment for Invoice: ' || v_invoice.invoice_number, 'PAY:' || v_invoice.invoice_number, 'draft', p_posted_by)
  RETURNING id INTO v_journal_entry_id;

  -- DR Cash (1110) / CR AR (1120) using mapping if configured
  INSERT INTO finance_ledger_entries (journal_entry_id, account_id, debit, credit, currency, description)
  VALUES
    (v_journal_entry_id, (SELECT id FROM finance_accounts WHERE code = '1110' LIMIT 1), p_payment_amount, 0, COALESCE(v_invoice.currency,'PKR'), 'Cash received for ' || v_invoice.invoice_number),
    (v_journal_entry_id, v_config.ar_account_id, 0, p_payment_amount, COALESCE(v_invoice.currency,'PKR'), 'AR reduction for ' || v_invoice.invoice_number);

  PERFORM post_journal_entry(v_journal_entry_id, p_posted_by);

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'journal_entry_id', v_journal_entry_id, 'entry_number', v_entry_number, 'amount_posted', p_payment_amount);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
