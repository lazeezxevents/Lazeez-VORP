-- ============================================================================
-- Jira-Class Core Object Model
-- ============================================================================

-- 1. Enum for Issue Types
DO $$ BEGIN
    CREATE TYPE issue_type AS ENUM ('epic', 'story', 'task', 'subtask', 'bug');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add columns to projects for issue keying
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS key_prefix TEXT DEFAULT 'VORP',
ADD COLUMN IF NOT EXISTS next_key_number INTEGER DEFAULT 1;

-- 3. Add columns to project_tasks for Jira capabilities
ALTER TABLE public.project_tasks
ADD COLUMN IF NOT EXISTS issue_type issue_type DEFAULT 'task',
ADD COLUMN IF NOT EXISTS issue_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS key_number INTEGER;

-- 4. Issue Links Table
CREATE TABLE IF NOT EXISTS public.issue_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL, -- 'blocks', 'blocked_by', 'relates_to', 'duplicates', 'causes'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT no_self_link CHECK (source_id <> target_id)
);

-- 5. Trigger Function to auto-generate Issue Key
CREATE OR REPLACE FUNCTION public.generate_issue_key()
RETURNS TRIGGER AS $$
DECLARE
    p_prefix TEXT;
    p_num INTEGER;
BEGIN
    -- Only generate if project_id is present and issue_key is null
    IF NEW.project_id IS NOT NULL AND NEW.issue_key IS NULL THEN
        -- Lock the project row to prevent race conditions on next_key_number
        SELECT key_prefix, next_key_number INTO p_prefix, p_num
        FROM public.projects
        WHERE id = NEW.project_id
        FOR UPDATE;

        IF FOUND THEN
            NEW.key_number := p_num;
            NEW.issue_key := p_prefix || '-' || p_num;
            
            -- Increment the counter in projects
            UPDATE public.projects 
            SET next_key_number = p_num + 1 
            WHERE id = NEW.project_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach Trigger
DO $$ BEGIN
    CREATE TRIGGER tr_generate_issue_key
    BEFORE INSERT ON public.project_tasks
    FOR EACH ROW EXECUTE FUNCTION public.generate_issue_key();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Backfill existing tasks with keys (for existing projects)
-- Note: This is a simple backfill. In production, you'd want to be more careful.
-- For now, we'll just assign keys to any task that doesn't have one.
DO $$ 
DECLARE
    r RECORD;
    t RECORD;
    p_prefix TEXT;
    p_num INTEGER;
BEGIN
    FOR r IN SELECT id, key_prefix, next_key_number FROM public.projects LOOP
        p_num := r.next_key_number;
        p_prefix := r.key_prefix;
        
        FOR t IN SELECT id FROM public.project_tasks WHERE project_id = r.id AND issue_key IS NULL ORDER BY created_at ASC LOOP
            UPDATE public.project_tasks 
            SET issue_key = p_prefix || '-' || p_num,
                key_number = p_num
            WHERE id = t.id;
            p_num := p_num + 1;
        END LOOP;
        
        UPDATE public.projects SET next_key_number = p_num WHERE id = r.id;
    END LOOP;
END $$;

-- 8. Enable RLS on issue_links
ALTER TABLE public.issue_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Everyone can view links" ON public.issue_links
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Staff can manage links" ON public.issue_links
        FOR ALL TO authenticated USING (public.is_staff(auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. Add to Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.issue_links;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
