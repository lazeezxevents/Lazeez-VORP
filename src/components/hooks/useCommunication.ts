import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { realtimeService, Message } from '@/services/SupabaseRealtimeService';
import { useEffect, useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { debounce, throttle } from '@/components/utils/debounce';
import { presenceManager } from '@/components/communication/presence/PresenceManager';

interface OptimisticMessage extends Message {
  _optimistic?: boolean;
  _failed?: boolean;
  _sending?: boolean;
}

interface UseCommunicationOptions {
  channelId: string;
  enabled?: boolean;
}

/**
 * Custom hook for communication with optimistic UI updates
 * Provides real-time messaging with instant feedback
 */
export const useCommunication = ({ channelId, enabled = true }: UseCommunicationOptions) => {
  const queryClient = useQueryClient();
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);
  const presenceChannelRef = useRef<string | null>(null);
  const presenceStartedRef = useRef(false);

  // Query key for messages
  const messagesKey = ['messages', channelId];

  // Fetch messages
  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: messagesKey,
    queryFn: () => realtimeService.fetchMessages(channelId, 50),
    enabled: enabled && !!channelId,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!enabled || !channelId) return;

    const channel = realtimeService.subscribeToChannel(channelId, {
      onMessage: (message) => {
        // Add new message to cache
        queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) => {
          // Remove optimistic version if exists
          const filtered = old.filter(
            (m) => !(m._optimistic && m.content === message.content)
          );
          return [...filtered, message];
        });
      },
      onMessageEdit: (message) => {
        // Update edited message in cache
        queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
          old.map((m) => (m.id === message.id ? message : m))
        );
      },
      onMessageDelete: (messageId) => {
        // Mark message as deleted in cache
        queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
          old.map((m) =>
            m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
          )
        );
      },
      onTyping: (typing) => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (typing.isTyping) {
            next.set(typing.userId, typing.userName);
            // Auto-clear after 3 seconds
            setTimeout(() => {
              setTypingUsers((current) => {
                const updated = new Map(current);
                updated.delete(typing.userId);
                return updated;
              });
            }, 3000);
          } else {
            next.delete(typing.userId);
          }
          return next;
        });
      },
      onPresence: (presence) => {
        setPresenceUsers(presence);
      },
      onReaction: ({ messageId, emoji, userId, action }) => {
        // Update reaction in cache instantly
        queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
          old.map((m) => {
            if (m.id !== messageId) return m;

            const reactions = m.reactions || [];
            const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);

            if (action === 'add') {
              if (reactionIndex >= 0) {
                // Add user to existing reaction
                reactions[reactionIndex] = {
                  ...reactions[reactionIndex],
                  count: reactions[reactionIndex].count + 1,
                  user_ids: [...reactions[reactionIndex].user_ids, userId],
                };
              } else {
                // Create new reaction
                reactions.push({
                  emoji,
                  count: 1,
                  user_ids: [userId],
                });
              }
            } else if (action === 'remove') {
              if (reactionIndex >= 0) {
                const userIds = reactions[reactionIndex].user_ids.filter(
                  (id) => id !== userId
                );
                if (userIds.length === 0) {
                  // Remove reaction entirely
                  reactions.splice(reactionIndex, 1);
                } else {
                  // Update reaction
                  reactions[reactionIndex] = {
                    ...reactions[reactionIndex],
                    count: userIds.length,
                    user_ids: userIds,
                  };
                }
              }
            }

            return { ...m, reactions };
          })
        );
      },
    });

    return () => {
      realtimeService.unsubscribeFromChannel(channelId);
    };
  }, [channelId, enabled, queryClient, messagesKey]);

  useEffect(() => {
    presenceChannelRef.current = channelId || null;
    if (channelId && presenceStartedRef.current) {
      const presence = presenceManager.getPresence();
      realtimeService.updatePresence(channelId, presence.status, presence.customStatus);
    }
  }, [channelId]);

  useEffect(() => {
    if (!enabled) return;

    if (!presenceStartedRef.current) {
      presenceManager.onPresenceChange((presence) => {
        const activeChannelId = presenceChannelRef.current;
        if (!activeChannelId) return;
        realtimeService.updatePresence(activeChannelId, presence.status, presence.customStatus);
      });

      presenceManager.start();
      presenceStartedRef.current = true;
    }

    return () => {
      if (presenceStartedRef.current) {
        presenceManager.stop();
        presenceStartedRef.current = false;
      }
    };
  }, [enabled]);

  // Send message mutation with optimistic update
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      threadParentId,
      attachments,
    }: {
      content: string;
      threadParentId?: string;
      attachments?: File[];
    }) => {
      return realtimeService.sendMessage(channelId, content, threadParentId, attachments);
    },
    onMutate: async ({ content, threadParentId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesKey });

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData<OptimisticMessage[]>(messagesKey);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, profile_picture_url, main_role, designation')
        .eq('id', user?.id || '')
        .single();

      // Optimistically add message
      const optimisticMessage: OptimisticMessage = {
        id: `temp-${uuidv4()}`,
        channel_id: channelId,
        user_id: user?.id || '',
        content,
        created_at: new Date().toISOString(),
        thread_parent_id: threadParentId,
        user: profile || undefined,
        _optimistic: true,
        _sending: true,
      };

      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) => [
        ...old,
        optimisticMessage,
      ]);

      return { previousMessages, optimisticMessage };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }

      // Mark optimistic message as failed
      if (context?.optimisticMessage) {
        queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
          old.map((m) =>
            m.id === context.optimisticMessage.id
              ? { ...m, _failed: true, _sending: false }
              : m
          )
        );
      }

      console.error('Failed to send message:', err);
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) => {
        const filtered = old.filter((m) => m.id !== context?.optimisticMessage.id);
        return data ? [...filtered, data] : filtered;
      });
    },
  });

  // Edit message mutation with optimistic update
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      return realtimeService.editMessage(messageId, content);
    },
    onMutate: async ({ messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages = queryClient.getQueryData<OptimisticMessage[]>(messagesKey);

      // Optimistically update message
      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
        old.map((m) =>
          m.id === messageId
            ? { ...m, content, edited_at: new Date().toISOString(), _optimistic: true }
            : m
        )
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }
      console.error('Failed to edit message:', err);
    },
  });

  // Delete message mutation with optimistic update
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return realtimeService.deleteMessage(messageId);
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages = queryClient.getQueryData<OptimisticMessage[]>(messagesKey);

      // Optimistically mark as deleted
      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
        old.map((m) =>
          m.id === messageId
            ? { ...m, deleted_at: new Date().toISOString(), _optimistic: true }
            : m
        )
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }
      console.error('Failed to delete message:', err);
    },
  });

  // Add reaction mutation with optimistic update
  const addReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return realtimeService.addReaction(messageId, emoji);
    },
    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages = queryClient.getQueryData<OptimisticMessage[]>(messagesKey);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { previousMessages };

      // Optimistically add reaction
      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
        old.map((m) => {
          if (m.id !== messageId) return m;

          const reactions = m.reactions || [];
          const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);

          if (reactionIndex >= 0) {
            reactions[reactionIndex] = {
              ...reactions[reactionIndex],
              count: reactions[reactionIndex].count + 1,
              user_ids: [...reactions[reactionIndex].user_ids, user.id],
            };
          } else {
            reactions.push({
              emoji,
              count: 1,
              user_ids: [user.id],
            });
          }

          return { ...m, reactions };
        })
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }
      console.error('Failed to add reaction:', err);
    },
  });

  // Remove reaction mutation with optimistic update
  const removeReactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      return realtimeService.removeReaction(messageId, emoji);
    },
    onMutate: async ({ messageId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages = queryClient.getQueryData<OptimisticMessage[]>(messagesKey);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { previousMessages };

      // Optimistically remove reaction
      queryClient.setQueryData<OptimisticMessage[]>(messagesKey, (old = []) =>
        old.map((m) => {
          if (m.id !== messageId) return m;

          const reactions = m.reactions || [];
          const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);

          if (reactionIndex >= 0) {
            const userIds = reactions[reactionIndex].user_ids.filter(
              (id) => id !== user.id
            );
            if (userIds.length === 0) {
              reactions.splice(reactionIndex, 1);
            } else {
              reactions[reactionIndex] = {
                ...reactions[reactionIndex],
                count: userIds.length,
                user_ids: userIds,
              };
            }
          }

          return { ...m, reactions };
        })
      );

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey, context.previousMessages);
      }
      console.error('Failed to remove reaction:', err);
    },
  });

  // Broadcast typing indicator (debounced to 1 per second)
  const broadcastTypingRef = useRef(
    throttle(async (isTyping: boolean) => {
      await realtimeService.broadcastTyping(channelId, isTyping);
    }, 1000)
  );

  const broadcastTyping = useCallback((isTyping: boolean) => {
    broadcastTypingRef.current(isTyping);
  }, []);

  // Update presence
  const updatePresence = async (
    status: 'online' | 'away' | 'dnd' | 'offline',
    customStatus?: string
  ) => {
    presenceManager.setStatus(status);
    if (customStatus !== undefined) {
      presenceManager.setCustomStatus(customStatus);
    }
  };

  const markAsRead = useCallback(async () => {
    await realtimeService.markChannelRead(channelId);
    await queryClient.invalidateQueries({ queryKey: ["channel-unread-map"] });
    await queryClient.invalidateQueries({ queryKey: ["channel-last-read", channelId] });
  }, [channelId, queryClient]);

  return {
    // Data
    messages: messages as OptimisticMessage[],
    isLoading,
    error,
    typingUsers: Array.from(typingUsers.values()),
    presenceUsers,

    // Mutations
    sendMessage: sendMessageMutation.mutate,
    sendMessageAsync: sendMessageMutation.mutateAsync,
    editMessage: editMessageMutation.mutate,
    deleteMessage: deleteMessageMutation.mutate,
    addReaction: addReactionMutation.mutate,
    removeReaction: removeReactionMutation.mutate,

    // Mutation states
    isSending: sendMessageMutation.isPending,
    isEditing: editMessageMutation.isPending,
    isDeleting: deleteMessageMutation.isPending,

    // Actions
    broadcastTyping,
    updatePresence,
    markAsRead,
  };
};
