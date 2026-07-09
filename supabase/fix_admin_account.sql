-- ============================================================================
-- MAGIC FIX V2: Approve Master Admin & Confirm Email
-- Corrected to avoid generated column error
-- ============================================================================

-- 1. Confirm the email address (standard updateable column)
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'highypestudio@gmail.com';

-- 2. Approve the profile
UPDATE public.profiles
SET is_approved = true,
    approved_by = (SELECT id FROM auth.users WHERE email = 'highypestudio@gmail.com'),
    approved_at = now()
WHERE email = 'highypestudio@gmail.com';

-- 3. Ensure the user has the 'admin' role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'highypestudio@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Check the results
SELECT u.email, u.email_confirmed_at, ur.role, p.is_approved
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'highypestudio@gmail.com';
