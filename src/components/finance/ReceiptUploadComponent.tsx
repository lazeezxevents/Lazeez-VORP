/**
 * Receipt Upload Component
 * Task 21.2: Build receipt upload component
 * Requirements: 10.1
 * 
 * Drag-and-drop upload interface with preview and progress tracking
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useUploadReceipt } from "./useReceiptVault";
import type { ReceiptCategory, ReceiptMetadata } from "./types";

interface ReceiptUploadComponentProps {
  onUploadComplete?: (receiptId: string) => void;
  defaultCategory?: ReceiptCategory;
}

export function ReceiptUploadComponent({
  onUploadComplete,
  defaultCategory = 'general',
}: ReceiptUploadComponentProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState<ReceiptCategory>(defaultCategory);
  const [subcategory, setSubcategory] = useState('');

  const uploadMutation = useUploadReceipt();

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only PDF, JPG, and PNG files are allowed.');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    const metadata: ReceiptMetadata = {
      uploadedBy: '', // Will be set by service
      category,
      subcategory: subcategory || undefined,
    };

    try {
      const receipt = await uploadMutation.mutateAsync({
        file: selectedFile,
        metadata,
      });

      // Reset form
      setSelectedFile(null);
      setPreview(null);
      setSubcategory('');

      // Callback
      if (onUploadComplete) {
        onUploadComplete(receipt.id);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Clear selection
  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={`border-2 border-dashed transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="p-8">
            {!selectedFile ? (
              <div className="text-center">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="inline-block"
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                </motion.div>
                <h3 className="font-semibold text-lg mb-2">Upload receipt</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop your receipt here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supports PDF, JPG, PNG (max 10MB)
                </p>
                <label htmlFor="file-upload">
                  <Button asChild>
                    <span>
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileInputChange}
                      />
                      Choose file
                    </span>
                  </Button>
                </label>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Preview */}
                  <div className="flex items-start gap-4">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Receipt preview"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center bg-muted rounded-lg border">
                        <FileText className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClear}
                          disabled={uploadMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {uploadMutation.isPending && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-2"
                        >
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-primary"
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 2, ease: "easeInOut" }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Uploading...
                          </p>
                        </motion.div>
                      )}

                      {uploadMutation.isSuccess && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 mt-2 text-success"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Uploaded successfully</span>
                        </motion.div>
                      )}

                      {uploadMutation.isError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 mt-2 text-destructive"
                        >
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Upload failed</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Selection */}
      {selectedFile && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as ReceiptCategory)}
                disabled={uploadMutation.isPending}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="riders">Riders</SelectItem>
                  <SelectItem value="vendors">Vendors</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory (optional)</Label>
              <Input
                id="subcategory"
                placeholder="e.g., Fuel, Office supplies"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={uploadMutation.isPending}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload receipt'}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
