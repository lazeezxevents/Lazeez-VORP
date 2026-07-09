import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserCommunicationDeliveryPrefs, useUpsertUserCommunicationDeliveryPrefs } from './useUserCommunicationDeliveryPrefs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useUserCommunicationDeliveryPrefs', () => {
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

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should return null when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useUserCommunicationDeliveryPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it('should return default preferences when no data exists', async () => {
    const mockUser = { id: 'user-123' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const { result } = renderHook(() => useUserCommunicationDeliveryPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({
        user_id: 'user-123',
        push_notifications: true,
        email_digests: true,
        digest_frequency: 'daily',
        notification_sounds: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        sound_volume_percent: 40,
      });
    });
  });

  it('should return user preferences from database', async () => {
    const mockUser = { id: 'user-123' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const mockData = {
      user_id: 'user-123',
      push_notifications: false,
      email_digests: true,
      digest_frequency: 'hourly',
      notification_sounds: false,
      quiet_hours_enabled: true,
      quiet_hours_start: '23:00',
      quiet_hours_end: '07:00',
      sound_volume_percent: 60,
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const { result } = renderHook(() => useUserCommunicationDeliveryPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it('should normalize invalid digest frequency to default', async () => {
    const mockUser = { id: 'user-123' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const mockData = {
      user_id: 'user-123',
      push_notifications: true,
      email_digests: true,
      digest_frequency: 'invalid-frequency',
      notification_sounds: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      sound_volume_percent: 40,
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const { result } = renderHook(() => useUserCommunicationDeliveryPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.digest_frequency).toBe('daily');
    });
  });

  it('should clamp sound volume percent to 0-100 range', async () => {
    const mockUser = { id: 'user-123' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const mockData = {
      user_id: 'user-123',
      push_notifications: true,
      email_digests: true,
      digest_frequency: 'daily',
      notification_sounds: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      sound_volume_percent: 150, // Invalid: > 100
    };

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const { result } = renderHook(() => useUserCommunicationDeliveryPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.sound_volume_percent).toBe(100);
    });
  });
});

describe('useUpsertUserCommunicationDeliveryPrefs', () => {
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

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should upsert user preferences', async () => {
    const mockUser = { id: 'user-123' };
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({
      upsert: mockUpsert,
    });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const { result } = renderHook(() => useUpsertUserCommunicationDeliveryPrefs(), { wrapper });

    const newPrefs = {
      push_notifications: false,
      email_digests: true,
      digest_frequency: 'hourly' as const,
      notification_sounds: false,
      quiet_hours_enabled: true,
      quiet_hours_start: '23:00',
      quiet_hours_end: '07:00',
      sound_volume_percent: 60,
    };

    await result.current.mutateAsync(newPrefs);

    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-123',
        ...newPrefs,
      },
      { onConflict: 'user_id' }
    );
  });

  it('should throw error when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useUpsertUserCommunicationDeliveryPrefs(), { wrapper });

    const newPrefs = {
      push_notifications: false,
      email_digests: true,
      digest_frequency: 'hourly' as const,
      notification_sounds: false,
      quiet_hours_enabled: true,
      quiet_hours_start: '23:00',
      quiet_hours_end: '07:00',
      sound_volume_percent: 60,
    };

    await expect(result.current.mutateAsync(newPrefs)).rejects.toThrow('Not signed in');
  });
});
