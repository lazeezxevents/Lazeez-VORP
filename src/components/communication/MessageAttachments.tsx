/**
 * MessageAttachments Component
 * 
 * Displays file attachments with appropriate previews and download options.
 * 
 * Requirements:
 * - 7.4: Display inline image previews
 * - 7.5: Display video player for videos
 * - 7.6: Display download link with metadata for documents
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  thumbnail_url?: string | null;
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export const MessageAttachments = ({
  attachments,
}: MessageAttachmentsProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return ImageIcon;
    if (fileType.startsWith("video/")) return Video;
    if (fileType.includes("pdf") || fileType.includes("document"))
      return FileText;
    return File;
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-2 space-y-2">
        {attachments.map((attachment) => {
          const isImage = attachment.file_type.startsWith("image/");
          const isVideo = attachment.file_type.startsWith("video/");
          const FileIcon = getFileIcon(attachment.file_type);

          // Image preview
          if (isImage) {
            return (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group max-w-sm"
              >
                <img
                  src={attachment.thumbnail_url || attachment.file_url}
                  alt={attachment.file_name}
                  className="rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImage(attachment.file_url)}
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={() => setSelectedImage(attachment.file_url)}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      handleDownload(
                        attachment.file_url,
                        attachment.file_name
                      )
                    }
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {attachment.file_name} •{" "}
                  {formatFileSize(attachment.file_size)}
                </p>
              </motion.div>
            );
          }

          // Video player
          if (isVideo) {
            return (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-sm"
              >
                <video
                  controls
                  className="w-full rounded-lg border border-border"
                  preload="metadata"
                >
                  <source src={attachment.file_url} type={attachment.file_type} />
                  Your browser does not support the video tag.
                </video>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">
                    {attachment.file_name} •{" "}
                    {formatFileSize(attachment.file_size)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() =>
                      handleDownload(
                        attachment.file_url,
                        attachment.file_name
                      )
                    }
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
              </motion.div>
            );
          }

          // Document/file download
          return (
            <motion.div
              key={attachment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-accent/50 hover:bg-accent transition-colors max-w-sm"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded bg-muted flex items-center justify-center">
                <FileIcon className="w-5 h-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {attachment.file_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </p>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() =>
                  handleDownload(attachment.file_url, attachment.file_name)
                }
              >
                <Download className="w-4 h-4" />
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full size preview"
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
