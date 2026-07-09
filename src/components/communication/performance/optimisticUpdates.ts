/**
 * Optimistic UI Updates
 * Task 12.3: Implement optimistic UI updates
 * Requirements: 21.6
 */

import { QueryClient } from '@tanstack/react-query';
import { CACHE_KEYS } from './caching';

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  user?: any;
  attachments?: any[];
  reactions?: any[];
  reply_count?: number;
}

export interface OptimisticMessage extends Omit<Message, 'id'> {
  id: string;
  _optimistic?: boolean;
  _status?: 'sending' | 'failed';
}

/**
 * Add optimistic message to cache
 */
export function addOptimisticMessage(
  queryClient: QueryClient,
  channelId: string,
  message: OptimisticMessage
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return [...old, { ...message, _optimistic: true, _status: 'sending' }];
  });
}

/**
 * Update optimistic message after successful send
 */
export function updateOptimisticMessage(
  queryClient: QueryClient,
  channelId: string,
  tempId: string,
  serverMessage: Message
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg => 
      msg.id === tempId ? serverMessage : msg
    );
  });
}

/**
 * Remove failed optimistic message
 */
export function removeOptimisticMessage(
  queryClient: QueryClient,
  channelId: string,
  tempId: string
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.filter(msg => msg.id !== tempId);
  });
}

/**
 * Mark optimistic message as failed
 */
export function markOptimisticMessageFailed(
  queryClient: QueryClient,
  channelId: string,
  tempId: string
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg => 
      msg.id === tempId 
        ? { ...msg, _status: 'failed' as const }
        : msg
    );
  });
}

/**
 * Add optimistic reaction
 */
export function addOptimisticReaction(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg => {
      if (msg.id !== messageId) return msg;

      const reactions = msg.reactions || [];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        // Add user to existing reaction
        return {
          ...msg,
          reactions: reactions.map(r =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, user_ids: [...r.user_ids, userId] }
              : r
          ),
        };
      } else {
        // Create new reaction
        return {
          ...msg,
          reactions: [
            ...reactions,
            { emoji, count: 1, user_ids: [userId] },
          ],
        };
      }
    });
  });
}

/**
 * Remove optimistic reaction
 */
export function removeOptimisticReaction(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg => {
      if (msg.id !== messageId) return msg;

      const reactions = msg.reactions || [];
      
      return {
        ...msg,
        reactions: reactions
          .map(r => {
            if (r.emoji !== emoji) return r;
            
            const newUserIds = r.user_ids.filter((id: string) => id !== userId);
            return {
              ...r,
              count: r.count - 1,
              user_ids: newUserIds,
            };
          })
          .filter(r => r.count > 0),
      };
    });
  });
}

/**
 * Update message optimistically (for edits)
 */
export function updateMessageOptimistically(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  updates: Partial<Message>
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg =>
      msg.id === messageId
        ? { ...msg, ...updates, edited_at: new Date().toISOString() }
        : msg
    );
  });
}

/**
 * Delete message optimistically
 */
export function deleteMessageOptimistically(
  queryClient: QueryClient,
  channelId: string,
  messageId: string
): void {
  const cacheKey = CACHE_KEYS.messages(channelId);

  queryClient.setQueryData<Message[]>(cacheKey, (old = []) => {
    return old.map(msg =>
      msg.id === messageId
        ? { ...msg, deleted_at: new Date().toISOString(), content: '[Message deleted]' }
        : msg
    );
  });
}

/**
 * Rollback optimistic update on error
 */
export function rollbackOptimisticUpdate<T>(
  queryClient: QueryClient,
  cacheKey: string | string[],
  previousData: T
): void {
  queryClient.setQueryData(cacheKey, previousData);
}

/**
 * Generate temporary ID for optimistic updates
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if message is optimistic
 */
export function isOptimisticMessage(message: any): boolean {
  return message._optimistic === true;
}

/**
 * Check if message failed to send
 */
export function isFailedMessage(message: any): boolean {
  return message._status === 'failed';
}

/**
 * Retry failed message
 */
export async function retryFailedMessage(
  queryClient: QueryClient,
  channelId: string,
  message: OptimisticMessage,
  sendFunction: (content: string) => Promise<Message>
): Promise<void> {
  try {
    // Mark as sending again
    queryClient.setQueryData<Message[]>(
      CACHE_KEYS.messages(channelId),
      (old = []) => {
        return old.map(msg =>
          msg.id === message.id
            ? { ...msg, _status: 'sending' as const }
            : msg
        );
      }
    );

    // Attempt to send
    const serverMessage = await sendFunction(message.content);

    // Replace with server message
    updateOptimisticMessage(queryClient, channelId, message.id, serverMessage);
  } catch (error) {
    // Mark as failed again
    markOptimisticMessageFailed(queryClient, channelId, message.id);
    throw error;
  }
}
