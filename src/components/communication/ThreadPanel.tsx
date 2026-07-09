/**
 * ThreadPanel Component
 * 
 * Displays threaded conversations with slide-in animation.
 * 
 * Requirements:
 * - 5.1: Create thread attached to parent message
 * - 5.2: Display thread reply count on parent
 * - 5.3: Display all replies in chronological order
 * - 5.5: Notify thread participants
 * - 5.6: Display thread indicator icon
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageComposer } from "./MessageComposer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/components/lib/utils";

interface Message {
  id: string;
  channel_id: string;
  thread_parent_id?: string | null;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  user?: {
    id: string;
    full_name: string;
    profile_picture_url?: string | null;
    role: string;
    designation: string;
  };
  attachments?: any[];
  reactions?: any[];
  reply_count?: number;
}

interface ThreadPanelProps {
  parentMessage: Message;
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (content: string, attachments: File[]) => Promise<void>;
  className?: string;
}

/**
 * ThreadPanel - Threaded conversation side panel
 * 
 * Features:
 * - Slide-in animation from right
 * - Display parent message context
 * - Show all thread replies
 * - Reply composer at bottom
 * - Real-time updates via WebSocket
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
 */
export const ThreadPanel = ({
  parentMessage,
  isOpen,
  onClose,
  onSendMessage,
  className,
}: ThreadPanelProps) => {
  const [localReplies, setLocalReplies] = useState<Message[]>([]);

  // Fetch thread replies
  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["thread-replies", parentMessage.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          user:user_id (
            id,
            full_name,
            profile_picture_url,
            role,
            designation
          ),
          attachments:message_attachments (*),
          reactions:message_reactions (
            emoji,
            user_id
          )
        `
        )
        .eq("thread_parent_id", parentMessage.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group reactions by emoji
      return data.map((msg: any) => ({
        ...msg,
        reactions: msg.reactions.reduce((acc: any[], reaction: any) => {
          const existing = acc.find((r) => r.emoji === reaction.emoji);
          if (existing) {
            existing.count++;
            existing.user_ids.push(reaction.user_id);
          } else {
            acc.push({
              emoji: reaction.emoji,
              count: 1,
              user_ids: [reaction.user_id],
            });
          }
          return acc;
        }, []),
      }));
    },
    enabled: isOpen,
    refetchInterval: 5000, // Poll every 5 seconds for new replies
  });

  useEffect(() => {
    setLocalReplies(replies);
  }, [replies]);

  // Handle send reply
  const handleSendReply = async (content: string, attachments: File[]) => {
    if (onSendMessage) {
      await onSendMessage(content, attachments);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed right-0 top-0 bottom-0 w-full md:w-[500px] bg-background border-l shadow-2xl z-50 flex flex-col",
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Thread</h3>
                  <p className="text-xs text-muted-foreground">
                    {localReplies.length} {localReplies.length === 1 ? "reply" : "replies"}
                  </p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Parent message */}
            <div className="p-4 bg-muted/30">
              <div className="flex gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                  {parentMessage.user?.profile_picture_url ? (
                    <img
                      src={parentMessage.user.profile_picture_url}
                      alt={parentMessage.user.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {parentMessage.user?.full_name?.charAt(0) || "?"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {parentMessage.user?.full_name || "Unknown User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(parentMessage.created_at)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {parentMessage.content}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Thread replies */}
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : localReplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No replies yet</p>
                  <p className="text-sm">Be the first to reply</p>
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                      },
                    },
                  }}
                  className="space-y-4"
                >
                  {localReplies.map((reply) => (
                    <motion.div
                      key={reply.id}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 },
                      }}
                      className="flex gap-3"
                    >
                      {/* Avatar */}
                      <div className="shrink-0">
                        {reply.user?.profile_picture_url ? (
                          <img
                            src={reply.user.profile_picture_url}
                            alt={reply.user.full_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {reply.user?.full_name?.charAt(0) || "?"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {reply.user?.full_name || "Unknown User"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(reply.created_at)}
                          </span>
                          {reply.edited_at && (
                            <span className="text-xs text-muted-foreground italic">
                              (edited)
                            </span>
                          )}
                        </div>

                        {reply.deleted_at ? (
                          <p className="text-sm text-muted-foreground italic">
                            Message deleted
                          </p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {reply.content}
                          </p>
                        )}

                        {/* Reactions */}
                        {reply.reactions && reply.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {reply.reactions.map((reaction: any) => (
                              <div
                                key={reaction.emoji}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                              >
                                <span>{reaction.emoji}</span>
                                <span className="text-muted-foreground">
                                  {reaction.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </ScrollArea>

            {/* Reply composer */}
            <MessageComposer
              channelId={parentMessage.channel_id}
              threadParentId={parentMessage.id}
              placeholder="Reply to thread..."
              onSendMessage={handleSendReply}
              className="border-t"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
