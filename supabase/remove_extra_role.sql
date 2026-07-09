-- Run this to remove the 'viewer' role and keep only 'admin'
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'highypestudio@gmail.com')
AND role = 'viewer';

-- Verify the result
SELECT u.email, ur.role 
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'highypestudio@gmail.com';
