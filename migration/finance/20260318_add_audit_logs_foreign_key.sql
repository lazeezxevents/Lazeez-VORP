-- =====================================================
-- Add Foreign Key to Audit Logs for Profile Join
-- =====================================================
-- This migration adds a foreign key constraint from audit_logs.user_id
-- to profiles.id to enable proper joins for user profile display
-- =====================================================

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Add comment
COMMENT ON CONSTRAINT audit_logs_user_id_fkey ON public.audit_logs IS 'Foreign key to profiles table for user profile joins';
