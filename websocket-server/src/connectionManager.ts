import { WebSocket } from 'ws';
import { ExtendedWebSocket, MessageType, WebSocketMessage, UserSession } from './types.js';
import { config } from './config.js';
import { updatePresence } from './auth.js';

/**
 * Connection Manager
 * Manages WebSocket connections, heartbeat, and user sessions
 * 
 * Requirements:
 * - 19.5: Maintain connection heartbeat with 30-second ping intervals
 * - 19.6: Close connection and attempt reconnection when heartbeat fails
 */
export class ConnectionManager {
  private connections: Map<string, Set<ExtendedWebSocket>> = new Map();
  private userSessions: Map<ExtendedWebSocket, UserSession> = new Map();
  
  /**
   * Add authenticated connection
   * 
   * @param ws - WebSocket connection
   * @param session - User session
   */
  addConnection(ws: ExtendedWebSocket, session: UserSession): void {
    // Store user session
    this.userSessions.set(ws, session);
    
    // Add to user's connection set
    if (!this.connections.has(session.userId)) {
      this.connections.set(session.userId, new Set());
    }
    this.connections.get(session.userId)!.add(ws);
    
    // Initialize connection properties
    ws.userId = session.userId;
    ws.isAlive = true;
    ws.channels = new Set(session.channels);
    
    // Start heartbeat
    this.startHeartbeat(ws);
    
    // Update presence to online
    updatePresence(session.userId, 'online').catch((error) => {
      console.error('Failed to update presence:', error);
    });
    
    console.log(`User ${session.userId} connected (${session.email})`);
  }
  
  /**
   * Remove connection
   * 
   * @param ws - WebSocket connection
   */
  removeConnection(ws: ExtendedWebSocket): void {
    const session = this.userSessions.get(ws);
    
    if (session) {
      const userConnections = this.connections.get(session.userId);
      
      if (userConnections) {
        userConnections.delete(ws);
        
        // If no more connections for this user, update presence to offline
        if (userConnections.size === 0) {
          this.connections.delete(session.userId);
          updatePresence(session.userId, 'offline').catch((error) => {
            console.error('Failed to update presence:', error);
          });
        }
      }
      
      this.userSessions.delete(ws);
      console.log(`User ${session.userId} disconnected`);
    }
    
    // Clear heartbeat timer
    if (ws.heartbeatTimer) {
      clearInterval(ws.heartbeatTimer);
    }
  }
  
  /**
   * Start heartbeat for connection
   * Requirements: 19.5 - Maintain connection heartbeat with 30-second ping intervals
   * 
   * @param ws - WebSocket connection
   */
  private startHeartbeat(ws: ExtendedWebSocket): void {
    // Clear existing timer if any
    if (ws.heartbeatTimer) {
      clearInterval(ws.heartbeatTimer);
    }
    
    // Send ping every 30 seconds
    ws.heartbeatTimer = setInterval(() => {
      if (ws.isAlive === false) {
        // Heartbeat failed - close connection
        // Requirements: 19.6 - Close connection when heartbeat fails
        console.log(`Heartbeat failed for user ${ws.userId}, closing connection`);
        this.removeConnection(ws);
        ws.terminate();
        return;
      }
      
      // Mark as not alive, will be set to true when pong is received
      ws.isAlive = false;
      
      // Send ping
      this.sendMessage(ws, {
        type: MessageType.PING,
        timestamp: Date.now(),
      });
    }, config.heartbeat.interval);
    
    // Handle pong responses
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }
  
  /**
   * Send message to specific WebSocket connection
   * 
   * @param ws - WebSocket connection
   * @param message - Message to send
   */
  sendMessage(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  }
  
  /**
   * Send message to all connections of a specific user
   * Requirements: 19.9 - Synchronize state across all tabs when user has multiple browser tabs open
   * 
   * @param userId - User ID
   * @param message - Message to send
   */
  sendToUser(userId: string, message: WebSocketMessage): void {
    const userConnections = this.connections.get(userId);
    
    if (userConnections) {
      userConnections.forEach((ws) => {
        this.sendMessage(ws, message);
      });
    }
  }
  
  /**
   * Send message to all users in a channel
   * 
   * @param channelId - Channel ID
   * @param message - Message to send
   * @param excludeUserId - Optional user ID to exclude from broadcast
   */
  sendToChannel(channelId: string, message: WebSocketMessage, excludeUserId?: string): void {
    this.connections.forEach((userConnections, userId) => {
      if (excludeUserId && userId === excludeUserId) {
        return;
      }
      
      userConnections.forEach((ws) => {
        if (ws.channels?.has(channelId)) {
          this.sendMessage(ws, message);
        }
      });
    });
  }
  
  /**
   * Broadcast message to all connected users
   * 
   * @param message - Message to send
   */
  broadcast(message: WebSocketMessage): void {
    this.connections.forEach((userConnections) => {
      userConnections.forEach((ws) => {
        this.sendMessage(ws, message);
      });
    });
  }
  
  /**
   * Get user session for WebSocket connection
   * 
   * @param ws - WebSocket connection
   * @returns User session or undefined
   */
  getSession(ws: ExtendedWebSocket): UserSession | undefined {
    return this.userSessions.get(ws);
  }
  
  /**
   * Get all connections for a user
   * 
   * @param userId - User ID
   * @returns Set of WebSocket connections
   */
  getUserConnections(userId: string): Set<ExtendedWebSocket> | undefined {
    return this.connections.get(userId);
  }
  
  /**
   * Get total number of connected users
   */
  getConnectedUserCount(): number {
    return this.connections.size;
  }
  
  /**
   * Get total number of WebSocket connections
   */
  getTotalConnectionCount(): number {
    let count = 0;
    this.connections.forEach((userConnections) => {
      count += userConnections.size;
    });
    return count;
  }
  
  /**
   * Check if user is connected
   * 
   * @param userId - User ID
   * @returns True if user has at least one active connection
   */
  isUserConnected(userId: string): boolean {
    const userConnections = this.connections.get(userId);
    return userConnections !== undefined && userConnections.size > 0;
  }
  
  /**
   * Close all connections
   */
  closeAll(): void {
    this.connections.forEach((userConnections) => {
      userConnections.forEach((ws) => {
        if (ws.heartbeatTimer) {
          clearInterval(ws.heartbeatTimer);
        }
        ws.close();
      });
    });
    
    this.connections.clear();
    this.userSessions.clear();
    console.log('All connections closed');
  }
}
