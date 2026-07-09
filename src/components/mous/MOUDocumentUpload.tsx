import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MOUDocumentUploadProps {
  mouId: string;
  currentDocumentUrl: string | null;
  onUploadComplete: (url: string) => void;
}

export function MOUDocumentUpload({ 
  mouId, 
  currentDocumentUrl, 
  onUploadComplete 
}: MOUDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploading(true);
    try {
      const fileName = `${mouId}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("mou-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("mou-documents")
        .getPublicUrl(fileName);

      // Update MOU with document URL
      const { error: updateError } = await supabase
        .from("mous")
        .update({ document_url: fileName })
        .eq("id", mouId);

      if (updateError) throw updateError;

      onUploadComplete(fileName);
      toast.success("Document uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentDocumentUrl) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("mou-documents")
        .download(currentDocumentUrl);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentDocumentUrl.split("/").pop() || "document.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Failed to download document. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!currentDocumentUrl) return;
    
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase.storage
        .from("mou-documents")
        .remove([currentDocumentUrl]);

      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from("mous")
        .update({ document_url: null })
        .eq("id", mouId);

      if (updateError) throw updateError;

      onUploadComplete("");
      toast.success("Document deleted successfully");
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Signed Document (PDF)</Label>
      
      {currentDocumentUrl ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <FileText className="w-5 h-5 text-primary" />
          <span className="flex-1 text-sm truncate">
            {currentDocumentUrl.split("/").pop()}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 text-destructive" />
            )}
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Upload the signed PDF document (max 10MB)
      </p>
    </div>
  );
}
