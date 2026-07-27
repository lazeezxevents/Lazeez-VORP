-- Fix: Add project_id and project_task_id columns to issues table
-- This will allow linking issues to projects and project tasks

-- Add the columns if they don't exist
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_task_id ON public.issues(project_task_id);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'issues'
  AND column_name IN ('project_id', 'project_task_id');
