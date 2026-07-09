/**
 * useThreads Hook
 * 
 * Manages threaded conversations and reply counts.
 * 
 * Requirements:
 * - 5.1: Create thread attached to parent message
 * - 5.2: Display thread reply count
 * - 5.3: Display all replies in chronological order
 * - 5.5: Notify thread participants
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ThreadReply {
  id: string;
  channel_id: string;
  thread_parent_id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  user?: any;
  attachments?: any[];
  reactions?: any[];
}

export const useThreads = (channelId?: string) => {
  const queryClient = useQueryClient();

  // Fetch thread reply counts for all messages in a channel
  const { data: threadCounts = {} } = useQuery({
    queryKey: ["thread-counts", channelId],
    queryFn: async () => {
      if (!channelId) return {};

      const { data, error } = await supabase
        .from("messages")
        .select("thread_parent_id")
        .eq("channel_id", channelId)
        .not("thread_parent_id", "is", null);

      if (error) throw error;

      // Count replies per parent
      const counts: Record<string, number> = {};
      data.forEach((msg) => {
        if (msg.thread_parent_id) {
          counts[msg.thread_parent_id] = (counts[msg.thread_parent_id] || 0) + 1;
        }
      });

      return counts;
    },
    enabled: !!channelId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch thread replies for a specific message
  const fetchThreadReplies = async (parentMessageId: string): Promise<ThreadReply[]> => {
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
      .eq("thread_parent_id", parentMessageId)
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
  };

  // Send reply to thread
  const sendThreadReply = useMutation({
    mutationFn: async ({
      parentMessageId,
      channelId,
      content,
    }: {
      parentMessageId: string;
      channelId: string;
      content: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messages")
        .insert({
          channel_id: channelId,
          thread_parent_id: parentMessageId,
          user_id: user.id,
          content,
        })
        .select(
          `
          *,
          user:user_id (
            id,
            full_name,
            profile_picture_url,
            role,
            designation
          )
        `
        )
        .single();

      if (error) throw error;

      // Get thread participants for notifications
      const { data: participants } = await supabase
        .from("messages")
        .select("user_id")
        .or(`id.eq.${parentMessageId},thread_parent_id.eq.${parentMessageId}`)
        .neq("user_id", user.id);

      // Send notifications to thread participants
      if (participants && participants.length > 0) {
        const uniqueParticipants = [
          ...new Set(participants.map((p) => p.user_id)),
        ];

        await supabase.from("notifications").insert(
          uniqueParticipants.map((userId) => ({
            user_id: userId,
            type: "info",
            category: "communication",
            entity_type: "channel",
            entity_id: channelId,
            title: "New thread reply",
            message: `${user.user_metadata?.full_name || "Someone"} replied to a thread you're in`,
            action_url: `/communication?channel=${channelId}&thread=${parentMessageId}`,
            metadata: {
              channel_id: channelId,
              thread_parent_id: parentMessageId,
              message_id: data.id,
            },
          }))
        );
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate thread replies query
      queryClient.invalidateQueries({
        queryKey: ["thread-replies", variables.parentMessageId],
      });

      // Invalidate thread counts
      queryClient.invalidateQueries({
        queryKey: ["thread-counts", variables.channelId],
      });

      // Invalidate messages to update reply count
      queryClient.invalidateQueries({
        queryKey: ["messages", variables.channelId],
      });
    },
  });

  return {
    threadCounts,
    fetchThreadReplies,
    sendThreadReply: sendThreadReply.mutate,
    isSendingReply: sendThreadReply.isPending,
  };
};
