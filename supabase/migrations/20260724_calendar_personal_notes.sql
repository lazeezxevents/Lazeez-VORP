-- Personal, private calendar notes. Each user owns their notes and can keep one note per date.
CREATE TABLE IF NOT EXISTS public.calendar_personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, note_date)
);

CREATE INDEX IF NOT EXISTS calendar_personal_notes_user_date_idx
  ON public.calendar_personal_notes(user_id, note_date);

ALTER TABLE public.calendar_personal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their personal calendar notes" ON public.calendar_personal_notes;
CREATE POLICY "Users can view their personal calendar notes"
  ON public.calendar_personal_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their personal calendar notes" ON public.calendar_personal_notes;
CREATE POLICY "Users can create their personal calendar notes"
  ON public.calendar_personal_notes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their personal calendar notes" ON public.calendar_personal_notes;
CREATE POLICY "Users can update their personal calendar notes"
  ON public.calendar_personal_notes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their personal calendar notes" ON public.calendar_personal_notes;
CREATE POLICY "Users can delete their personal calendar notes"
  ON public.calendar_personal_notes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_calendar_personal_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_calendar_personal_notes_updated_at ON public.calendar_personal_notes;
CREATE TRIGGER update_calendar_personal_notes_updated_at
  BEFORE UPDATE ON public.calendar_personal_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_calendar_personal_notes_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_personal_notes TO authenticated;
