-- ============================================================================
-- FIX: Add INSERT policy for profiles table
-- Date: March 29, 2026
-- Description: Adds missing INSERT policy to allow new user profile creation
-- ============================================================================

-- Drop existing INSERT policies if they exist
DROP POLICY IF EXISTS "Users can insert own profile during registration" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles for others" ON profiles;

-- Add INSERT policy for new user registration
CREATE POLICY "Users can insert own profile during registration"
ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Add INSERT policy for admins to create profiles for others
CREATE POLICY "Admins can insert profiles for others"
ON profiles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND main_role = 'admin'
  )
);

-- Ensure profiles table has RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT INSERT ON profiles TO authenticated;

COMMENT ON POLICY "Users can insert own profile during registration" ON profiles IS 
'Allows authenticated users to create their own profile during registration';

COMMENT ON POLICY "Admins can insert profiles for others" ON profiles IS 
'Allows admins to create profiles for other users (employee onboarding)';
