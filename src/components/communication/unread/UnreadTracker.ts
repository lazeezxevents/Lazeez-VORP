import { supabase } from '@/components/integrations/supabase/client';

/**
 * UnreadTracker - Manages unread message tracking
 * 
 * Features:
 * - Track last_read_at timestamp
 * - Calculate unread counts
 * - Mark messages as read after 2 seconds
 * - Sync read status across devices
 * 
 * Requirements: 35.1-35.10
 */

export interface UnreadStatus {
  channelId: string;
  unreadCount: number;
  lastReadAt: string | null;
  hasUnread: boolean;
}

class UnreadTrackerService {
  private readTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly READ_DELAY_MS = 2000; // 2 seconds

  /**
   * Get unread count for a specific channel
   */
  async getUnreadCount(channelId: string, userId: string): Promise<number> {
    try {
      // Get user's last_read_at for this channel
      const { data: membership, error: memberError } = await supabase
        .from('channel_members')
        .select('last_read_at')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();

      if (memberError) {
        console.error('Error fetching channel membership:', memberError);
        return 0;
      }

      if (!membership?.last_read_at) {
        // If never read, count all messages
        const { count, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId)
          .is('deleted_at', null);

        if (countError) {
          console.error('Error counting messages:', countError);
          return 0;
        }

        return count || 0;
      }

      // Count messages after last_read_at
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gt('created_at', membership.last_read_at)
        .is('deleted_at', null);

      if (countError) {
        console.error('Error counting unread messages:', countError);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Get unread status for all user's channels
   */
  async getAllUnreadCounts(userId: string): Promise<UnreadStatus[]> {
    try {
      // Get all channels user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', userId);

      if (memberError) {
        console.error('Error fetching memberships:', memberError);
        return [];
      }

      if (!memberships || memberships.length === 0) {
        return [];
      }

      // Get unread counts for each channel
      const unreadStatuses = await Promise.all(
        memberships.map(async (membership) => {
          const unreadCount = await this.getUnreadCount(membership.channel_id, userId);
          return {
            channelId: membership.channel_id,
            unreadCount,
            lastReadAt: membership.last_read_at,
            hasUnread: unreadCount > 0
          };
        })
      );

      return unreadStatuses;
    } catch (error) {
      console.error('Error in getAllUnreadCounts:', error);
      return [];
    }
  }

  /**
   * Mark channel as read after viewing for 2 seconds
   */
  scheduleMarkAsRead(channelId: string, userId: string): void {
    // Clear existing timer for this channel
    const existingTimer = this.readTimers.get(channelId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new timer
    const timer = setTimeout(() => {
      this.markAsRead(channelId, userId);
      this.readTimers.delete(channelId);
    }, this.READ_DELAY_MS);

    this.readTimers.set(channelId, timer);
  }

  /**
   * Cancel scheduled mark as read (when user navigates away)
   */
  cancelMarkAsRead(channelId: string): void {
    const timer = this.readTimers.get(channelId);
    if (timer) {
      clearTimeout(timer);
      this.readTimers.delete(channelId);
    }
  }

  /**
   * Immediately mark channel as read
   */
  async markAsRead(channelId: string, userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('channel_members')
        .update({ last_read_at: now })
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking channel as read:', error);
        return;
      }

      // Broadcast read status update via WebSocket
      // This will be handled by the WebSocket service
      window.dispatchEvent(
        new CustomEvent('channel:read', {
          detail: { channelId, userId, timestamp: now }
        })
      );
    } catch (error) {
      console.error('Error in markAsRead:', error);
    }
  }

  /**
   * Mark all channels as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('channel_members')
        .update({ last_read_at: now })
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking all channels as read:', error);
        return;
      }

      // Broadcast read status update
      window.dispatchEvent(
        new CustomEvent('channels:read-all', {
          detail: { userId, timestamp: now }
        })
      );
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
    }
  }

  /**
   * Get the timestamp of the last unread message in a channel
   */
  async getFirstUnreadMessageId(
    channelId: string,
    userId: string
  ): Promise<string | null> {
    try {
      // Get user's last_read_at
      const { data: membership, error: memberError } = await supabase
        .from('channel_members')
        .select('last_read_at')
        .eq('channel_id', channelId)
        .eq('user_id', userId)
        .single();

      if (memberError || !membership?.last_read_at) {
        return null;
      }

      // Get first message after last_read_at
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('id')
        .eq('channel_id', channelId)
        .gt('created_at', membership.last_read_at)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (messageError || !message) {
        return null;
      }

      return message.id;
    } catch (error) {
      console.error('Error in getFirstUnreadMessageId:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time unread count updates
   */
  subscribeToUnreadUpdates(
    userId: string,
    callback: (unreadStatuses: UnreadStatus[]) => void
  ): () => void {
    // Subscribe to channel_members changes
    const subscription = supabase
      .channel('unread-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${userId}`
        },
        async () => {
          // Refresh unread counts
          const unreadStatuses = await this.getAllUnreadCounts(userId);
          callback(unreadStatuses);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async () => {
          // Refresh unread counts when new messages arrive
          const unreadStatuses = await this.getAllUnreadCounts(userId);
          callback(unreadStatuses);
        }
      )
      .subscribe();

    // Return cleanup function
    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Get total unread count across all channels
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    const unreadStatuses = await this.getAllUnreadCounts(userId);
    return unreadStatuses.reduce((total, status) => total + status.unreadCount, 0);
  }

  /**
   * Cleanup all timers
   */
  cleanup(): void {
    this.readTimers.forEach((timer) => clearTimeout(timer));
    this.readTimers.clear();
  }
}

export const unreadTracker = new UnreadTrackerService();
