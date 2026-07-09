import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Smile,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Strikethrough,
  X,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import { toast } from "sonner";
import { 
  sanitizeMessage, 
  validateMessageContent 
} from "./security/inputSanitization";
import {
  validateFiles,
  formatFileSize,
} from "./security/fileValidation";
import { RateLimiterService } from "@/services/RateLimiterService";
import { useAuth } from "@/contexts/AuthContext";

// Types
interface FilePreview {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "document" | "other";
}

interface MessageComposerProps {
  channelId?: string;
  channelName?: string;
  threadParentId?: string;
  placeholder?: string;
  onSendMessage?: (content: string, attachments: File[]) => Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  className?: string;
}

// Character limit
const MAX_CHARACTERS = 4000;
const SHOW_COUNTER_THRESHOLD = 3800;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Common emoji list
const COMMON_EMOJIS = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
  "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋",
  "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳",
  "👍", "👎", "👏", "🙌", "👋", "🤝", "💪", "🙏", "✨", "🎉",
  "🔥", "💯", "✅", "❌", "⚠️", "💡", "📌", "📍", "🚀", "⭐",
];

/**
 * MessageComposer - Rich text message composer component
 * 
 * Features:
 * - Multi-line text input (Shift+Enter for newline, Enter to send)
 * - Character counter approaching 4000 limit
 * - Markdown formatting toolbar (bold, italic, code)
 * - Emoji picker button
 * - File attachment button with drag-and-drop support
 * - File upload previews
 * - Draft auto-save to localStorage
 * - Input sanitization and XSS prevention (Requirements 20.1, 34.12)
 * 
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 42.1, 42.4, 20.1, 34.12
 */
