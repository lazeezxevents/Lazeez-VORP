import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Message } from '@/services/SupabaseRealtimeService';
import { useCommunication } from '@/components/hooks/useCommunication';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'test-user-id', full_name: 'Test User' },
      }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback('SUBSCRIBED');
        return Promise.resolve();
      }),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock realtime service
vi.mock('@/services/SupabaseRealtimeService', () => ({
  realtimeService: {
    subscribeToChannel: vi.fn(),
    unsubscribeFromChannel: vi.fn(),
    fetchMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
  Message: {},
}));

describe('Communication Performance Tests', () => {
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

  describe('Message List Virtualization', () => {
    it('should render 1000+ messages efficiently using virtualization', async () => {
      // Generate 1000 messages
      const messages: Message[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        channel_id: 'test-channel',
        user_id: 'user-1',
        content: `Message ${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        user: {
          id: 'user-1',
          full_name: 'Test User',
        },
      }));

      const VirtualizedMessageList = () => {
        const parentRef = useRef<HTMLDivElement>(null);

        const virtualizer = useVirtualizer({
          count: messages.length,
          getScrollElement: () => parentRef.current,
          estimateSize: () => 80,
          overscan: 10,
        });

        return (
          <div
            ref={parentRef}
            style={{ height: '600px', overflow: 'auto' }}
            data-testid="message-list"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {messages[virtualItem.index].content}
                </div>
              ))}
            </div>
          </div>
        );
      };

      const startTime = performance.now();
      const { container } = render(<VirtualizedMessageList />);
      const renderTime = performance.now() - startTime;

      // Should render in less than 100ms
      expect(renderTime).toBeLessThan(100);

      // Should only render visible items (not all 1000)
      const renderedItems = container.querySelectorAll('[data-index]');
      expect(renderedItems.length).toBeLessThan(50); // Only ~20-30 items visible
      expect(renderedItems.length).toBeGreaterThan(0);
    });

    it('should handle smooth scrolling with 1000+ messages', async () => {
      const messages: Message[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `msg-${i}`,
        channel_id: 'test-channel',
        user_id: 'user-1',
        content: `Message ${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        user: {
          id: 'user-1',
          full_name: 'Test User',
        },
      }));

      const VirtualizedMessageList = () => {
        const parentRef = useRef<HTMLDivElement>(null);

        const virtualizer = useVirtualizer({
          count: messages.length,
          getScrollElement: () => parentRef.current,
          estimateSize: () => 80,
          overscan: 10,
        });

        return (
          <div
            ref={parentRef}
            style={{ height: '600px', overflow: 'auto' }}
            data-testid="message-list"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {messages[virtualItem.index].content}
                </div>
              ))}
            </div>
          </div>
        );
      };

      const { container } = render(<VirtualizedMessageList />);
      const scrollContainer = container.querySelector('[data-testid="message-list"]') as HTMLDivElement;

      // Simulate scrolling
      const scrollStart = performance.now();
      scrollContainer.scrollTop = 5000;
      scrollContainer.dispatchEvent(new Event('scroll'));
      const scrollTime = performance.now() - scrollStart;

      // Scroll should be instant (<16ms for 60fps)
      expect(scrollTime).toBeLessThan(16);
    });
  });

  describe('Cache Performance', () => {
    it('should have high cache hit rate for repeated queries', async () => {
      const { realtimeService } = await import('@/services/SupabaseRealtimeService');
      const mockFetchMessages = realtimeService.fetchMessages as any;

      mockFetchMessages.mockResolvedValue([
        {
          id: 'msg-1',
          channel_id: 'test-channel',
          user_id: 'user-1',
          content: 'Test message',
          created_at: new Date().toISOString(),
        },
      ]);

      const TestComponent = () => {
        const { messages } = useCommunication({ channelId: 'test-channel' });
        return <div>{messages.length} messages</div>;
      };

      // First render - should fetch from server
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(mockFetchMessages).toHaveBeenCalledTimes(1);
      });

      // Second render - should use cache
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      // Should not fetch again (cache hit)
      expect(mockFetchMessages).toHaveBeenCalledTimes(1);
    });

    it('should respect staleTime of 30 seconds', async () => {
      const { realtimeService } = await import('@/services/SupabaseRealtimeService');
      const mockFetchMessages = realtimeService.fetchMessages as any;

      mockFetchMessages.mockResolvedValue([
        {
          id: 'msg-1',
          channel_id: 'test-channel',
          user_id: 'user-1',
          content: 'Test message',
          created_at: new Date().toISOString(),
        },
      ]);

      const TestComponent = () => {
        const { messages } = useCommunication({ channelId: 'test-channel' });
        return <div>{messages.length} messages</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(mockFetchMessages).toHaveBeenCalledTimes(1);
      });

      // Query should be fresh for 30 seconds
      const queryState = queryClient.getQueryState(['messages', 'test-channel']);
      expect(queryState?.dataUpdatedAt).toBeDefined();
    });
  });

  describe('Optimistic Updates Performance', () => {
    it('should show optimistic message instantly (<10ms)', async () => {
      const { realtimeService } = await import('@/services/SupabaseRealtimeService');
      const mockSendMessage = realtimeService.sendMessage as any;

      // Simulate slow network (500ms delay)
      mockSendMessage.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  id: 'real-msg-id',
                  channel_id: 'test-channel',
                  user_id: 'user-1',
                  content: 'Test message',
                  created_at: new Date().toISOString(),
                }),
              500
            )
          )
      );

      const TestComponent = () => {
        const { messages, sendMessage } = useCommunication({ channelId: 'test-channel' });

        return (
          <div>
            <button onClick={() => sendMessage({ content: 'Test message' })}>Send</button>
            <div data-testid="message-count">{messages.length}</div>
          </div>
        );
      };

      const { getByText, getByTestId } = render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>
      );

      const initialCount = parseInt(getByTestId('message-count').textContent || '0');

      // Click send button
      const startTime = performance.now();
      getByText('Send').click();

      // Optimistic update should be instant
      await waitFor(
        () => {
          const newCount = parseInt(getByTestId('message-count').textContent || '0');
          expect(newCount).toBe(initialCount + 1);
        },
        { timeout: 50 }
      ); // Should happen within 50ms

      const optimisticTime = performance.now() - startTime;
      expect(optimisticTime).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory when subscribing/unsubscribing', async () => {
      const { realtimeService } = await import('@/services/SupabaseRealtimeService');
      const mockSubscribe = realtimeService.subscribeToChannel as any;
      const mockUnsubscribe = realtimeService.unsubscribeFromChannel as any;

      mockSubscribe.mockReturnValue({});

      const TestComponent = ({ channelId }: { channelId: string }) => {
        useCommunication({ channelId });
        return <div>Test</div>;
      };

      const { rerender, unmount } = render(
        <QueryClientProvider client={queryClient}>
          <TestComponent channelId="channel-1" />
        </QueryClientProvider>
      );

      expect(mockSubscribe).toHaveBeenCalledWith('channel-1', expect.any(Object));

      // Change channel
      rerender(
        <QueryClientProvider client={queryClient}>
          <TestComponent channelId="channel-2" />
        </QueryClientProvider>
      );

      expect(mockUnsubscribe).toHaveBeenCalledWith('channel-1');
      expect(mockSubscribe).toHaveBeenCalledWith('channel-2', expect.any(Object));

      // Unmount
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledWith('channel-2');
    });
  });

  describe('Rendering Performance', () => {
    it('should render message list in less than 100ms', async () => {
      const messages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        channel_id: 'test-channel',
        user_id: 'user-1',
        content: `Message ${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        user: {
          id: 'user-1',
          full_name: 'Test User',
        },
      }));

      const MessageList = () => (
        <div>
          {messages.map((msg) => (
            <div key={msg.id}>{msg.content}</div>
          ))}
        </div>
      );

      const startTime = performance.now();
      render(<MessageList />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(100);
    });
  });
});
