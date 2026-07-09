import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from './connectionManager';
import { ExtendedWebSocket, UserSession, MessageType } from './types';
import { WebSocket } from 'ws';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockWebSocket: ExtendedWebSocket;
  let mockSession: UserSession;
  
  beforeEach(() => {
    connectionManager = new ConnectionManager();
    
    // Create mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      on: vi.fn(),
      isAlive: true,
    } as any;
    
    // Create mock session
    mockSession = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'Employee',
      channels: ['channel-1', 'channel-2'],
    };
  });
  
  afterEach(() => {
    connectionManager.closeAll();
  });
  
  describe('addConnection', () => {
    it('should add a new connection', () => {
      connectionManager.addConnection(mockWebSocket, mockSession);
      
      expect(connectionManager.isUserConnected('user-123')).toBe(true);
      expect(connectionManager.getConnectedUserCount()).toBe(1);
      expect(connectionManager.getTotalConnectionCount()).toBe(1);
    });
    
    it('should set WebSocket properties', () => {
      connectionManager.addConnection(mockWebSocket, mockSession);
      
      expect(mockWebSocket.userId).toBe('user-123');
      expect(mockWebSocket.isAlive).toBe(true);
      expect(mockWebSocket.channels).toBeInstanceOf(Set);
      expect(mockWebSocket.channels?.has('channel-1')).toBe(true);
      expect(mockWebSocket.channels?.has('channel-2')).toBe(true);
    });
    
    it('should support multiple connections for same user', () => {
      const mockWebSocket2 = { ...mockWebSocket } as ExtendedWebSocket;
      
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.addConnection(mockWebSocket2, mockSession);
      
      expect(connectionManager.getConnectedUserCount()).toBe(1);
      expect(connectionManager.getTotalConnectionCount()).toBe(2);
    });
  });
  
  describe('removeConnection', () => {
    it('should remove a connection', () => {
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.removeConnection(mockWebSocket);
      
      expect(connectionManager.isUserConnected('user-123')).toBe(false);
      expect(connectionManager.getConnectedUserCount()).toBe(0);
    });
    
    it('should keep user connected if they have other connections', () => {
      const mockWebSocket2 = { ...mockWebSocket } as ExtendedWebSocket;
      
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.addConnection(mockWebSocket2, mockSession);
      connectionManager.removeConnection(mockWebSocket);
      
      expect(connectionManager.isUserConnected('user-123')).toBe(true);
      expect(connectionManager.getTotalConnectionCount()).toBe(1);
    });
  });
  
  describe('sendMessage', () => {
    it('should send message to open WebSocket', () => {
      connectionManager.addConnection(mockWebSocket, mockSession);
      
      const message = {
        type: MessageType.MESSAGE_NEW,
        payload: { content: 'Hello' },
        timestamp: Date.now(),
      };
      
      connectionManager.sendMessage(mockWebSocket, message);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
    
    it('should not send message to closed WebSocket', () => {
      mockWebSocket.readyState = WebSocket.CLOSED;
      connectionManager.addConnection(mockWebSocket, mockSession);
      
      const message = {
        type: MessageType.MESSAGE_NEW,
        payload: { content: 'Hello' },
        timestamp: Date.now(),
      };
      
      connectionManager.sendMessage(mockWebSocket, message);
      
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });
  
  describe('sendToUser', () => {
    it('should send message to all user connections', () => {
      const mockWebSocket2 = {
        ...mockWebSocket,
        send: vi.fn(),
      } as any;
      
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.addConnection(mockWebSocket2, mockSession);
      
      const message = {
        type: MessageType.MESSAGE_NEW,
        payload: { content: 'Hello' },
        timestamp: Date.now(),
      };
      
      connectionManager.sendToUser('user-123', message);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket2.send).toHaveBeenCalled();
    });
  });
  
  describe('sendToChannel', () => {
    it('should send message to all channel members', () => {
      const mockSession2: UserSession = {
        userId: 'user-456',
        email: 'test2@example.com',
        role: 'Employee',
        channels: ['channel-1'],
      };
      
      const mockWebSocket2 = {
        ...mockWebSocket,
        send: vi.fn(),
      } as any;
      
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.addConnection(mockWebSocket2, mockSession2);
      
      const message = {
        type: MessageType.MESSAGE_NEW,
        payload: { content: 'Hello' },
        timestamp: Date.now(),
      };
      
      connectionManager.sendToChannel('channel-1', message);
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket2.send).toHaveBeenCalled();
    });
    
    it('should exclude specified user from broadcast', () => {
      const mockSession2: UserSession = {
        userId: 'user-456',
        email: 'test2@example.com',
        role: 'Employee',
        channels: ['channel-1'],
      };
      
      const mockWebSocket2 = {
        ...mockWebSocket,
        send: vi.fn(),
      } as any;
      
      connectionManager.addConnection(mockWebSocket, mockSession);
      connectionManager.addConnection(mockWebSocket2, mockSession2);
      
      const message = {
        type: MessageType.MESSAGE_NEW,
        payload: { content: 'Hello' },
        timestamp: Date.now(),
      };
      
      connectionManager.sendToChannel('channel-1', message, 'user-123');
      
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      expect(mockWebSocket2.send).toHaveBeenCalled();
    });
  });
  
  describe('getSession', () => {
    it('should return user session for WebSocket', () => {
      connectionManager.addConnection(mockWebSocket, mockSession);
      
      const session = connectionManager.getSession(mockWebSocket);
      
      expect(session).toEqual(mockSession);
    });
    
    it('should return undefined for unknown WebSocket', () => {
      const unknownWs = { ...mockWebSocket } as ExtendedWebSocket;
      
      const session = connectionManager.getSession(unknownWs);
      
      expect(session).toBeUndefined();
    });
  });
});
