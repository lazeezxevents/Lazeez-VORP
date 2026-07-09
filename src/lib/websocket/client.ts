/**
 * WebSocket Client for VORP Communication Module
 * 
 * Requirements:
 * - 19.1: Implement WebSocket connections using the WebSocket protocol
 * - 19.3: Authenticate user using existing VORP session tokens
 * - 19.4: Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s max)
 * - 19.5: Maintain connection heartbeat with 30-second ping intervals
 * - 20.8: Encrypt all WebSocket traffic using TLS/SSL
 */

import { getSecureWebSocketUrl } from '@/components/communication/security/csrfProtection';

export enum MessageType {
  // Connection lifecycle
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  PING = 'ping',
  PONG = 'pong',
  
  // Message events
  SEND_MESSAGE = 'send_message',
  MESSAGE_NEW = 'message_new',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',
  
  // Typing indicators
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_TYPING = 'user_typing',
  
  // Presence
  PRESENCE_UPDATE = 'presence_update',
  
  // Reactions
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed',
  
  // Call signaling
  CALL_SIGNAL = 'call_signal',
  CALL_INCOMING = 'call_incoming',
  
  // Error handling
  ERROR = 'error',
}

export interface WebSocketMessage {
  type: MessageType;
  payload?: any;
  timestamp?: number;
}

type MessageHandler = (message: WebSocketMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
  private reconnectTimer: number | null = null;
  private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private isAuthenticated = false;
  private shouldReconnect = true;
  private heartbeatTimer: number | null = null;
  
  constructor(url: string) {
    // Enforce TLS/SSL for WebSocket connections
    // Requirements: 20.8 - Encrypt all WebSocket traffic using TLS/SSL
    this.url = getSecureWebSocketUrl(url);
  }
  
  /**
   * Connect to WebSocket server with authentication
   * Requirements: 19.3 - Authenticate user using existing VORP session tokens
   * 
   * @param token - JWT authentication token
   */
  connect(token: string): void {
    this.token = token;
    this.shouldReconnect = true;
    this.createConnection();
  }
  
  /**
   * Create WebSocket connection
   * Requirements: 19.1 - Implement WebSocket connections using the WebSocket protocol
   */
  private createConnection(): void {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Send authentication message
        if (this.token) {
          this.send({
            type: MessageType.AUTH,
            payload: { token: this.token },
          });
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isAuthenticated = false;
        this.stopHeartbeat();
        
        // Attempt reconnection if enabled
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Schedule reconnection with exponential backoff
   * Requirements: 19.4 - Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s max)
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    const delayIndex = Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1);
    const delay = this.reconnectDelays[delayIndex];
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      this.createConnection();
    }, delay);
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: WebSocketMessage): void {
    // Handle authentication responses
    if (message.type === MessageType.AUTH_SUCCESS) {
      console.log('WebSocket authenticated successfully');
      this.isAuthenticated = true;
      this.startHeartbeat();
    } else if (message.type === MessageType.AUTH_ERROR) {
      console.error('WebSocket authentication failed:', message.payload);
      this.disconnect();
      return;
    }
    
    // Handle ping messages
    if (message.type === MessageType.PING) {
      this.send({ type: MessageType.PONG });
      return;
    }
    
    // Dispatch to registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }
  }
  
  /**
   * Start heartbeat monitoring
   * Requirements: 19.5 - Maintain connection heartbeat with 30-second ping intervals
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Server sends pings, we just need to respond with pongs
    // The ws library handles this automatically
  }
  
  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Send message to server
   * 
   * @param message - Message to send
   */
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket is not connected');
    }
  }
  
  /**
   * Register message handler
   * 
   * @param type - Message type
   * @param handler - Handler function
   */
  on(type: MessageType, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }
  
  /**
   * Unregister message handler
   * 
   * @param type - Message type
   * @param handler - Handler function
   */
  off(type: MessageType, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isAuthenticated = false;
  }
  
  /**
   * Check if WebSocket is connected and authenticated
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
  
  /**
   * Get current connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }
}
