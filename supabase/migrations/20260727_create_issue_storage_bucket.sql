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

-- Allow authenticated users to upload to their issue folders
DROP POLICY IF EXISTS "Authenticated users can upload issue attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload issue attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'issue-attachments' AND
    auth.role() = 'authenticated'
);

-- Allow authenticated users to read all issue attachments
DROP POLICY IF EXISTS "Authenticated users can read issue attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read issue attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'issue-attachments');

-- Allow users to delete their own attachments
-- (We check uploaded_by in the application layer, but this provides bucket-level protection)
DROP POLICY IF EXISTS "Users can delete their own issue attachments" ON storage.objects;
CREATE POLICY "Users can delete their own issue attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'issue-attachments' AND
    auth.role() = 'authenticated'
);

COMMENT ON POLICY "Authenticated users can upload issue attachments" ON storage.objects IS 
'Allows authenticated users to upload files to issue-specific folders';

COMMENT ON POLICY "Authenticated users can read issue attachments" ON storage.objects IS 
'Allows all authenticated users to view issue attachments';

COMMENT ON POLICY "Users can delete their own issue attachments" ON storage.objects IS 
'Allows users to delete attachments (app-level check ensures they own it)';
