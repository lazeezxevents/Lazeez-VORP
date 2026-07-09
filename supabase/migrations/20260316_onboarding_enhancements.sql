-- Employee Onboarding Enhancements Migration
-- Adds approval workflow and invitation system

-- Add approval columns to profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='approval_status') THEN
    ALTER TABLE profiles ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='admin_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN admin_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_by') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_by UUID REFERENCES profiles(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='hr_approved_at') THEN
    ALTER TABLE profiles ADD COLUMN hr_approved_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='rejection_reason') THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='onboarding_type') THEN
    ALTER TABLE profiles ADD COLUMN onboarding_type VARCHAR(20) DEFAULT 'self_signup';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='profiles' AND column_name='manager_id') THEN
    ALTER TABLE profiles ADD COLUMN manager_id UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Add comment for approval_status values
COMMENT ON COLUMN profiles.approval_status IS 'Values: pending, admin_approved, hr_approved, rejected';
COMMENT ON COLUMN profiles.onboarding_type IS 'Values: self_signup, hr_invitation';

-- Employee Invitations Table
CREATE TABLE IF NOT EXISTS employee_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role_id UUID REFERENCES custom_roles(id),
  department_id UUID REFERENCES departments(id),
  team_id UUID,
  manager_id UUID REFERENCES profiles(id),
  secondary_manager_id UUID REFERENCES profiles(id),
  start_date DATE,
  employment_type VARCHAR(50) DEFAULT 'full_time',
  -- Values: 'full_time', 'part_time', 'contract', 'intern'
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES profiles(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'accepted', 'expired', 'cancelled'
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON profiles(approval_status);

-- Enable Row Level Security
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_invitations

-- HR and Admin can view all invitations
CREATE POLICY "HR and Admin can view invitations"
ON employee_invitations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- HR and Admin can create invitations
CREATE POLICY "HR and Admin can create invitations"
ON employee_invitations FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- HR and Admin can update invitations
CREATE POLICY "HR and Admin can update invitations"
ON employee_invitations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- HR and Admin can delete invitations
CREATE POLICY "HR and Admin can delete invitations"
ON employee_invitations FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Update profiles RLS policies to prevent unauthorized changes

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON profiles;

-- Users can only update their own non-sensitive fields
CREATE POLICY "Users can update own profile limited"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  -- Prevent changing these sensitive fields
  (OLD.main_role = NEW.main_role OR NEW.main_role IS NULL) AND
  (OLD.department_id = NEW.department_id OR NEW.department_id IS NULL) AND
  (OLD.designation = NEW.designation OR NEW.designation IS NULL) AND
  (OLD.approval_status = NEW.approval_status OR NEW.approval_status IS NULL) AND
  (OLD.admin_approved_by = NEW.admin_approved_by OR NEW.admin_approved_by IS NULL) AND
  (OLD.hr_approved_by = NEW.hr_approved_by OR NEW.hr_approved_by IS NULL) AND
  (OLD.manager_id = NEW.manager_id OR NEW.manager_id IS NULL)
);

