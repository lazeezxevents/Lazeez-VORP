-- Create a security definer function to get department counts safely
-- This bypasses RLS for the count but doesn't expose profile details
CREATE OR REPLACE FUNCTION public.get_department_counts()
RETURNS TABLE (department_id UUID, employee_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.department_id, COUNT(*) as employee_count
  FROM public.profiles p
  WHERE p.department_id IS NOT NULL
  GROUP BY p.department_id;
END;
$$;

-- Grant access to both authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_department_counts() TO authenticated, anon;
