import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ReceiptVault } from '@/services/ReceiptVault';

interface LogoUploaderProps {
  onUpload: (url: string) => void;
  initialUrl?: string;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({ onUpload, initialUrl }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(initialUrl);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploaded = await ReceiptVault.uploadReceipt(file, 'general', user?.id || 'unknown', {
        notes: 'Invoice logo upload',
      });
      const publicUrl = await ReceiptVault.getReceiptFileUrl(uploaded.file_path);
      setPreview(publicUrl);
      onUpload(publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <label className="block">
        <input type="file" accept="image/*,.png,.jpg,.jpeg" onChange={handleFile} disabled={uploading} />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="logo preview" className="h-10 object-contain border rounded" />
      ) : (
        <div className="h-10 w-28 bg-muted rounded-md flex items-center justify-center text-xs">No logo</div>
      )}
      <div>
        <Button size="sm" variant="ghost" onClick={() => { setPreview(undefined); onUpload(''); }}>
          Remove
        </Button>
        {uploading && <div className="text-sm text-muted-foreground">Uploading…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>
    </div>
  );
};

export default LogoUploader;