-- HR and Admin can update employee details
CREATE POLICY "HR and Admin can update employee details"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND main_role IN ('admin', 'manager')
  )
);

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to check if invitation is valid
CREATE OR REPLACE FUNCTION is_invitation_valid(token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  SELECT * INTO invitation_record
  FROM employee_invitations
  WHERE invitation_token = token
  AND status = 'pending'
  AND expires_at > NOW();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation and create profile
CREATE OR REPLACE FUNCTION accept_invitation(
  token TEXT,
  user_id UUID,
  password_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
  invitation_record RECORD;
  new_profile_id UUID;
  result JSONB;
BEGIN
  -- Check if invitation is valid
  IF NOT is_invitation_valid(token) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation'
    );
  END IF;
  
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM employee_invitations
  WHERE invitation_token = token;
  
  -- Update invitation status
  UPDATE employee_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE invitation_token = token;
  
  -- Update profile with invitation details
  UPDATE profiles
  SET 
    full_name = invitation_record.full_name,
    phone = invitation_record.phone,
    department_id = invitation_record.department_id,
    designation = (SELECT display_name FROM custom_roles WHERE id = invitation_record.role_id),
    main_role = (SELECT main_role FROM custom_roles WHERE id = invitation_record.role_id),
    manager_id = invitation_record.manager_id,
    approval_status = 'admin_approved', -- Pre-approved by HR, needs admin final approval
    onboarding_type = 'hr_invitation',
    hr_approved_by = invitation_record.invited_by,
    hr_approved_at = NOW()
  WHERE id = user_id;
  
  -- Assign role to user
  INSERT INTO role_assignments (user_id, role_id, assigned_by)
  VALUES (user_id, invitation_record.role_id, invitation_record.invited_by);
  
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', user_id,
    'role_id', invitation_record.role_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve user (Admin)
CREATE OR REPLACE FUNCTION admin_approve_user(
  target_user_id UUID,
  approver_id UUID
)
RETURNS JSONB AS $$
DECLARE
  current_status TEXT;
BEGIN
  -- Check if approver is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = approver_id AND main_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can approve users'
    );
  END IF;
  
  -- Get current approval status
  SELECT approval_status INTO current_status
  FROM profiles
  WHERE id = target_user_id;
  
  -- Update approval status
  IF current_status = 'pending' THEN
    -- Self-signup flow: Admin approves first
    UPDATE profiles
    SET 
      approval_status = 'admin_approved',
      admin_approved_by = approver_id,
      admin_approved_at = NOW()
    WHERE id = target_user_id;
  ELSIF current_status = 'admin_approved' THEN
    -- HR invitation flow: Admin gives final approval
    UPDATE profiles
    SET 
      approval_status = 'hr_approved',
      admin_approved_by = approver_id,
      admin_approved_at = NOW(),
      is_approved = true
    WHERE id = target_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'new_status', 
    CASE 
      WHEN current_status = 'pending' THEN 'admin_approved'
      ELSE 'hr_approved'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign role and complete HR approval
CREATE OR REPLACE FUNCTION hr_complete_approval(
  target_user_id UUID,
  approver_id UUID,
  assigned_role_id UUID,
  assigned_department_id UUID,
  assigned_designation TEXT,
  assigned_manager_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  assigned_main_role VARCHAR(50);
BEGIN
  -- Check if approver is HR or Admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = approver_id AND main_role IN ('admin', 'manager')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only HR or Admin can complete approval'
    );
  END IF;
  
  -- Check if user is admin approved
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = target_user_id AND approval_status = 'admin_approved'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User must be admin approved first'
    );
  END IF;
  
  -- Get main_role from custom_roles
  SELECT main_role INTO assigned_main_role
  FROM custom_roles
  WHERE id = assigned_role_id;
  
  -- Update profile with role and department
  UPDATE profiles
  SET 
    department_id = assigned_department_id,
    designation = assigned_designation,
    main_role = assigned_main_role,
    manager_id = assigned_manager_id,
    approval_status = 'hr_approved',
    hr_approved_by = approver_id,
    hr_approved_at = NOW(),
    is_approved = true
  WHERE id = target_user_id;
  
  -- Assign role
  INSERT INTO role_assignments (user_id, role_id, assigned_by)
  VALUES (target_user_id, assigned_role_id, approver_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'status', 'hr_approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject user
CREATE OR REPLACE FUNCTION reject_user(
  target_user_id UUID,
  rejector_id UUID,
  reason TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- Check if rejector is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = rejector_id AND main_role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins can reject users'
    );
  END IF;
  
  -- Update profile
  UPDATE profiles
  SET 
    approval_status = 'rejected',
    rejection_reason = reason,
    is_approved = false
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'status', 'rejected'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire old invitations (run via cron)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE employee_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE employee_invitations IS 'Stores HR-initiated employee invitations with pre-assigned roles';
COMMENT ON FUNCTION generate_invitation_token IS 'Generates a secure random token for invitations';
COMMENT ON FUNCTION is_invitation_valid IS 'Checks if an invitation token is valid and not expired';
COMMENT ON FUNCTION accept_invitation IS 'Processes invitation acceptance and creates user profile';
COMMENT ON FUNCTION admin_approve_user IS 'Admin approval step in onboarding workflow';
COMMENT ON FUNCTION hr_complete_approval IS 'HR completes approval by assigning role and department';
COMMENT ON FUNCTION reject_user IS 'Rejects a user signup with reason';
COMMENT ON FUNCTION expire_old_invitations IS 'Marks expired invitations as expired (run via cron)';
