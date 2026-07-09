-- Finance Receipt Vault Table Migration
-- Task 20.1: Create finance_receipt_vault table
-- Requirements: 10.1, 10.2

-- Create finance_receipt_vault table
CREATE TABLE IF NOT EXISTS finance_receipt_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL CHECK (category IN ('riders', 'vendors', 'general')),
  subcategory TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Extracted data from OCR + AI
  extracted_data JSONB DEFAULT '{}'::jsonb,
  confidence_score DECIMAL(5, 2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Asset classification tags
  asset_type TEXT CHECK (asset_type IN ('tangible', 'intangible', NULL)),
  asset_class TEXT CHECK (asset_class IN ('fixed', 'current', NULL)),
  accounting_category TEXT CHECK (accounting_category IN ('asset', 'liability', 'equity', 'income', 'expense', NULL)),
  depreciable BOOLEAN DEFAULT false,
  useful_life INTEGER CHECK (useful_life > 0),
  
  -- Linking to other entities
  linked_entity_type TEXT CHECK (linked_entity_type IN ('transaction', 'expense', 'delivery', 'order', NULL)),
  linked_entity_id UUID,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'verified', 'failed')),
  processing_error TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_receipt_vault_uploaded_by ON finance_receipt_vault(uploaded_by);
CREATE INDEX idx_receipt_vault_category ON finance_receipt_vault(category);
CREATE INDEX idx_receipt_vault_uploaded_at ON finance_receipt_vault(uploaded_at);
CREATE INDEX idx_receipt_vault_status ON finance_receipt_vault(status);
CREATE INDEX idx_receipt_vault_linked_entity ON finance_receipt_vault(linked_entity_type, linked_entity_id);
CREATE INDEX idx_receipt_vault_tags ON finance_receipt_vault USING GIN(tags);

-- Create composite index for common queries
CREATE INDEX idx_receipt_vault_category_status ON finance_receipt_vault(category, status);
CREATE INDEX idx_receipt_vault_uploaded_by_category ON finance_receipt_vault(uploaded_by, category);

-- Create full-text search index on extracted data
CREATE INDEX idx_receipt_vault_extracted_data ON finance_receipt_vault USING GIN(extracted_data);

-- Enable Row Level Security
ALTER TABLE finance_receipt_vault ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own receipts
CREATE POLICY "Users can view own receipts"
  ON finance_receipt_vault
  FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR
    -- Finance team can view all receipts
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager', 'accountant')
    )
    OR
    -- Managers can view receipts from their team
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.manager_id = p1.id
      WHERE p1.id = auth.uid()
      AND p2.id = finance_receipt_vault.uploaded_by
    )
  );

-- RLS Policy: Users can insert their own receipts
CREATE POLICY "Users can upload receipts"
  ON finance_receipt_vault
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
  );

-- RLS Policy: Users can update their own pending receipts
CREATE POLICY "Users can update own pending receipts"
  ON finance_receipt_vault
  FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    AND status = 'pending'
  );

-- RLS Policy: Finance team can update any receipt
CREATE POLICY "Finance team can update receipts"
  ON finance_receipt_vault
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager', 'accountant')
    )
  );

-- RLS Policy: Users can delete their own pending receipts
CREATE POLICY "Users can delete own pending receipts"
  ON finance_receipt_vault
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND status = 'pending'
  );

