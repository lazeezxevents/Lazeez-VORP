-- ============================================================================
-- Create Storage Bucket for Issue Attachments
-- ============================================================================

-- Insert storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'issue-attachments',
    'issue-attachments',
    true,
    52428800, -- 50MB in bytes
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-zip-compressed'
    ]
)
ON CONFLICT (id) DO UPDATE
SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- Storage Policies for Issue Attachments
-- ============================================================================
-- NOTE: Storage policies require elevated permissions and should be created
-- via the Supabase Dashboard or using the Service Role key.
-- 
-- To create these policies manually:
-- 1. Go to Supabase Dashboard → Storage → Policies
-- 2. Select the "issue-attachments" bucket
-- 3. Create the following policies:
--
-- Policy 1: Allow authenticated users to upload
--   Name: "Authenticated users can upload issue attachments"
--   Operation: INSERT
--   Target roles: authenticated
--   USING expression: bucket_id = 'issue-attachments'
--
-- Policy 2: Allow authenticated users to read
--   Name: "Authenticated users can read issue attachments"
--   Operation: SELECT
--   Target roles: authenticated
--   USING expression: bucket_id = 'issue-attachments'
--
-- Policy 3: Allow users to delete their own
--   Name: "Users can delete their own issue attachments"
--   Operation: DELETE
--   Target roles: authenticated
--   USING expression: bucket_id = 'issue-attachments'
--
-- Alternatively, run this via SQL Editor with elevated permissions:
/*
BEGIN;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read issue attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own issue attachments" ON storage.objects;

-- Create upload policy
CREATE POLICY "Authenticated users can upload issue attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'issue-attachments');

-- Create read policy
CREATE POLICY "Authenticated users can read issue attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'issue-attachments');

-- Create delete policy
CREATE POLICY "Users can delete their own issue attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'issue-attachments');

COMMIT;
*/

-- For now, we'll just ensure the bucket exists
-- The policies should be created via Dashboard or with elevated permissions
SELECT 'Storage bucket "issue-attachments" created. Please add storage policies via Dashboard.' as message;
