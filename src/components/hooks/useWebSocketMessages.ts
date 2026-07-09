/**
 * useWebSocketMessages Hook
 * 
 * Handles incoming WebSocket messages and updates the query cache in real-time.
 * 
 * Requirements:
 * - 1.1: Deliver messages within 200ms
 * - 1.2: Display new messages immediately without page refresh
 * - 12.2: Update message content on edit
 * - 12.3: Display "message deleted" placeholder
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WebSocketClient, MessageType, WebSocketMessage } from "@/lib/websocket/client";

interface Message {
  id: string;
  channel_id: string;
  thread_parent_id?: string | null;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  attachments?: any[];
  reactions?: any[];
  reply_count?: number;
  user?: any;
}

export const useWebSocketMessages = (wsClient?: WebSocketClient) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!wsClient) return;

    // Handle new message
    const handleNewMessage = (message: WebSocketMessage) => {
      const newMessage = message.payload as Message;

      // Update messages cache
      queryClient.setQueryData<Message[]>(
        ["messages", newMessage.channel_id],
        (old = []) => {
          // Check if message already exists (avoid duplicates)
          const exists = old.some((msg) => msg.id === newMessage.id);
          if (exists) return old;

          return [...old, newMessage];
        }
      );

      // Invalidate channel list to update unread counts
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    };

    // Handle message edit
    const handleMessageEdited = (message: WebSocketMessage) => {
      const { id, channel_id, content, edited_at } = message.payload;

      queryClient.setQueryData<Message[]>(
        ["messages", channel_id],
        (old = []) =>
          old.map((msg) =>
            msg.id === id
              ? { ...msg, content, edited_at }
              : msg
          )
      );
    };

    // Handle message deletion
    const handleMessageDeleted = (message: WebSocketMessage) => {
      const { id, channel_id, deleted_at } = message.payload;

      queryClient.setQueryData<Message[]>(
        ["messages", channel_id],
        (old = []) =>
          old.map((msg) =>
            msg.id === id
              ? { ...msg, deleted_at, content: "" }
              : msg
          )
      );
    };

    // Handle reaction added
    const handleReactionAdded = (message: WebSocketMessage) => {
      const { message_id, channel_id, user_id, emoji } = message.payload;

      queryClient.setQueryData<Message[]>(
        ["messages", channel_id],
        (old = []) =>
          old.map((msg) => {
            if (msg.id === message_id) {
              const reactions = msg.reactions || [];
              const existingReaction = reactions.find(
                (r: any) => r.emoji === emoji
              );

              if (existingReaction) {
                // Add user to existing reaction
                return {
                  ...msg,
                  reactions: reactions.map((r: any) =>
                    r.emoji === emoji
                      ? {
                          ...r,
                          count: r.count + 1,
                          user_ids: [...r.user_ids, user_id],
                        }
                      : r
                  ),
                };
              } else {
                // Create new reaction
                return {
                  ...msg,
                  reactions: [
                    ...reactions,
                    { emoji, count: 1, user_ids: [user_id] },
                  ],
                };
              }
            }
            return msg;
          })
      );
    };

    // Handle reaction removed
    const handleReactionRemoved = (message: WebSocketMessage) => {
      const { message_id, channel_id, user_id, emoji } = message.payload;

      queryClient.setQueryData<Message[]>(
        ["messages", channel_id],
        (old = []) =>
          old.map((msg) => {
            if (msg.id === message_id) {
              const reactions = msg.reactions || [];
              return {
                ...msg,
                reactions: reactions
                  .map((r: any) => {
                    if (r.emoji === emoji) {
                      const newUserIds = r.user_ids.filter(
                        (uid: string) => uid !== user_id
                      );
                      return {
                        ...r,
                        count: newUserIds.length,
                        user_ids: newUserIds,
                      };
                    }
                    return r;
                  })
                  .filter((r: any) => r.count > 0),
              };
            }
            return msg;
          })
      );
    };

    // Register event handlers
    wsClient.on(MessageType.MESSAGE_NEW, handleNewMessage);
    wsClient.on(MessageType.MESSAGE_EDITED, handleMessageEdited);
    wsClient.on(MessageType.MESSAGE_DELETED, handleMessageDeleted);
    wsClient.on(MessageType.REACTION_ADDED, handleReactionAdded);
    wsClient.on(MessageType.REACTION_REMOVED, handleReactionRemoved);

    // Cleanup
    return () => {
      wsClient.off(MessageType.MESSAGE_NEW, handleNewMessage);
      wsClient.off(MessageType.MESSAGE_EDITED, handleMessageEdited);
      wsClient.off(MessageType.MESSAGE_DELETED, handleMessageDeleted);
      wsClient.off(MessageType.REACTION_ADDED, handleReactionAdded);
      wsClient.off(MessageType.REACTION_REMOVED, handleReactionRemoved);
    };
  }, [wsClient, queryClient]);
};
