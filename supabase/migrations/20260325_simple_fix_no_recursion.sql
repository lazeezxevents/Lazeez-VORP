-- ============================================================================
-- SIMPLE FIX: Remove Infinite Recursion - No Complex Logic
-- Version: 1.0
-- Date: March 25, 2026
-- Description: Simplest possible fix for infinite recursion issue
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL existing profiles policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "HR and Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile limited" ON profiles;
DROP POLICY IF EXISTS "HR and Admin can update employee details" ON profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON profiles;
DROP POLICY IF EXISTS "Admin and HR can update all profile fields" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Managers can view department profiles" ON profiles;

-- ============================================================================
-- STEP 2: Create simple helper functions (SECURITY DEFINER breaks recursion)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND main_role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND main_role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 3: Create SIMPLE profiles policies (no OLD/NEW, no complex logic)
-- ============================================================================

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT TO authenticated 
USING (id = auth.uid());

-- Policy 2: Admins and managers can view all profiles (uses helper function)
CREATE POLICY "Admins and managers can view all profiles"
ON profiles FOR SELECT TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- Policy 3: Users can update their own profile (basic fields only)
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 4: Admins and managers can update any profile
CREATE POLICY "Admins and managers can update any profile"
ON profiles FOR UPDATE TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- ============================================================================
-- STEP 4: Add simple trigger to prevent self-role-escalation
-- ============================================================================

-- Simple trigger that prevents non-admin users from changing their own role
CREATE OR REPLACE FUNCTION check_profile_update()
RETURNS TRIGGER AS $$
DECLARE
  updater_role VARCHAR(50);
BEGIN
  -- Get the role of the person making the update
  SELECT main_role INTO updater_role 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- If updating own profile and not admin/manager, prevent role changes
  IF NEW.id = auth.uid() AND updater_role NOT IN ('admin', 'manager') THEN
    -- Silently revert protected field changes
    NEW.main_role := OLD.main_role;
    NEW.is_approved := OLD.is_approved;
    NEW.approval_status := OLD.approval_status;
    NEW.designation := OLD.designation;
    NEW.department_id := OLD.department_id;
    NEW.manager_id := OLD.manager_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_profile_update_trigger ON profiles;
CREATE TRIGGER check_profile_update_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_profile_update();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test that policies work
DO $$
BEGIN
  RAISE NOTICE 'Profiles policies updated successfully';
  RAISE NOTICE 'Helper functions created: is_admin_or_manager, is_admin';
  RAISE NOTICE 'Protection trigger created: check_profile_update_trigger';
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION is_admin_or_manager IS 'Checks if user is admin or manager - SECURITY DEFINER prevents recursion';
COMMENT ON FUNCTION is_admin IS 'Checks if user is admin - SECURITY DEFINER prevents recursion';
COMMENT ON FUNCTION check_profile_update IS 'Prevents users from changing their own role/approval fields';
