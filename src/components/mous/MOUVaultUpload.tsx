import { useState, useRef } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useVendors } from "@/hooks/useVendors";
import { useUploadToVault, useTriggerExtraction, MOUDocumentType } from "@/hooks/useMOUVault";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MOUVaultUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVendorId?: string;
}

export function MOUVaultUpload({ open, onOpenChange, preselectedVendorId }: MOUVaultUploadProps) {
  const [vendorId, setVendorId] = useState(preselectedVendorId || "");
  const [documentType, setDocumentType] = useState<MOUDocumentType>("new");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: vendors } = useVendors();
  const uploadToVault = useUploadToVault();
  const triggerExtraction = useTriggerExtraction();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!vendorId || !file) {
      toast.error("Please select a vendor and file");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${vendorId}/${Date.now()}.${fileExt}`;
      
      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("mou-vault")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from("mou-vault")
        .getPublicUrl(fileName);

      // Create vault record
      const vaultItem = await uploadToVault.mutateAsync({
        vendor_id: vendorId,
        document_name: file.name,
        document_url: fileName,
        document_type: documentType,
      });

      setUploadProgress(80);

      // Trigger AI extraction
      await triggerExtraction.mutateAsync({
        vaultId: vaultItem.id,
        documentUrl: fileName,
      });

      setUploadProgress(100);

      // Reset form
      setFile(null);
      setVendorId(preselectedVendorId || "");
      setDocumentType("new");
      onOpenChange(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload MOU Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vendor *</Label>
            <Select value={vendorId} onValueChange={setVendorId} disabled={!!preselectedVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors?.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as MOUDocumentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New MOU</SelectItem>
                <SelectItem value="legacy">Legacy MOU</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>PDF Document *</Label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload PDF (max 10MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-xs text-center text-muted-foreground">
                {uploadProgress < 60 && "Uploading document..."}
                {uploadProgress >= 60 && uploadProgress < 80 && "Creating vault record..."}
                {uploadProgress >= 80 && "Starting AI extraction..."}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !vendorId || !file}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload & Extract
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
