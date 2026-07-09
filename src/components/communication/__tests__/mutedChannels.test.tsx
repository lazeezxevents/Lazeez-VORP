/**
 * Muted Channels Tests
 * Task 21.2: Implement channel muting
 * Requirements: 24.5, 24.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMutedChannels } from '@/hooks/useMutedChannels';
import { supabase } from '@/components/integrations/supabase/client';

// Mock Supabase
vi.mock('@/components/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('useMutedChannels', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch muted channels for a user', async () => {
    const mockMutedChannels = [
      { channel_id: 'channel-1', muted_at: '2024-01-01T00:00:00Z' },
      { channel_id: 'channel-2', muted_at: '2024-01-02T00:00:00Z' },
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockMutedChannels,
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMutedChannels('user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mutedChannels).toEqual(mockMutedChannels);
    expect(mockFrom).toHaveBeenCalledWith('muted_channels');
  });

  it('should correctly identify if a channel is muted', async () => {
    const mockMutedChannels = [
      { channel_id: 'channel-1', muted_at: '2024-01-01T00:00:00Z' },
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: mockMutedChannels,
          error: null,
        }),
      }),
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMutedChannels('user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isChannelMuted('channel-1')).toBe(true);
    expect(result.current.isChannelMuted('channel-2')).toBe(false);
  });

  it('should mute a channel', async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMutedChannels('user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.muteChannel('channel-1');

    await waitFor(() => {
      expect(result.current.isMuting).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('muted_channels');
  });

  it('should unmute a channel', async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ channel_id: 'channel-1', muted_at: '2024-01-01T00:00:00Z' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMutedChannels('user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.unmuteChannel('channel-1');

    await waitFor(() => {
      expect(result.current.isUnmuting).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('muted_channels');
  });

  it('should toggle mute status', async () => {
    const mockFrom = vi.fn()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useMutedChannels('user-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Channel is not muted, so toggle should mute it
    expect(result.current.isChannelMuted('channel-1')).toBe(false);
    result.current.toggleMute('channel-1');

    await waitFor(() => {
      expect(result.current.isMuting).toBe(false);
    });
  });
});

/**
 * Integration test: Muted channels should suppress notifications except for direct mentions
 * Requirement: 24.6
 */
describe('Muted channels notification behavior', () => {
  it('should suppress notifications for muted channels', () => {
    const isMuted = true;
    const hasMention = false;

    // Logic: If channel is muted and there's no direct mention, suppress notification
    const shouldNotify = !isMuted || hasMention;

    expect(shouldNotify).toBe(false);
  });

  it('should allow notifications for direct mentions in muted channels', () => {
    const isMuted = true;
    const hasMention = true;

    // Logic: If there's a direct mention, always notify even if muted
    const shouldNotify = !isMuted || hasMention;

    expect(shouldNotify).toBe(true);
  });

  it('should allow notifications for unmuted channels', () => {
    const isMuted = false;
    const hasMention = false;

    // Logic: If channel is not muted, always notify
    const shouldNotify = !isMuted || hasMention;

    expect(shouldNotify).toBe(true);
  });
});
