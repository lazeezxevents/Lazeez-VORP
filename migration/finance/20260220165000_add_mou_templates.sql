
-- Migration to add MOU templates for GenAI Learning
CREATE TABLE IF NOT EXISTS public.mou_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category vendor_category,
    raw_text TEXT,
    structure_json JSONB, -- Stores identified placeholders and their context
    branding_info JSONB, -- Stores logo position and branding rules
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.mou_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.mou_templates;
    CREATE POLICY "Authenticated users can view templates"
    ON public.mou_templates FOR SELECT
    USING (auth.uid() IS NOT NULL);
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Staff can manage templates" ON public.mou_templates;
    CREATE POLICY "Staff can manage templates"
    ON public.mou_templates FOR ALL
    USING (is_staff(auth.uid()));
END $$;
