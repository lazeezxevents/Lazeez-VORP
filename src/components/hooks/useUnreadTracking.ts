import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface UnreadStatus {
  channelId: string;
  unreadCount: number;
  lastReadAt: string | null;
  hasUnread: boolean;
}

/**
 * Hook to track unread messages across all channels
 * 
 * Features:
 * - Real-time unread count updates
 * - Efficient batch queries
 * - Automatic cache invalidation
 * 
 * Requirements: 35.1, 35.2, 35.5, 35.6, 35.7, 35.9, 35.10
 */
export const useUnreadTracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread counts for all channels
  const { data: unreadMap = new Map<string, number>(), isLoading } = useQuery({
    queryKey: ['channel-unread-map', user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, number>();

      // Get all channel memberships with last_read_at
      const { data: memberships, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id, last_read_at')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error fetching memberships:', memberError);
        return new Map<string, number>();
      }

      if (!memberships || memberships.length === 0) {
        return new Map<string, number>();
      }

      // For each channel, count messages after last_read_at
      const unreadCounts = await Promise.all(
        memberships.map(async (membership) => {
          const lastReadAt = membership.last_read_at || '1970-01-01T00:00:00Z';

          const { count, error: countError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', membership.channel_id)
            .gt('created_at', lastReadAt)
            .is('deleted_at', null);

          if (countError) {
            console.error('Error counting unread messages:', countError);
            return { channelId: membership.channel_id, count: 0 };
          }

          return { channelId: membership.channel_id, count: count || 0 };
        })
      );

      // Convert to Map
      const map = new Map<string, number>();
      unreadCounts.forEach(({ channelId, count }) => {
        map.set(channelId, count);
      });

      return map;
    },
    enabled: !!user,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('unread-messages-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Invalidate unread counts when new messages arrive
          void queryClient.invalidateQueries({ queryKey: ['channel-unread-map', user.id] });
        }
      )
      .subscribe();

    // Subscribe to channel_members updates (when last_read_at changes)
    const membersChannel = supabase
      .channel('unread-members-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_members',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate unread counts when read status changes
          void queryClient.invalidateQueries({ queryKey: ['channel-unread-map', user.id] });
        }
      )
      .subscribe();

    return () => {
      void messagesChannel.unsubscribe();
      void membersChannel.unsubscribe();
    };
  }, [user, queryClient]);

  // Calculate total unread count
  const totalUnread = Array.from(unreadMap.values()).reduce((sum, count) => sum + count, 0);

  // Get unread count for a specific channel
  const getUnreadCount = (channelId: string): number => {
    return unreadMap.get(channelId) || 0;
  };

  // Check if channel has unread messages
  const hasUnread = (channelId: string): boolean => {
    return (unreadMap.get(channelId) || 0) > 0;
  };

  // Get all channels with unread messages
  const channelsWithUnread = Array.from(unreadMap.entries())
    .filter(([_, count]) => count > 0)
    .map(([channelId]) => channelId);

  return {
    unreadMap,
    totalUnread,
    getUnreadCount,
    hasUnread,
    channelsWithUnread,
    isLoading,
  };
};

/**
 * Hook to get unread count for a specific channel
 * 
 * Requirements: 35.1, 35.2
 */
export const useChannelUnreadCount = (channelId: string) => {
  const { user } = useAuth();

  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ['channel-unread', channelId, user?.id],
    queryFn: async () => {
      if (!user || !channelId) return 0;

      // Get user's last_read_at for this channel
      const { data: membership, error: memberError } = await supabase
        .from('channel_members')
        .select('last_read_at')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single();

      if (memberError) {
        console.error('Error fetching channel membership:', memberError);
        return 0;
      }

      const lastReadAt = membership?.last_read_at || '1970-01-01T00:00:00Z';

      // Count messages after last_read_at
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channelId)
        .gt('created_at', lastReadAt)
        .is('deleted_at', null);

      if (countError) {
        console.error('Error counting unread messages:', countError);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user && !!channelId,
    staleTime: 5000, // 5 seconds
  });

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
    isLoading,
  };
};
