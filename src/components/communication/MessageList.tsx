import { useEffect, useRef, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/components/lib/utils";

// Types
interface User {
  id: string;
  full_name: string;
  profile_picture_url?: string | null;
  role?: string;
  designation?: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  thumbnail_url?: string | null;
}

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

interface Message {
  id: string;
  channel_id: string;
  thread_parent_id?: string | null;
  user_id: string;
  content: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  user: User;
  attachments?: Attachment[];
  reactions?: Reaction[];
  reply_count?: number;
}

interface MessageGroup {
  date: string;
  messages: Message[];
}

interface MessageListProps {
  messages?: Message[];
  currentUserId?: string;
  channelId?: string;
  lastReadMessageId?: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMessageClick?: (messageId: string) => void;
  onReactionAdd?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (messageId: string) => void;
  className?: string;
}

/**
 * MessageList - Virtualized message list component with lazy loading
 * 
 * Features:
 * - Virtualized scrolling using @tanstack/react-virtual
 * - Lazy loading with infinite scroll (50 messages per batch)
 * - Message grouping by date and user
 * - Smooth scroll to bottom on new messages
 * - Unread separator line
 * - Framer Motion animations
 * 
 * Requirements: 21.1, 21.2, 21.3, 35.3
 */
export const MessageList = ({
  messages = [],
  currentUserId,
  channelId,
  lastReadMessageId,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onMessageClick,
  onReactionAdd,
  onThreadOpen,
  className,
}: MessageListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const previousMessageCountRef = useRef(messages.length);

  // Group messages by date and consecutive user
  const groupedMessages = useMemo(() => {
    return groupMessagesByDateAndUser(messages);
  }, [messages]);

  // Flatten grouped messages for virtualization
  const flattenedItems = useMemo(() => {
    const items: Array<{ type: "date" | "message" | "unread"; data: any; id: string }> = [];
    let unreadInserted = false;

    groupedMessages.forEach((group) => {
      // Add date separator
      items.push({
        type: "date",
        data: group.date,
        id: `date-${group.date}`,
      });

      group.messages.forEach((message, index) => {
        // Insert unread separator before the first unread message
        if (
          !unreadInserted &&
          lastReadMessageId &&
          shouldShowUnreadSeparator(message.id, lastReadMessageId, messages)
        ) {
          items.push({
            type: "unread",
            data: null,
            id: `unread-separator`,
          });
          unreadInserted = true;
        }

        items.push({
          type: "message",
          data: { message, isGrouped: index > 0 },
          id: message.id,
        });
      });
    });

    return items;
  }, [groupedMessages, lastReadMessageId, messages]);

  // Virtualization setup
  const rowVirtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated message height
    overscan: 10, // Render 10 items above/below viewport
  });

  // Handle scroll events
  const handleScroll = () => {
    if (!parentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show scroll button when not near bottom
    setShowScrollButton(distanceFromBottom > 200);
    setIsNearBottom(distanceFromBottom < 100);

    // Load more when scrolling to top
    if (scrollTop < 100 && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  };

  // Scroll to bottom on new messages (if near bottom)
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current && isNearBottom) {
      scrollToBottom("smooth");
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  // Scroll to bottom function
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    if (parentRef.current && typeof parentRef.current.scrollTo === "function") {
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior,
      });
    }
  };

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      scrollToBottom("auto");
    }
  }, [channelId]); // Only on channel change

  return (
    <div className={cn("relative flex flex-col h-full", className)}>
      {/* Scrollable message area */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ contain: "strict" }}
      >
        {/* Loading indicator at top */}
        {isLoading && hasMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Virtualized list */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const item = flattenedItems[virtualItem.index];

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {item.type === "date" && <DateSeparator date={item.data} />}
                {item.type === "unread" && <UnreadSeparator />}
                {item.type === "message" && (
                  <MessageItem
                    message={item.data.message}
                    isGrouped={item.data.isGrouped}
                    isCurrentUser={item.data.message.user_id === currentUserId}
                    onMessageClick={onMessageClick}
                    onReactionAdd={onReactionAdd}
                    onThreadOpen={onThreadOpen}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Be the first to send a message</p>
            </div>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 right-4"
          >
            <Button
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full shadow-lg"
              onClick={() => scrollToBottom("smooth")}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * DateSeparator - Visual separator showing the date
 */
const DateSeparator = ({ date }: { date: string }) => {
  const formattedDate = formatDateSeparator(date);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground">{formattedDate}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

/**
 * UnreadSeparator - Visual separator for unread messages
 */
const UnreadSeparator = () => {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-destructive" />
      <Badge variant="destructive" className="text-xs font-medium">
        New messages
      </Badge>
      <div className="flex-1 h-px bg-destructive" />
    </div>
  );
};

/**
 * MessageItem - Individual message component
 */
interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  isCurrentUser: boolean;
  onMessageClick?: (messageId: string) => void;
  onReactionAdd?: (messageId: string, emoji: string) => void;
  onThreadOpen?: (messageId: string) => void;
}

const MessageItem = ({
  message,
  isGrouped,
  isCurrentUser,
  onMessageClick,
  onReactionAdd,
  onThreadOpen,
}: MessageItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    onMessageClick?.(message.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group px-4 py-1 hover:bg-accent/50 transition-colors",
        isGrouped ? "py-0.5" : "py-2"
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {/* Avatar (only show for first message in group) */}
        {!isGrouped && (
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={message.user.profile_picture_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(message.user.full_name)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Spacer for grouped messages */}
        {isGrouped && <div className="w-9 flex-shrink-0" />}

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Header (only show for first message in group) */}
          {!isGrouped && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm">{message.user.full_name}</span>
              {message.user.role && (
                <Badge variant="outline" className="text-xs h-4 px-1">
                  {message.user.role}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatMessageTime(message.created_at)}
              </span>
              {message.edited_at && (
                <span className="text-xs text-muted-foreground italic">(edited)</span>
              )}
            </div>
          )}

          {/* Message text */}
          {message.deleted_at ? (
            <p className="text-sm text-muted-foreground italic">Message deleted</p>
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentPreview key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map((reaction) => (
                <Button
                  key={reaction.emoji}
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReactionAdd?.(message.id, reaction.emoji);
                  }}
                >
                  <span className="mr-1">{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {message.reply_count && message.reply_count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 mt-1 text-xs text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onThreadOpen?.(message.id);
              }}
            >
              {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * AttachmentPreview - Preview for file attachments
 */
const AttachmentPreview = ({ attachment }: { attachment: Attachment }) => {
  const isImage = attachment.file_type.startsWith("image/");

  if (isImage) {
    return (
      <div className="max-w-sm">
        <img
          src={attachment.thumbnail_url || attachment.file_url}
          alt={attachment.file_name}
          className="rounded border border-border max-h-64 object-cover"
        />
      </div>
    );
  }

  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded border border-border hover:bg-accent/50 transition-colors max-w-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.file_size)}
        </p>
      </div>
    </a>
  );
};

// Helper functions

/**
 * Group messages by date and consecutive user
 */
function groupMessagesByDateAndUser(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;
  let lastUserId: string | null = null;
  let lastDate: string | null = null;

  messages.forEach((message) => {
    const messageDate = format(new Date(message.created_at), "yyyy-MM-dd");

    // Start new group if date changes
    if (messageDate !== lastDate) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        date: messageDate,
        messages: [],
      };
      lastDate = messageDate;
      lastUserId = null;
    }

    // Add message to current group
    if (currentGroup) {
      currentGroup.messages.push(message);
      lastUserId = message.user_id;
    }
  });

  // Add final group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Format date separator text
 */
function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);

  if (isToday(date)) {
    return "Today";
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return format(date, "MMMM d, yyyy");
}

/**
 * Format message timestamp
 */
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return format(date, "h:mm a");
  }

  return format(date, "MMM d, h:mm a");
}

/**
 * Get user initials from full name
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Determine if unread separator should be shown before this message
 */
function shouldShowUnreadSeparator(
  messageId: string,
  lastReadMessageId: string,
  allMessages: Message[]
): boolean {
  const messageIndex = allMessages.findIndex((m) => m.id === messageId);
  const lastReadIndex = allMessages.findIndex((m) => m.id === lastReadMessageId);

  // Show separator before the first unread message
  return messageIndex === lastReadIndex + 1;
}