export const MessageComposer = ({
  channelId,
  channelName,
  threadParentId,
  placeholder,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  className,
}: MessageComposerProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftKeyRef = useRef<string>("");

  // Generate draft key based on channel/thread
  useEffect(() => {
    if (channelId) {
      draftKeyRef.current = threadParentId
        ? `draft_thread_${threadParentId}`
        : `draft_channel_${channelId}`;
    }
  }, [channelId, threadParentId]);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (draftKeyRef.current) {
      const savedDraft = localStorage.getItem(draftKeyRef.current);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setContent(draft.content || "");
        } catch (error) {
          console.error("Failed to load draft:", error);
        }
      }
    }
  }, [draftKeyRef.current]);

  // Auto-save draft to localStorage (debounced)
  useEffect(() => {
    if (!draftKeyRef.current) return;

    const timeoutId = setTimeout(() => {
      if (content.trim()) {
        localStorage.setItem(
          draftKeyRef.current,
          JSON.stringify({ content, timestamp: Date.now() })
        );
      } else {
        localStorage.removeItem(draftKeyRef.current);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [content]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (onTypingStart) {
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) {
        onTypingStop();
      }
    }, 3000);
  }, [onTypingStart, onTypingStop]);

  // Handle content change
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // Enforce character limit
    if (newContent.length <= MAX_CHARACTERS) {
      setContent(newContent);
      handleTyping();
    }
  };

  // Handle key press (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      insertFormatting("**");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      insertFormatting("*");
    }
  };

  // Insert markdown formatting
  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText =
      content.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      content.substring(end);

    setContent(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const line = content.slice(lineStart, start);
    const already = line.trimStart().startsWith(prefix.trim());
    const add = already ? "" : prefix;
    const newText = content.slice(0, lineStart) + add + content.slice(lineStart);
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      const pos = lineStart + add.length + (start - lineStart);
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Insert emoji
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText =
      content.substring(0, start) + emoji + content.substring(start);

    setContent(newText);
    setIsEmojiPickerOpen(false);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || !user) return;

    // Check file upload rate limit (Requirement 20.5)
    const rateLimitResult = await RateLimiterService.checkFileUploadRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      const retrySeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
      toast.error(
        rateLimitResult.error || 'Rate limit exceeded',
        {
          description: `Please try again in ${retrySeconds} seconds.`,
          duration: 5000,
        }
      );
      return;
    }

    // Validate files (Requirements 20.6, 7.2, 7.3, 7.10)
    const fileArray = Array.from(files);
    const validation = validateFiles(fileArray);
    
    // Show validation errors
    if (validation.errors.length > 0) {
      validation.errors.forEach(error => {
        toast.error('File validation failed', {
          description: error,
          duration: 5000,
        });
      });
    }
    
    // Process valid files
    if (validation.validFiles.length > 0) {
      const newFiles: FilePreview[] = [];
      
      for (const file of validation.validFiles) {
        // Check file count limit
        if (attachments.length + newFiles.length >= MAX_FILES) {
          toast.error(`Maximum ${MAX_FILES} files allowed`);
          break;
        }

        // Determine file type
        let type: FilePreview["type"] = "other";
        if (file.type.startsWith("image/")) {
          type = "image";
        } else if (
          file.type.includes("pdf") ||
          file.type.includes("document") ||
          file.type.includes("text")
        ) {
          type = "document";
        }

        // Create preview for images
        const preview: FilePreview = {
          id: `${Date.now()}-${file.name}`,
          file,
          type,
        };

        if (type === "image") {
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.preview = e.target?.result as string;
            setAttachments((prev) => [...prev, preview]);
          };
          reader.readAsDataURL(file);
        } else {
          newFiles.push(preview);
        }
      }

      if (newFiles.length > 0) {
        setAttachments((prev) => [...prev, ...newFiles]);
      }
      
      // Show success message with security info
      if (validation.validFiles.length > 0) {
        const totalSize = validation.validFiles.reduce((sum, f) => sum + f.size, 0);
        toast.success('Files validated', {
          description: `${validation.validFiles.length} file(s) ready to upload (${formatFileSize(totalSize)})`,
          icon: <Shield className="w-4 h-4" />,
        });
      }
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // Handle send message
  const handleSend = async () => {
    const trimmedContent = content.trim();
    // Attachment-only: use neutral caption; still stored as text for non-empty DB field
    const hasFiles = attachments.length > 0;
    if (!trimmedContent && !hasFiles) {
      return;
    }

    if (!user) {
      toast.error("You must be logged in to send messages");
      return;
    }

    // Check message rate limit (Requirement 20.3, 20.4)
    const rateLimitResult = await RateLimiterService.checkMessageRateLimit(user.id);
    if (!rateLimitResult.allowed) {
      const retrySeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
      toast.error(
        rateLimitResult.error || 'You are sending messages too quickly',
        {
          description: `Please wait ${retrySeconds} seconds before sending another message.`,
          duration: 5000,
        }
      );
      return;
    }

    let sanitizedContent: string;
    if (trimmedContent) {
      const validation = validateMessageContent(trimmedContent);
      if (!validation.valid) {
        toast.error(validation.error || "Invalid message content");
        return;
      }
      sanitizedContent = sanitizeMessage(trimmedContent);
    } else if (hasFiles) {
      sanitizedContent = "Shared files";
    } else {
      return;
    }

    if (!onSendMessage) {
      toast.error("Send handler not configured");
      return;
    }

    setIsSending(true);

    try {
      
      const files = attachments.map((att) => att.file);
      await onSendMessage(sanitizedContent, files);

      // Clear composer
      setContent("");
      setAttachments([]);

      // Clear draft
      if (draftKeyRef.current) {
        localStorage.removeItem(draftKeyRef.current);
      }

      // Stop typing indicator
      if (onTypingStop) {
        onTypingStop();
      }

      toast.success("Message sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Get file icon
  const getFileIcon = (type: FilePreview["type"]) => {
    switch (type) {
      case "image":
        return ImageIcon;
      case "document":
        return FileText;
      default:
        return File;
    }
  };

  // Calculate character count display
  const showCharacterCount = content.length >= SHOW_COUNTER_THRESHOLD;
  const characterCountColor =
    content.length >= MAX_CHARACTERS
      ? "text-destructive"
      : content.length >= SHOW_COUNTER_THRESHOLD + 100
      ? "text-warning"
      : "text-muted-foreground";

  // Placeholder text
  const placeholderText =
    placeholder ||
    (channelName ? `Message #${channelName}` : "Type a message...");

  return (
    <div
      className={cn(
        "border-t bg-background p-4 space-y-3",
        isDragging && "bg-accent/50",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none"
          >
            <div className="text-center">
              <Paperclip className="w-12 h-12 mx-auto mb-2 text-primary" />
              <p className="font-medium text-primary">Drop files to attach</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File previews */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.type);
              return (
                <motion.div
                  key={attachment.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group"
                >
                  {attachment.type === "image" && attachment.preview ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAttachment(attachment.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted">
                      <FileIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium max-w-[120px] truncate">
                        {attachment.file.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-5 h-5 ml-1"
                        onClick={() => removeAttachment(attachment.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertFormatting("**")}
              aria-label="Bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Bold <span className="text-muted-foreground">(Ctrl+B)</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertFormatting("*")}
              aria-label="Italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            Italic <span className="text-muted-foreground">(Ctrl+I)</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertFormatting("`")}
              aria-label="Inline code"
            >
              <Code className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Inline code</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertFormatting("~~")}
              aria-label="Strikethrough"
            >
              <Strikethrough className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Strikethrough</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertLinePrefix("- ")}
              aria-label="Bulleted list"
            >
              <List className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Bulleted list</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              type="button"
              onClick={() => insertLinePrefix("1. ")}
              aria-label="Numbered list"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Numbered list</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Emoji picker */}
        <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8"
                  type="button"
                  aria-label="Add emoji"
                >
                  <Smile className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Emoji</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-80 p-2" align="start">
            <div className="grid grid-cols-10 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-xl"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* File attachment */}
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
        />

        {/* Character counter */}
        {showCharacterCount && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "ml-auto text-xs font-medium",
              characterCountColor
            )}
          >
            {content.length}/{MAX_CHARACTERS}
          </motion.span>
        )}
      </div>

      {/* Message input */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className="min-h-[80px] max-h-[200px] resize-none"
          disabled={isSending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={
            isSending || (!content.trim() && attachments.length === 0)
          }
          className="shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};