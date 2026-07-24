-- Link operational issues to the project workspace without making either side mandatory.
-- Safe to run more than once.

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_task_id ON public.issues(project_task_id);
