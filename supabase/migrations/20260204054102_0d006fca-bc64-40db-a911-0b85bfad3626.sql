-- Add new columns to mou_vault for party details and renewal tracking
ALTER TABLE public.mou_vault 
ADD COLUMN IF NOT EXISTS has_auto_renewal boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS renewal_period_days integer DEFAULT 365,
ADD COLUMN IF NOT EXISTS party_1_name text,
ADD COLUMN IF NOT EXISTS party_1_business text,
ADD COLUMN IF NOT EXISTS party_2_name text,
ADD COLUMN IF NOT EXISTS party_2_business text,
ADD COLUMN IF NOT EXISTS mou_purpose text,
ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_renewal_date date;

-- Create enum for revision types
CREATE TYPE public.mou_revision_type AS ENUM ('amendment', 'renewal', 'termination');

-- Create mou_vault_revisions table
CREATE TABLE public.mou_vault_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_id uuid NOT NULL REFERENCES public.mou_vault(id) ON DELETE CASCADE,
  revision_type public.mou_revision_type NOT NULL,
  revision_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  document_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on revisions table
ALTER TABLE public.mou_vault_revisions ENABLE ROW LEVEL SECURITY;

-- RLS policies for revisions
CREATE POLICY "Authenticated users can view revisions"
  ON public.mou_vault_revisions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert revisions"
  ON public.mou_vault_revisions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update revisions"
  ON public.mou_vault_revisions
  FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete revisions"
  ON public.mou_vault_revisions
  FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_mou_vault_revisions_vault_id ON public.mou_vault_revisions(vault_id);

-- Audit trigger for revisions
CREATE TRIGGER mou_vault_revisions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.mou_vault_revisions
  FOR EACH ROW EXECUTE FUNCTION public.log_mou_vault_changes();