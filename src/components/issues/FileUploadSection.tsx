import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Upload,
  Paperclip,
  Trash2,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useIssueAttachments, useUploadAttachment, useDeleteAttachment, IssueAttachment } from "@/hooks/useIssueEnhancements";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
];
const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  if (
    fileType.includes("spreadsheet") ||
    fileType.includes("excel") ||
    fileType === "application/vnd.ms-excel"
  )
    return FileSpreadsheet;
  return File;
}

function isImage(fileType: string): boolean {
  return fileType.startsWith("image/");
}

// ---------------------------------------------------------------------------
// Upload Queue Item
// ---------------------------------------------------------------------------

interface UploadQueueItem {
  file: File;
  progress: number;
  error: string | null;
  id: string;
}

// ---------------------------------------------------------------------------
// File Card
// ---------------------------------------------------------------------------

interface FileCardProps {
  attachment: IssueAttachment;
  canDelete: boolean;
  onDelete: (attachment: IssueAttachment) => void;
  isDeleting: boolean;
}

function FileCard({ attachment, canDelete, onDelete, isDeleting }: FileCardProps) {
  const Icon = getFileIcon(attachment.file_type);
  const showImage = isImage(attachment.file_type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors group"
    >
      {/* Thumbnail / Icon */}
      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
        {showImage ? (
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Icon className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {attachment.file_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(attachment.file_size)} ·{" "}
          {format(new Date(attachment.created_at), "MMM d, yyyy")}
          {attachment.uploader?.full_name
            ? ` · ${attachment.uploader.full_name}`
            : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          asChild
          aria-label={`Download ${attachment.file_name}`}
        >
          <a href={attachment.file_url} download={attachment.file_name} target="_blank" rel="noreferrer">
            <Download className="w-3.5 h-3.5" />
          </a>
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(attachment)}
            disabled={isDeleting}
            aria-label={`Delete ${attachment.file_name}`}
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface FileUploadSectionProps {
  issueId: string;
}

export function FileUploadSection({ issueId }: FileUploadSectionProps) {
  const { data: attachments, isLoading } = useIssueAttachments(issueId);
  const uploadAttachment = useUploadAttachment(issueId);
  const deleteAttachment = useDeleteAttachment();
  const { user, isAdmin } = useAuth();

  const [isDragOver, setIsDragOver] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `"${file.name}" is not a supported file type.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `"${file.name}" exceeds the 10 MB size limit.`;
    }
    return null;
  };

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const error = validateFile(file);
        const itemId = `${Date.now()}-${Math.random()}`;

        if (error) {
          setQueue((prev) => [
            ...prev,
            { file, progress: 0, error, id: itemId },
          ]);
          setTimeout(
            () => setQueue((prev) => prev.filter((i) => i.id !== itemId)),
            4000
          );
          continue;
        }

        setQueue((prev) => [
          ...prev,
          { file, progress: 10, error: null, id: itemId },
        ]);

        try {
          // Simulate progress (Supabase upload doesn't expose progress natively)
          const progressInterval = setInterval(() => {
            setQueue((prev) =>
              prev.map((item) =>
                item.id === itemId && item.progress < 85
                  ? { ...item, progress: item.progress + 15 }
                  : item
              )
            );
          }, 200);

          await uploadAttachment.mutateAsync(file);

          clearInterval(progressInterval);
          setQueue((prev) =>
            prev.map((item) =>
              item.id === itemId ? { ...item, progress: 100 } : item
            )
          );

          setTimeout(
            () => setQueue((prev) => prev.filter((i) => i.id !== itemId)),
            800
          );
        } catch {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, error: "Upload failed. Please try again.", progress: 0 }
                : item
            )
          );
          setTimeout(
            () => setQueue((prev) => prev.filter((i) => i.id !== itemId)),
            4000
          );
        }
      }
    },
    [uploadAttachment]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const handleDelete = async (attachment: IssueAttachment) => {
    setDeletingId(attachment.id);
    try {
      await deleteAttachment.mutateAsync({ attachment });
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (attachment: IssueAttachment): boolean => {
    return isAdmin || attachment.uploaded_by === user?.id;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const fileList = attachments ?? [];

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/20"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <motion.div
          animate={{ scale: isDragOver ? 1.05 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <Upload
            className={`w-8 h-8 mx-auto mb-2 transition-colors ${
              isDragOver ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragOver ? "Drop files here" : "Drag & drop files, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, GIF, WebP, PDF, DOCX, XLSX · Max 10 MB each
          </p>
        </motion.div>
      </div>

      {/* Upload Queue */}
      <AnimatePresence>
        {queue.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                item.error
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                {item.error ? (
                  <p className="text-xs text-destructive">{item.error}</p>
                ) : (
                  <Progress value={item.progress} className="h-1 mt-1.5" />
                )}
              </div>
              {item.error && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setQueue((prev) => prev.filter((i) => i.id !== item.id))
                  }
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* File List */}
      {fileList.length === 0 && queue.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Paperclip className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No attachments yet</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {fileList.map((attachment) => (
              <FileCard
                key={attachment.id}
                attachment={attachment}
                canDelete={canDelete(attachment)}
                onDelete={handleDelete}
                isDeleting={deletingId === attachment.id}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
