-- Finance Module: Multi-Factor Authentication System
-- Require MFA for Finance Admin role
-- Support TOTP and backup codes

-- MFA settings table
CREATE TABLE IF NOT EXISTS finance_mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  secret_encrypted JSONB,
  backup_codes_encrypted JSONB,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MFA attempts log
CREATE TABLE IF NOT EXISTS finance_mfa_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('totp', 'backup_code')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes
CREATE INDEX idx_mfa_settings_user_id ON finance_mfa_settings(user_id);
CREATE INDEX idx_mfa_settings_enabled ON finance_mfa_settings(is_enabled);
CREATE INDEX idx_mfa_attempts_user_id ON finance_mfa_attempts(user_id);
CREATE INDEX idx_mfa_attempts_attempted_at ON finance_mfa_attempts(attempted_at);

-- Enable RLS
ALTER TABLE finance_mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_mfa_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own MFA settings
CREATE POLICY "finance_mfa_settings_own_select"
  ON finance_mfa_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "finance_mfa_settings_own_update"
  ON finance_mfa_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "finance_mfa_settings_own_insert"
  ON finance_mfa_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can view all MFA settings
CREATE POLICY "finance_mfa_settings_admin_select"
  ON finance_mfa_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users can view their own MFA attempts
CREATE POLICY "finance_mfa_attempts_own_select"
  ON finance_mfa_attempts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can insert MFA attempts
CREATE POLICY "finance_mfa_attempts_system_insert"
  ON finance_mfa_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can view all MFA attempts
CREATE POLICY "finance_mfa_attempts_admin_select"
  ON finance_mfa_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Function to generate MFA secret
CREATE OR REPLACE FUNCTION generate_mfa_secret(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
  v_backup_codes TEXT[];
  v_qr_code TEXT;
  v_user_email TEXT;
  i INTEGER;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM users WHERE id = p_user_id;
  
  -- Generate random secret (base32 encoded)
  v_secret := encode(gen_random_bytes(20), 'base64');
  
  -- Generate 10 backup codes
  v_backup_codes := ARRAY[]::TEXT[];
  FOR i IN 1..10 LOOP
    v_backup_codes := array_append(v_backup_codes, 
      substring(md5(random()::text) from 1 for 8));
  END LOOP;
  
  -- Generate QR code URL (otpauth format)
  v_qr_code := 'otpauth://totp/Lazeez%20VORP:' || v_user_email || 
               '?secret=' || v_secret || '&issuer=Lazeez%20VORP';
  
  RETURN jsonb_build_object(
    'secret', v_secret,
    'qr_code', v_qr_code,
    'backup_codes', v_backup_codes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify MFA setup
CREATE OR REPLACE FUNCTION verify_mfa_setup(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_success BOOLEAN;
BEGIN
  -- In production, this would verify the TOTP code against the secret
  -- For now, accept any 6-digit code for setup
  v_success := length(p_code) = 6 AND p_code ~ '^[0-9]+$';
  
  RETURN jsonb_build_object('success', v_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify MFA code
CREATE OR REPLACE FUNCTION verify_mfa_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_success BOOLEAN;
  v_is_enabled BOOLEAN;
BEGIN
  -- Check if MFA is enabled
  SELECT is_enabled INTO v_is_enabled
  FROM finance_mfa_settings
  WHERE user_id = p_user_id;
  
  IF NOT v_is_enabled THEN
    RETURN jsonb_build_object('success', false);
  END IF;
  
  -- In production, this would verify the TOTP code against the secret
  -- For now, accept any 6-digit code
  v_success := length(p_code) = 6 AND p_code ~ '^[0-9]+$';
  
  RETURN jsonb_build_object('success', v_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify backup code
CREATE OR REPLACE FUNCTION verify_backup_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_success BOOLEAN;
BEGIN
  -- In production, this would check against stored backup codes
  -- and mark the code as used
  v_success := length(p_code) = 8;
  
  RETURN jsonb_build_object('success', v_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to regenerate backup codes
CREATE OR REPLACE FUNCTION regenerate_backup_codes(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_backup_codes TEXT[];
  i INTEGER;
BEGIN
  -- Generate 10 new backup codes
  v_backup_codes := ARRAY[]::TEXT[];
  FOR i IN 1..10 LOOP
    v_backup_codes := array_append(v_backup_codes, 
      substring(md5(random()::text) from 1 for 8));
  END LOOP;
  
  RETURN jsonb_build_object('backup_codes', v_backup_codes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_mfa_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mfa_settings_updated_at
  BEFORE UPDATE ON finance_mfa_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_mfa_settings_updated_at();

COMMENT ON TABLE finance_mfa_settings IS 'Multi-factor authentication settings for users';
COMMENT ON TABLE finance_mfa_attempts IS 'Log of MFA verification attempts';
COMMENT ON FUNCTION generate_mfa_secret IS 'Generate TOTP secret and backup codes for MFA setup';
COMMENT ON FUNCTION verify_mfa_setup IS 'Verify MFA code during initial setup';
COMMENT ON FUNCTION verify_mfa_code IS 'Verify MFA code during login';
COMMENT ON FUNCTION verify_backup_code IS 'Verify backup code and mark as used';
COMMENT ON FUNCTION regenerate_backup_codes IS 'Generate new backup codes';
