-- Add versioning and branching columns to mou_vault table
-- This enables proper parent-child relationships for MOU versions

ALTER TABLE public.mou_vault
  ADD COLUMN IF NOT EXISTS parent_vault_id UUID REFERENCES public.mou_vault(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mou_vault_parent_id ON public.mou_vault(parent_vault_id);
CREATE INDEX IF NOT EXISTS idx_mou_vault_version ON public.mou_vault(version_number);

-- Add comment to document the branching relationship
COMMENT ON COLUMN public.mou_vault.parent_vault_id IS 'Parent MOU vault item ID for versioning/branching. NULL indicates this is a primary/root version.';
COMMENT ON COLUMN public.mou_vault.version_number IS 'Version number (1.0, 2.0, etc.). Primary versions are 1.0, daughter branches are 2.0+';
