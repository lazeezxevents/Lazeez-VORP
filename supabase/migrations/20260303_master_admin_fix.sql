-- ============================================================================
-- Fix Master Admin Role & RLS Sync
-- Ensure highypestudio@gmail.com always has the 'admin' role in the database
-- to prevent RLS conflicts where frontend thinks it's admin but backend thinks it's viewer.
-- ============================================================================

-- 1. Ensure user has 'admin' role in user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'highypestudio@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Update any existing roles for this user to 'admin' (if they were something else)
UPDATE public.user_roles
SET role = 'admin'::public.app_role
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'highypestudio@gmail.com');

-- 3. Ensure profile is approved and synchronized
UPDATE public.profiles
SET 
  is_approved = true,
  full_name = COALESCE(full_name, 'Master Admin')
WHERE email = 'highypestudio@gmail.com';

-- 4. Clean up any 'viewer' roles that might be lingering for the master admin
DELETE FROM public.user_roles
WHERE role = 'viewer'::public.app_role
AND user_id IN (SELECT id FROM auth.users WHERE email = 'highypestudio@gmail.com');
