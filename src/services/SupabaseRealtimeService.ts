import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  thread_parent_id?: string;
  user?: {
    id: string;
    full_name: string;
    profile_picture_url?: string;
    main_role?: string;
    designation?: string;
  };
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  reply_count?: number;
}

export interface MessageAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  thumbnail_url?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  channelId: string;
  isTyping: boolean;
}

export interface PresenceState {
  userId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  customStatus?: string;
  onlineAt: string;
}

export class SupabaseRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Subscribe to a channel for real-time messages
   */
  subscribeToChannel(
    channelId: string,
    callbacks: {
      onMessage?: (message: Message) => void;
      onMessageEdit?: (message: Message) => void;
      onMessageDelete?: (messageId: string) => void;
      onTyping?: (typing: TypingIndicator) => void;
      onPresence?: (presence: PresenceState[]) => void;
      onReaction?: (reaction: { messageId: string; emoji: string; userId: string }) => void;
    }
  ): RealtimeChannel {
    // Check if already subscribed
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!;
    }

    const channel = supabase.channel(`channel:${channelId}`, {
      config: {
        broadcast: { self: true }, // Receive own messages
        presence: { key: 'user_id' },
      },
    });

    // Listen for new messages (database changes)
    if (callbacks.onMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch full message with user data
          const { data: message } = await supabase
            .from('messages')
            .select(`
              *,
              user:profiles!messages_user_id_fkey(
                id,
                full_name,
                profile_picture_url,
                main_role,
                designation
              ),
              attachments:message_attachments(*),
              reactions:message_reactions(emoji, user_id)
            `)
            .eq('id', payload.new.id)
            .single();

          if (message) {
            // Group reactions by emoji
            const reactionMap = new Map<string, string[]>();
            if (message.reactions) {
              message.reactions.forEach((r: any) => {
                if (!reactionMap.has(r.emoji)) {
                  reactionMap.set(r.emoji, []);
                }
                reactionMap.get(r.emoji)!.push(r.user_id);
              });
            }

            const groupedReactions: MessageReaction[] = Array.from(reactionMap.entries()).map(
              ([emoji, user_ids]) => ({
                emoji,
                count: user_ids.length,
                user_ids,
              })
            );

            callbacks.onMessage!({
              ...message,
              reactions: groupedReactions,
            } as Message);
          }
        }
      );
    }

    // Listen for message edits
    if (callbacks.onMessageEdit) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data: message } = await supabase
            .from('messages')
            .select(`
              *,
              user:profiles!messages_user_id_fkey(
                id,
                full_name,
                profile_picture_url,
                main_role,
                designation
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (message) {
            callbacks.onMessageEdit!(message as Message);
          }
        }
      );
    }

    // Listen for message deletions
    if (callbacks.onMessageDelete) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.new.deleted_at) {
            callbacks.onMessageDelete!(payload.new.id);
          }
        }
      );
    }

    // Listen for typing indicators (broadcast)
    if (callbacks.onTyping) {
      channel.on('broadcast', { event: 'typing' }, (payload) => {
        callbacks.onTyping!(payload.payload as TypingIndicator);
      });
    }

    // Listen for reactions (broadcast for instant feedback)
    if (callbacks.onReaction) {
      channel.on('broadcast', { event: 'reaction' }, (payload) => {
        callbacks.onReaction!(payload.payload as any);
      });
    }

    // Listen for presence changes
    if (callbacks.onPresence) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presenceList: PresenceState[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence) => {
            presenceList.push(presence as PresenceState);
          });
        });

        callbacks.onPresence!(presenceList);
      });
    }

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Subscribed to channel: ${channelId}`);

        // Track presence
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          await channel.track({
            userId: user.id,
            userName: profile?.full_name || 'Unknown',
            status: 'online',
            onlineAt: new Date().toISOString(),
          });
        }
      }
    });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Upload files for channel message attachments (Supabase Storage)
   */
  private async uploadChannelAttachments(
    channelId: string,
    files: File[]
  ): Promise<
    Array<{
      file_url: string;
      file_name: string;
      file_size: number;
      file_type: string;
    }>
  > {
    const uploaded: Array<{
      file_url: string;
      file_name: string;
      file_size: number;
      file_type: string;
    }> = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${channelId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Failed to upload attachment:', uploadError);
        throw new Error(`Failed to upload ${file.name}`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('message-attachments').getPublicUrl(filePath);

      uploaded.push({
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
      });
    }

    return uploaded;
  }

  /**
   * Send a message via Supabase (will trigger realtime update).
   * Optionally uploads files and creates message_attachments rows.
   */
  async sendMessage(
    channelId: string,
    content: string,
    threadParentId?: string,
    files?: File[]
  ): Promise<Message | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const text = (content || '').trim();
    if (!text) {
      throw new Error('Message content is required');
    }

    let uploadedMeta: Array<{
      file_url: string;
      file_name: string;
      file_size: number;
      file_type: string;
    }> = [];

    if (files && files.length > 0) {
      uploadedMeta = await this.uploadChannelAttachments(channelId, files);
    }

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        content: text,
        thread_parent_id: threadParentId ?? null,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('Failed to send message:', error);
      throw error || new Error('Failed to send message');
    }

    if (uploadedMeta.length > 0) {
      const { error: attachmentError } = await supabase.from('message_attachments').insert(
        uploadedMeta.map((att) => ({
          message_id: inserted.id,
          ...att,
        }))
      );
      if (attachmentError) {
        console.error('Failed to save attachments:', attachmentError);
        throw attachmentError;
      }
    }

    const { data: full, error: fetchError } = await supabase
      .from('messages')
      .select(
        `
        *,
        user:profiles!messages_user_id_fkey(
          id,
          full_name,
          profile_picture_url,
          main_role,
          designation
        ),
        attachments:message_attachments(*)
      `
      )
      .eq('id', inserted.id)
      .single();

    if (fetchError) {
      console.error('Failed to load sent message:', fetchError);
      throw fetchError;
    }

    return full as Message;
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({
        content,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to edit message:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, emoji: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      console.error('Failed to add reaction:', error);
      throw error;
    }

    // Broadcast reaction for instant feedback
    const channel = Array.from(this.channels.values())[0]; // Get any active channel
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: {
          messageId,
          emoji,
          userId: user.id,
          action: 'add',
        },
      });
    }
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);

    if (error) {
      console.error('Failed to remove reaction:', error);
      throw error;
    }

    // Broadcast reaction removal
    const channel = Array.from(this.channels.values())[0];
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: {
          messageId,
          emoji,
          userId: user.id,
          action: 'remove',
        },
      });
    }
  }

  /**
   * Broadcast typing indicator
   */
  async broadcastTyping(
    channelId: string,
    isTyping: boolean
  ): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      console.warn(`Not subscribed to channel: ${channelId}`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        userName: profile?.full_name || 'Unknown',
        channelId,
        isTyping,
      },
    });
  }

  /**
   * Update presence status
   */
  async updatePresence(
    channelId: string,
    status: 'online' | 'away' | 'dnd' | 'offline',
    customStatus?: string
  ): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await channel.track({
      userId: user.id,
      status,
      customStatus,
      onlineAt: new Date().toISOString(),
    });

    // Also update database
    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status,
        custom_status: customStatus,
        last_seen: new Date().toISOString(),
      });
  }

  /**
   * Fetch messages for a channel
   */
  async fetchMessages(
    channelId: string,
    limit: number = 50,
    before?: string
  ): Promise<Message[]> {
    let query = supabase
      .from('messages')
      .select(`
        *,
        user:profiles!messages_user_id_fkey(
          id,
          full_name,
          profile_picture_url,
          main_role,
          designation
        ),
        attachments:message_attachments(*),
        reactions:message_reactions(emoji, user_id)
      `)
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch messages:', error);
      return [];
    }

    // Group reactions by emoji for each message
    return (data || []).map((message: any) => {
      const reactionMap = new Map<string, string[]>();
      if (message.reactions) {
        message.reactions.forEach((r: any) => {
          if (!reactionMap.has(r.emoji)) {
            reactionMap.set(r.emoji, []);
          }
          reactionMap.get(r.emoji)!.push(r.user_id);
        });
      }

      const groupedReactions: MessageReaction[] = Array.from(reactionMap.entries()).map(
        ([emoji, user_ids]) => ({
          emoji,
          count: user_ids.length,
          user_ids,
        })
      );

      return {
        ...message,
        reactions: groupedReactions,
      } as Message;
    }).reverse(); // Reverse to get chronological order
  }

  /**
   * Mark channel as read
   */
  async markChannelRead(channelId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('mark_channel_read', {
      p_channel_id: channelId,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Failed to mark channel as read:', error);
    }
  }

  /**
   * Get unread count for a channel
   */
  async getUnreadCount(channelId: string): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase.rpc('get_unread_count', {
      p_channel_id: channelId,
      p_user_id: user.id,
    });

    if (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribeFromChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel) {
      await supabase.removeChannel(channel);
      this.channels.delete(channelId);
      console.log(`❌ Unsubscribed from channel: ${channelId}`);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    for (const [channelId, channel] of this.channels.entries()) {
      await supabase.removeChannel(channel);
      console.log(`❌ Unsubscribed from channel: ${channelId}`);
    }
    this.channels.clear();
  }
}

// Export singleton instance
export const realtimeService = new SupabaseRealtimeService();
