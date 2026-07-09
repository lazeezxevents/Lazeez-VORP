/**
 * EmojiReactions Component
 * 
 * Displays and manages emoji reactions on messages.
 * 
 * Requirements:
 * - 8.1: Display reaction button on hover
 * - 8.2: Show emoji picker
 * - 8.3: Add reaction to message
 * - 8.4: Display reaction counts grouped by emoji
 * - 8.5: Toggle reaction on/off
 * - 8.6: Show list of users who reacted
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

interface EmojiReactionsProps {
  messageId: string;
  channelId: string;
  reactions: Reaction[];
  currentUserId: string;
  onReactionChange?: () => void;
}

// Common emoji set
const COMMON_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🎉",
  "🚀",
  "👀",
  "🔥",
  "✅",
  "❌",
  "💯",
  "🙏",
  "💪",
  "🤔",
  "👏",
];

export const EmojiReactions = ({
  messageId,
  channelId,
  reactions,
  currentUserId,
  onReactionChange,
}: EmojiReactionsProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const queryClient = useQueryClient();

  // Add reaction mutation
  const addReactionMutation = useMutation({
    mutationFn: async (emoji: string) => {
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: messageId,
          user_id: currentUserId,
          emoji,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      onReactionChange?.();
    },
    onError: (error: any) => {
      if (error.code === "23505") {
        // Duplicate key - user already reacted with this emoji
        toast.error("You already reacted with this emoji");
      } else {
        toast.error("Failed to add reaction");
      }
    },
  });

  // Remove reaction mutation
  const removeReactionMutation = useMutation({
    mutationFn: async (emoji: string) => {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      onReactionChange?.();
    },
    onError: () => {
      toast.error("Failed to remove reaction");
    },
  });

  const handleEmojiClick = (emoji: string) => {
    const existingReaction = reactions.find((r) => r.emoji === emoji);
    const userHasReacted = existingReaction?.user_ids.includes(currentUserId);

    if (userHasReacted) {
      removeReactionMutation.mutate(emoji);
    } else {
      addReactionMutation.mutate(emoji);
    }

    setShowPicker(false);
  };

  const getUserNames = async (userIds: string[]): Promise<string[]> => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .in("id", userIds);

    return data?.map((p) => p.full_name) || [];
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Existing Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => {
          const userHasReacted = reaction.user_ids.includes(currentUserId);

          return (
            <TooltipProvider key={reaction.emoji}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEmojiClick(reaction.emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                      userHasReacted
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-accent hover:bg-accent/80 border border-border"
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="font-medium">{reaction.count}</span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {reaction.user_ids.length === 1
                      ? "1 person reacted"
                      : `${reaction.user_ids.length} people reacted`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </AnimatePresence>

      {/* Add Reaction Button */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid grid-cols-8 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-accent rounded transition-colors"
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
