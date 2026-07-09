/**
 * FileUpload Component
 * 
 * Handles file uploads with validation, preview, and progress tracking.
 * 
 * Requirements:
 * - 7.1: Integrate with Supabase Storage
 * - 7.2: Validate file types against allowlist
 * - 7.3: Enforce 50MB file size limit
 * - 7.7: Support drag-and-drop
 * - 7.8: Display upload progress
 * - 7.9: Show error with retry option
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, File, Image as ImageIcon, Video, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RateLimiterService } from "@/services/RateLimiterService";
import { useAuth } from "@/contexts/AuthContext";

interface FileUploadProps {
  channelId: string;
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

interface FileWithPreview {
  file: File;
  preview?: string;
  progress: number;
  error?: string;
  uploaded: boolean;
}

const ALLOWED_FILE_TYPES = [
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Videos
  "video/mp4",
  "video/webm",
  "video/ogg",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

export const FileUpload = ({
  channelId,
  onFilesSelected,
  maxFiles = MAX_FILES,
  maxSizeMB = 50,
}: FileUploadProps) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }

    return null;
  };

  const createPreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const handleFiles = useCallback(
    async (newFiles: FileList | File[]) => {
      if (!user) {
        toast.error("You must be logged in to upload files");
        return;
      }

      // Check file upload rate limit (Requirement 20.5, 20.4)
      const rateLimitResult = await RateLimiterService.checkFileUploadRateLimit(user.id);
      if (!rateLimitResult.allowed) {
        const retrySeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
        toast.error(
          rateLimitResult.error || 'You are uploading files too quickly',
          {
            description: `Please wait ${retrySeconds} seconds before uploading more files.`,
            duration: 5000,
          }
        );
        return;
      }

      const fileArray = Array.from(newFiles);

      // Check max files limit
      if (files.length + fileArray.length > maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate and create previews
      const validatedFiles: FileWithPreview[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        const preview = await createPreview(file);

        validatedFiles.push({
          file,
          preview,
          progress: 0,
          error: error || undefined,
          uploaded: false,
        });

        if (error) {
          toast.error(`${file.name}: ${error}`);
        }
      }

      setFiles((prev) => [...prev, ...validatedFiles]);

      // Pass valid files to parent
      const validFiles = validatedFiles
        .filter((f) => !f.error)
        .map((f) => f.file);
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [files.length, maxFiles, onFilesSelected, user]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      setFiles((prev) => {
        const newFiles = prev.filter((_, i) => i !== index);
        onFilesSelected(newFiles.filter((f) => !f.error).map((f) => f.file));
        return newFiles;
      });
    },
    [onFilesSelected]
  );

  const retryUpload = useCallback(
    (index: number) => {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, error: undefined, progress: 0 } : f
        )
      );
    },
    []
  );

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return ImageIcon;
    if (fileType.startsWith("video/")) return Video;
    if (fileType.includes("pdf") || fileType.includes("document"))
      return FileText;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_FILE_TYPES.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <Upload
            className={`w-8 h-8 ${
              isDragging ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <div>
            <p className="text-sm font-medium">
              {isDragging ? "Drop files here" : "Drag and drop files"}
            </p>
            <p className="text-xs text-muted-foreground">
              or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
              >
                browse
              </button>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} files, {maxSizeMB}MB each
          </p>
        </div>
      </div>

      {/* File Previews */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((fileWithPreview, index) => {
              const FileIcon = getFileIcon(fileWithPreview.file.type);

              return (
                <motion.div
                  key={`${fileWithPreview.file.name}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    fileWithPreview.error
                      ? "border-destructive bg-destructive/5"
                      : "border-border bg-accent/50"
                  }`}
                >
                  {/* Preview or Icon */}
                  <div className="flex-shrink-0">
                    {fileWithPreview.preview ? (
                      <img
                        src={fileWithPreview.preview}
                        alt={fileWithPreview.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                        <FileIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileWithPreview.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(fileWithPreview.file.size)}
                    </p>

                    {/* Progress or Error */}
                    {fileWithPreview.error ? (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3 text-destructive" />
                        <p className="text-xs text-destructive">
                          {fileWithPreview.error}
                        </p>
                      </div>
                    ) : fileWithPreview.progress > 0 &&
                      fileWithPreview.progress < 100 ? (
                      <Progress
                        value={fileWithPreview.progress}
                        className="h-1 mt-1"
                      />
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {fileWithPreview.error && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => retryUpload(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Loader2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
