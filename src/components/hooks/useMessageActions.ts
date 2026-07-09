/**
 * useMessageActions Hook
 * 
 * Provides message editing and deletion functionality.
 * 
 * Requirements:
 * - 12.1: Display edit/delete buttons for message authors
 * - 12.2: Update message content with "edited" indicator
 * - 12.3: Display "message deleted" placeholder
 * - 12.5: 24-hour edit window
 * - 12.6: Allow deletion at any time
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageService } from "@/services/MessageService";
import { WebSocketClient, MessageType } from "@/lib/websocket/client";
import { toast } from "sonner";

interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export const useMessageActions = (wsClient?: WebSocketClient) => {
  const queryClient = useQueryClient();

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: MessageService.editMessage,
    onMutate: async ({ messageId, content }) => {
      // Find the channel_id from cache
      let channelId: string | null = null;
      const queryCache = queryClient.getQueryCache();
      
      queryCache.findAll({ queryKey: ["messages"] }).forEach((query) => {
        const messages = query.state.data as Message[] | undefined;
        const message = messages?.find((m) => m.id === messageId);
        if (message) {
          channelId = message.channel_id;
        }
      });

      if (!channelId) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", channelId],
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        channelId,
      ]);

      // Optimistically update
      queryClient.setQueryData<Message[]>(
        ["messages", channelId],
        (old = []) =>
          old.map((msg) =>
            msg.id === messageId
              ? { ...msg, content, edited_at: new Date().toISOString() }
              : msg
          )
      );

      return { previousMessages, channelId };
    },
    onSuccess: (data, variables, context) => {
      if (!context?.channelId) return;

      // Send WebSocket event for real-time update
      if (wsClient && wsClient.isConnected()) {
        wsClient.send({
          type: MessageType.MESSAGE_EDITED,
          payload: {
            id: variables.messageId,
            channel_id: context.channelId,
            content: variables.content,
            edited_at: data.edited_at,
          },
        });
      }

      toast.success("Message edited");
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages && context?.channelId) {
        queryClient.setQueryData(
          ["messages", context.channelId],
          context.previousMessages
        );
      }

      console.error("Failed to edit message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to edit message");
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: MessageService.deleteMessage,
    onMutate: async ({ messageId }) => {
      // Find the channel_id from cache
      let channelId: string | null = null;
      const queryCache = queryClient.getQueryCache();
      
      queryCache.findAll({ queryKey: ["messages"] }).forEach((query) => {
        const messages = query.state.data as Message[] | undefined;
        const message = messages?.find((m) => m.id === messageId);
        if (message) {
          channelId = message.channel_id;
        }
      });

      if (!channelId) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["messages", channelId],
      });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<Message[]>([
        "messages",
        channelId,
      ]);

      // Optimistically update
      queryClient.setQueryData<Message[]>(
        ["messages", channelId],
        (old = []) =>
          old.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  deleted_at: new Date().toISOString(),
                  content: "",
                }
              : msg
          )
      );

      return { previousMessages, channelId };
    },
    onSuccess: (data, variables, context) => {
      if (!context?.channelId) return;

      // Send WebSocket event for real-time update
      if (wsClient && wsClient.isConnected()) {
        wsClient.send({
          type: MessageType.MESSAGE_DELETED,
          payload: {
            id: variables.messageId,
            channel_id: context.channelId,
            deleted_at: data.deleted_at,
          },
        });
      }

      toast.success("Message deleted");
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages && context?.channelId) {
        queryClient.setQueryData(
          ["messages", context.channelId],
          context.previousMessages
        );
      }

      console.error("Failed to delete message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete message");
    },
  });

  return {
    editMessage: editMessageMutation.mutate,
    deleteMessage: deleteMessageMutation.mutate,
    isEditing: editMessageMutation.isPending,
    isDeleting: deleteMessageMutation.isPending,
  };
};
