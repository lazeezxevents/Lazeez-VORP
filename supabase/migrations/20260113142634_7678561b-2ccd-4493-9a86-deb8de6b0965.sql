-- Add foreign key for designation_id in profiles
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_designation_id_fkey 
FOREIGN KEY (designation_id) REFERENCES public.designations(id) ON DELETE SET NULL;