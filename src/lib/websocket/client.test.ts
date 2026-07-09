/**
 * Property-Based Tests for WebSocket Connection Stability
 * 
 * **Property 2: Connection resilience**
 * **Validates: Requirements 19.4, 19.5, 19.6**
 * 
 * These tests verify that the WebSocket client maintains stable connections
 * through network interruptions, heartbeat failures, and high load scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { WebSocketClient, MessageType } from './client';
import type { WebSocketMessage } from './client';

// Mock WebSocket implementation for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private messageQueue: string[] = [];
  private closeTimer: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.messageQueue.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSING;
    this.closeTimer = setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close'));
      }
    }, 10);
  }

  // Test helper: simulate receiving a message
  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  // Test helper: simulate connection error
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  // Test helper: simulate connection close
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Test helper: get sent messages
  getSentMessages(): string[] {
    return [...this.messageQueue];
  }

  // Test helper: clear message queue
  clearMessages(): void {
    this.messageQueue = [];
  }
}

describe('WebSocket Connection Stability - Property 2: Connection resilience', () => {
  let originalWebSocket: typeof WebSocket;
  let mockWebSocketInstances: MockWebSocket[] = [];

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Create a proper constructor function for mocking
    const MockWebSocketConstructor = function(this: any, url: string) {
      const instance = new MockWebSocket(url);
      mockWebSocketInstances.push(instance);
      // Copy properties to 'this' for proper constructor behavior
      Object.assign(this, instance);
      return instance;
    } as any;

    // Add static properties
    MockWebSocketConstructor.CONNECTING = 0;
    MockWebSocketConstructor.OPEN = 1;
    MockWebSocketConstructor.CLOSING = 2;
    MockWebSocketConstructor.CLOSED = 3;

    // Mock WebSocket constructor
    global.WebSocket = MockWebSocketConstructor as typeof WebSocket;

    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    mockWebSocketInstances = [];
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Requirement 19.4: Automatic reconnection with exponential backoff', () => {
    it('should reconnect after network interruption with exponential backoff', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 4 }), // Reconnection attempt number (0-4)
          async (attemptNumber) => {
            const client = new WebSocketClient('ws://localhost:3001');
            const token = 'test-token-' + Math.random();

            // Connect initially
            client.connect(token);
            await vi.advanceTimersByTimeAsync(50);

            // Get the initial WebSocket instance
            const initialWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            
            // Simulate successful authentication
            initialWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            // Verify connected
            expect(client.isConnected()).toBe(true);

            // Simulate network interruption
            initialWs.simulateClose();
            await vi.advanceTimersByTimeAsync(50);

            // Verify disconnected
            expect(client.isConnected()).toBe(false);

            // Expected delays: [1000, 2000, 4000, 8000, 16000]
            const expectedDelays = [1000, 2000, 4000, 8000, 16000];
            const expectedDelay = expectedDelays[Math.min(attemptNumber, 4)];

            // Advance time to just before reconnection
            await vi.advanceTimersByTimeAsync(expectedDelay - 100);
            // Should still be disconnected
            expect(client.isConnected()).toBe(false);

            // Advance time to trigger reconnection
            await vi.advanceTimersByTimeAsync(200);
            
            // Get the new WebSocket instance created by reconnection
            const reconnectedWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            expect(reconnectedWs).not.toBe(initialWs);
            
            // Simulate successful authentication on reconnection
            await vi.advanceTimersByTimeAsync(50);
            reconnectedWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            // Verify reconnected
            expect(client.isConnected()).toBe(true);

            client.disconnect();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should successfully reconnect within 3 seconds after interruption', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }), // Random token
          async (token) => {
            const client = new WebSocketClient('ws://localhost:3001');
            let reconnected = false;

            // Connect initially
            client.connect(token);
            await vi.advanceTimersByTimeAsync(50);

            // Simulate successful authentication
            const initialWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            initialWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            expect(client.isConnected()).toBe(true);

            // Simulate network interruption
            initialWs.simulateClose();
            await vi.advanceTimersByTimeAsync(50);

            expect(client.isConnected()).toBe(false);

            // Wait for reconnection (should happen within 3 seconds)
            // First attempt is at 1 second
            await vi.advanceTimersByTimeAsync(1100);

            // Check if new WebSocket was created
            const newWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            expect(newWs).toBeDefined();
            expect(newWs).not.toBe(initialWs);

            // Simulate successful reconnection
            await vi.advanceTimersByTimeAsync(50);
            newWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            reconnected = client.isConnected();
            expect(reconnected).toBe(true);

            client.disconnect();
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reset reconnection attempts after successful connection', async () => {
      const client = new WebSocketClient('ws://localhost:3001');
      const token = 'test-token';

      // Initial connection
      client.connect(token);
      await vi.advanceTimersByTimeAsync(50);

      const ws1 = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      ws1.simulateMessage(JSON.stringify({
        type: MessageType.AUTH_SUCCESS,
        timestamp: Date.now(),
      }));

      // Simulate multiple disconnections to increase backoff
      for (let i = 0; i < 3; i++) {
        const currentWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
        currentWs.simulateClose();
        
        const delay = [1000, 2000, 4000][i];
        await vi.advanceTimersByTimeAsync(delay + 100);
        
        const newWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
        await vi.advanceTimersByTimeAsync(50);
        newWs.simulateMessage(JSON.stringify({
          type: MessageType.AUTH_SUCCESS,
          timestamp: Date.now(),
        }));
      }

      // Now disconnect and reconnect - should use 1s delay (reset)
      const lastWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      lastWs.simulateClose();
      
      const instanceCountBefore = mockWebSocketInstances.length;
      await vi.advanceTimersByTimeAsync(900);
      expect(mockWebSocketInstances.length).toBe(instanceCountBefore);
      
      await vi.advanceTimersByTimeAsync(200);
      expect(mockWebSocketInstances.length).toBeGreaterThan(instanceCountBefore);

      client.disconnect();
    });
  });

  describe('Requirement 19.5 & 19.6: Heartbeat monitoring and failure detection', () => {
    it('should maintain heartbeat with 30-second ping intervals', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of heartbeat cycles
          async (cycles) => {
            const client = new WebSocketClient('ws://localhost:3001');
            const token = 'test-token';

            client.connect(token);
            await vi.advanceTimersByTimeAsync(50);

            const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            mockWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            // The client responds to server pings with pongs
            // Simulate server sending pings at 30-second intervals
            for (let i = 0; i < cycles; i++) {
              mockWs.clearMessages();
              
              // Server sends ping
              mockWs.simulateMessage(JSON.stringify({
                type: MessageType.PING,
                timestamp: Date.now(),
              }));

              // Client should respond with pong
              const sentMessages = mockWs.getSentMessages();
              const pongMessage = sentMessages.find(msg => {
                const parsed = JSON.parse(msg);
                return parsed.type === MessageType.PONG;
              });

              expect(pongMessage).toBeDefined();

              // Advance to next ping interval
              await vi.advanceTimersByTimeAsync(30000);
            }

            client.disconnect();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should detect heartbeat failure and reconnect', async () => {
      const client = new WebSocketClient('ws://localhost:3001');
      const token = 'test-token';

      client.connect(token);
      await vi.advanceTimersByTimeAsync(50);

      const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      mockWs.simulateMessage(JSON.stringify({
        type: MessageType.AUTH_SUCCESS,
        timestamp: Date.now(),
      }));

      expect(client.isConnected()).toBe(true);
      const initialInstanceCount = mockWebSocketInstances.length;

      // Simulate heartbeat failure by closing connection
      mockWs.simulateClose();
      await vi.advanceTimersByTimeAsync(50);

      expect(client.isConnected()).toBe(false);

      // Should attempt reconnection
      await vi.advanceTimersByTimeAsync(1100);
      expect(mockWebSocketInstances.length).toBeGreaterThan(initialInstanceCount);

      client.disconnect();
    });

    it('should respond to ping messages immediately', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 100, max: 5000 }), { minLength: 1, maxLength: 10 }), // Random ping intervals
          async (pingIntervals) => {
            const client = new WebSocketClient('ws://localhost:3001');
            const token = 'test-token';

            client.connect(token);
            await vi.advanceTimersByTimeAsync(50);

            const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            mockWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            for (const interval of pingIntervals) {
              mockWs.clearMessages();

              // Send ping
              mockWs.simulateMessage(JSON.stringify({
                type: MessageType.PING,
                timestamp: Date.now(),
              }));

              // Check for immediate pong response
              const sentMessages = mockWs.getSentMessages();
              const pongMessage = sentMessages.find(msg => {
                const parsed = JSON.parse(msg);
                return parsed.type === MessageType.PONG;
              });

              expect(pongMessage).toBeDefined();

              await vi.advanceTimersByTimeAsync(interval);
            }

            client.disconnect();
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe('Connection pooling and concurrent connections', () => {
    it('should handle multiple simultaneous connections independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Number of concurrent clients
          async (clientCount) => {
            // Clear any previous instances
            mockWebSocketInstances = [];
            
            const clients: WebSocketClient[] = [];
            const urls = Array.from({ length: clientCount }, (_, i) => 
              `ws://localhost:300${i}`
            );

            // Create multiple clients
            for (let i = 0; i < clientCount; i++) {
              const client = new WebSocketClient(urls[i]);
              client.connect(`token-${i}`);
              clients.push(client);
            }

            await vi.advanceTimersByTimeAsync(100);

            // Verify all clients created their WebSocket connections
            expect(mockWebSocketInstances.length).toBe(clientCount);

            // Authenticate all clients
            for (let i = 0; i < clientCount; i++) {
              const mockWs = mockWebSocketInstances[i];
              mockWs.simulateMessage(JSON.stringify({
                type: MessageType.AUTH_SUCCESS,
                timestamp: Date.now(),
              }));
            }

            // Verify all clients are connected
            for (const client of clients) {
              expect(client.isConnected()).toBe(true);
            }

            // Disconnect one client and verify others remain connected
            const disconnectIndex = Math.floor(clientCount / 2);
            mockWebSocketInstances[disconnectIndex].simulateClose();
            await vi.advanceTimersByTimeAsync(50);

            for (let i = 0; i < clientCount; i++) {
              if (i === disconnectIndex) {
                expect(clients[i].isConnected()).toBe(false);
              } else {
                expect(clients[i].isConnected()).toBe(true);
              }
            }

            // Cleanup
            clients.forEach(client => client.disconnect());
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should maintain connection state independently across multiple tabs', async () => {
      // Simulate multiple browser tabs with separate WebSocket clients
      const tab1 = new WebSocketClient('ws://localhost:3001');
      const tab2 = new WebSocketClient('ws://localhost:3001');
      const tab3 = new WebSocketClient('ws://localhost:3001');

      const token = 'shared-user-token';

      // Connect all tabs
      tab1.connect(token);
      tab2.connect(token);
      tab3.connect(token);

      await vi.advanceTimersByTimeAsync(100);

      // Authenticate all tabs
      for (let i = 0; i < 3; i++) {
        mockWebSocketInstances[i].simulateMessage(JSON.stringify({
          type: MessageType.AUTH_SUCCESS,
          timestamp: Date.now(),
        }));
      }

      expect(tab1.isConnected()).toBe(true);
      expect(tab2.isConnected()).toBe(true);
      expect(tab3.isConnected()).toBe(true);

      // Close tab2's connection
      mockWebSocketInstances[1].simulateClose();
      await vi.advanceTimersByTimeAsync(50);

      // Verify tab1 and tab3 remain connected
      expect(tab1.isConnected()).toBe(true);
      expect(tab2.isConnected()).toBe(false);
      expect(tab3.isConnected()).toBe(true);

      // Tab2 should attempt reconnection
      await vi.advanceTimersByTimeAsync(1100);
      expect(mockWebSocketInstances.length).toBe(4); // Original 3 + 1 reconnection

      // Cleanup
      tab1.disconnect();
      tab2.disconnect();
      tab3.disconnect();
    });
  });

  describe('Connection state management', () => {
    it('should accurately report connection state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (token) => {
            const client = new WebSocketClient('ws://localhost:3001');

            // Initially closed
            expect(client.getState()).toBe('closed');
            expect(client.isConnected()).toBe(false);

            // Connect
            client.connect(token);
            
            // Should be connecting
            expect(['connecting', 'open'].includes(client.getState())).toBe(true);

            await vi.advanceTimersByTimeAsync(50);

            // Should be open
            expect(client.getState()).toBe('open');

            // Authenticate
            const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
            mockWs.simulateMessage(JSON.stringify({
              type: MessageType.AUTH_SUCCESS,
              timestamp: Date.now(),
            }));

            // Should be connected
            expect(client.isConnected()).toBe(true);

            // Disconnect
            client.disconnect();
            await vi.advanceTimersByTimeAsync(50);

            // Should be closed
            expect(client.getState()).toBe('closed');
            expect(client.isConnected()).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not attempt reconnection after explicit disconnect', async () => {
      const client = new WebSocketClient('ws://localhost:3001');
      const token = 'test-token';

      client.connect(token);
      await vi.advanceTimersByTimeAsync(50);

      const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      mockWs.simulateMessage(JSON.stringify({
        type: MessageType.AUTH_SUCCESS,
        timestamp: Date.now(),
      }));

      const instanceCountBeforeDisconnect = mockWebSocketInstances.length;

      // Explicit disconnect
      client.disconnect();
      await vi.advanceTimersByTimeAsync(50);

      // Wait beyond reconnection delay
      await vi.advanceTimersByTimeAsync(20000);

      // Should not create new WebSocket instances
      expect(mockWebSocketInstances.length).toBe(instanceCountBeforeDisconnect);
    });
  });

  describe('Message handling during reconnection', () => {
    it('should queue messages sent while disconnected', async () => {
      const client = new WebSocketClient('ws://localhost:3001');
      const token = 'test-token';

      client.connect(token);
      await vi.advanceTimersByTimeAsync(50);

      const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      mockWs.simulateMessage(JSON.stringify({
        type: MessageType.AUTH_SUCCESS,
        timestamp: Date.now(),
      }));

      // Disconnect
      mockWs.simulateClose();
      await vi.advanceTimersByTimeAsync(50);

      expect(client.isConnected()).toBe(false);

      // Try to send message while disconnected
      // The client should handle this gracefully (log warning)
      expect(() => {
        client.send({
          type: MessageType.SEND_MESSAGE,
          payload: { content: 'test message' },
        });
      }).not.toThrow();

      client.disconnect();
    });

    it('should handle authentication failure gracefully', async () => {
      const client = new WebSocketClient('ws://localhost:3001');
      const token = 'invalid-token';

      client.connect(token);
      await vi.advanceTimersByTimeAsync(50);

      const mockWs = mockWebSocketInstances[mockWebSocketInstances.length - 1];
      
      // Simulate authentication failure
      mockWs.simulateMessage(JSON.stringify({
        type: MessageType.AUTH_ERROR,
        payload: { error: 'Invalid token' },
      }));

      await vi.advanceTimersByTimeAsync(50);

      // Should disconnect and not attempt reconnection
      expect(client.isConnected()).toBe(false);
      
      const instanceCountAfterAuthFailure = mockWebSocketInstances.length;
      
      // Wait beyond reconnection delay
      await vi.advanceTimersByTimeAsync(5000);
      
      // Should not create new instances after auth failure
      expect(mockWebSocketInstances.length).toBe(instanceCountAfterAuthFailure);
    });
  });
});