-- Create updated_at trigger
CREATE TRIGGER update_receipt_vault_updated_at
  BEFORE UPDATE ON finance_receipt_vault
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create audit log trigger for receipt changes
CREATE OR REPLACE FUNCTION log_receipt_vault_changes()
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
      'receipt',
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
      'receipt',
      NEW.id,
      'create',
      NULL,
      to_jsonb(NEW),
      auth.uid(),
      NOW()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO finance_audit_log (
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at
    ) VALUES (
      'receipt',
      OLD.id,
      'delete',
      to_jsonb(OLD),
      NULL,
      auth.uid(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER receipt_vault_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON finance_receipt_vault
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_vault_changes();

-- Create function to search receipts
CREATE OR REPLACE FUNCTION search_receipts(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  file_name TEXT,
  file_url TEXT,
  category TEXT,
  tags TEXT[],
  uploaded_at TIMESTAMPTZ,
  status TEXT,
  confidence_score DECIMAL,
  extracted_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.file_name,
    r.file_url,
    r.category,
    r.tags,
    r.uploaded_at,
    r.status,
    r.confidence_score,
    r.extracted_data
  FROM finance_receipt_vault r
  WHERE r.uploaded_by = p_user_id
    AND (p_category IS NULL OR r.category = p_category)
    AND (p_tags IS NULL OR r.tags && p_tags)
    AND (p_start_date IS NULL OR r.uploaded_at::date >= p_start_date)
    AND (p_end_date IS NULL OR r.uploaded_at::date <= p_end_date)
    AND (p_status IS NULL OR r.status = p_status)
    AND (
      p_search_text IS NULL 
      OR r.file_name ILIKE '%' || p_search_text || '%'
      OR r.extracted_data::text ILIKE '%' || p_search_text || '%'
    )
  ORDER BY r.uploaded_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get receipts by category
CREATE OR REPLACE FUNCTION get_receipts_by_category(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  receipt_count BIGINT,
  total_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.category,
    COUNT(*)::BIGINT as receipt_count,
    COALESCE(
      SUM((r.extracted_data->>'total_amount')::DECIMAL),
      0
    ) as total_amount
  FROM finance_receipt_vault r
  WHERE r.uploaded_by = p_user_id
    AND r.status = 'processed'
    AND (p_start_date IS NULL OR r.uploaded_at::date >= p_start_date)
    AND (p_end_date IS NULL OR r.uploaded_at::date <= p_end_date)
  GROUP BY r.category
  ORDER BY receipt_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to link receipt to entity
CREATE OR REPLACE FUNCTION link_receipt_to_entity(
  p_receipt_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Update receipt with entity link
  UPDATE finance_receipt_vault
  SET
    linked_entity_type = p_entity_type,
    linked_entity_id = p_entity_id,
    updated_at = NOW()
  WHERE id = p_receipt_id
    AND (
      uploaded_by = v_user_id
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = v_user_id
        AND profiles.main_role IN ('admin', 'finance_admin', 'finance_manager')
      )
    );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update receipt status after processing
CREATE OR REPLACE FUNCTION update_receipt_processing_status(
  p_receipt_id UUID,
  p_status TEXT,
  p_extracted_data JSONB DEFAULT NULL,
  p_confidence_score DECIMAL DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE finance_receipt_vault
  SET
    status = p_status,
    extracted_data = COALESCE(p_extracted_data, extracted_data),
    confidence_score = COALESCE(p_confidence_score, confidence_score),
    processing_error = p_error,
    updated_at = NOW()
  WHERE id = p_receipt_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE finance_receipt_vault IS 'Centralized storage for financial receipts with AI-powered data extraction';
COMMENT ON COLUMN finance_receipt_vault.category IS 'Receipt category: riders, vendors, or general';
COMMENT ON COLUMN finance_receipt_vault.extracted_data IS 'JSON object containing OCR + AI extracted data (merchant, date, amount, items, etc.)';
COMMENT ON COLUMN finance_receipt_vault.confidence_score IS 'AI confidence score (0-100) for extracted data quality';
COMMENT ON COLUMN finance_receipt_vault.asset_type IS 'Asset classification: tangible or intangible';
COMMENT ON COLUMN finance_receipt_vault.asset_class IS 'Asset class: fixed or current';
COMMENT ON COLUMN finance_receipt_vault.linked_entity_type IS 'Type of linked entity: transaction, expense, delivery, or order';
COMMENT ON COLUMN finance_receipt_vault.linked_entity_id IS 'ID of the linked entity for audit trail';
COMMENT ON COLUMN finance_receipt_vault.status IS 'Processing status: pending, processed, verified, or failed';
