import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/components/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MutedChannel {
  channel_id: string;
  muted_at: string;
}

/**
 * Hook for managing muted channels
 * 
 * Features:
 * - Fetch user's muted channels
 * - Mute/unmute channels
 * - Check if a channel is muted
 * 
 * Requirements: 24.5, 24.6
 * 
 * Note: After applying the muted_channels migration, regenerate types with:
 * npx supabase gen types typescript --local > src/components/integrations/supabase/types.ts
 */
export const useMutedChannels = (userId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch muted channels
  const { data: mutedChannels = [], isLoading } = useQuery({
    queryKey: ['muted-channels', userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('muted_channels')
        .select('channel_id, muted_at')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching muted channels:', error);
        throw error;
      }

      return (data || []) as MutedChannel[];
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });

  // Mute channel mutation
  const muteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await (supabase as any)
        .from('muted_channels')
        .insert({
          user_id: userId,
          channel_id: channelId,
        });

      if (error) {
        throw error;
      }

      return channelId;
    },
    onSuccess: (channelId) => {
      queryClient.invalidateQueries({ queryKey: ['muted-channels', userId] });
      toast({
        title: 'Channel muted',
        description: 'You will not receive notifications from this channel except for direct mentions.',
      });
    },
    onError: (error) => {
      console.error('Error muting channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to mute channel. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Unmute channel mutation
  const unmuteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await (supabase as any)
        .from('muted_channels')
        .delete()
        .eq('user_id', userId)
        .eq('channel_id', channelId);

      if (error) {
        throw error;
      }

      return channelId;
    },
    onSuccess: (channelId) => {
      queryClient.invalidateQueries({ queryKey: ['muted-channels', userId] });
      toast({
        title: 'Channel unmuted',
        description: 'You will now receive notifications from this channel.',
      });
    },
    onError: (error) => {
      console.error('Error unmuting channel:', error);
      toast({
        title: 'Error',
        description: 'Failed to unmute channel. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Helper function to check if a channel is muted
  const isChannelMuted = (channelId: string): boolean => {
    return mutedChannels.some((mc) => mc.channel_id === channelId);
  };

  // Toggle mute status
  const toggleMute = (channelId: string) => {
    if (isChannelMuted(channelId)) {
      unmuteChannelMutation.mutate(channelId);
    } else {
      muteChannelMutation.mutate(channelId);
    }
  };

  return {
    mutedChannels,
    isLoading,
    isChannelMuted,
    muteChannel: muteChannelMutation.mutate,
    unmuteChannel: unmuteChannelMutation.mutate,
    toggleMute,
    isMuting: muteChannelMutation.isPending,
    isUnmuting: unmuteChannelMutation.isPending,
  };
};
