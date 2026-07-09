-- Add milestone_id to project_tasks
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone ON public.project_tasks(milestone_id);
