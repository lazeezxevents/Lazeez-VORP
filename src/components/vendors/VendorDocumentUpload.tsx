import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Upload, Loader2, FileText, Trash2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VendorDocumentUploadProps {
  vendorId: string;
  onUploadComplete?: () => void;
}

const documentTypes = [
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "license", label: "License" },
  { value: "cnic", label: "CNIC Copy" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "other", label: "Other" },
];

export function VendorDocumentUpload({ vendorId, onUploadComplete }: VendorDocumentUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!documentName) {
        setDocumentName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
      if (selectedFile.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !documentName || !user) {
      toast.error("Please provide a file and document name");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${vendorId}/${Date.now()}-${documentName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("vendor-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("vendor-documents")
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from("vendor_documents")
        .insert({
          vendor_id: vendorId,
          name: documentName,
          file_url: urlData.publicUrl,
          file_type: documentType,
          file_size: file.size,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", vendorId] });
      setOpen(false);
      setFile(null);
      setDocumentName("");
      setDocumentType("other");
      onUploadComplete?.();
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Vendor Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-type">Document Type</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File (PDF, DOCX, JPG, PNG, CNIC, License)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="flex-1"
              />
            </div>

            {/* Live Preview Section */}
            {file && (
              <div className="mt-3 p-3 border rounded-lg bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">File Preview</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>

                {previewUrl && file.type.startsWith("image/") ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                    <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                    <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB • {file.type || "Document"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !file}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, vendorId, fileUrl }: { id: string; vendorId: string; fileUrl: string }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split("/vendor-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("vendor-documents")
          .remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from("vendor_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return vendorId;
    },
    onSuccess: (vendorId) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", vendorId] });
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });
}
