-- Finance Module: Encryption Key Management
-- Store encryption key metadata (not actual keys)
-- Support key rotation for security

CREATE TABLE IF NOT EXISTS finance_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  algorithm TEXT NOT NULL DEFAULT 'AES-GCM',
  key_length INTEGER NOT NULL DEFAULT 256,
  notes TEXT
);

-- Index for active key lookup
CREATE INDEX idx_encryption_keys_active ON finance_encryption_keys(is_active, version DESC);

-- Enable RLS
ALTER TABLE finance_encryption_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view key metadata
CREATE POLICY "finance_encryption_keys_admin_select"
  ON finance_encryption_keys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can manage keys
CREATE POLICY "finance_encryption_keys_admin_all"
  ON finance_encryption_keys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert initial key version
INSERT INTO finance_encryption_keys (version, is_active, notes)
VALUES (1, true, 'Initial encryption key')
ON CONFLICT (version) DO NOTHING;

-- Function to rotate encryption key
CREATE OR REPLACE FUNCTION rotate_encryption_key()
RETURNS INTEGER AS $$
DECLARE
  new_version INTEGER;
BEGIN
  -- Mark current active key as inactive
  UPDATE finance_encryption_keys
  SET is_active = false, rotated_at = NOW()
  WHERE is_active = true;
  
  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO new_version
  FROM finance_encryption_keys;
  
  -- Create new active key
  INSERT INTO finance_encryption_keys (version, is_active, notes)
  VALUES (new_version, true, 'Key rotation');
  
  RETURN new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add encrypted columns to vendor profiles
ALTER TABLE finance_vendor_profiles
ADD COLUMN IF NOT EXISTS bank_account_encrypted JSONB,
ADD COLUMN IF NOT EXISTS tax_id_encrypted JSONB,
ADD COLUMN IF NOT EXISTS routing_number_encrypted JSONB;

-- Add encrypted columns to expenses
ALTER TABLE finance_expenses
ADD COLUMN IF NOT EXISTS reimbursement_account_encrypted JSONB;

COMMENT ON TABLE finance_encryption_keys IS 'Metadata for encryption key versions (actual keys stored in secure key management service)';
COMMENT ON COLUMN finance_encryption_keys.version IS 'Key version number';
COMMENT ON COLUMN finance_encryption_keys.is_active IS 'Whether this key is currently active for new encryptions';
COMMENT ON COLUMN finance_encryption_keys.rotated_at IS 'When this key was rotated out';
COMMENT ON FUNCTION rotate_encryption_key IS 'Rotate to a new encryption key version';
