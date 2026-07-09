import { ExtendedWebSocket, MessageType, WebSocketMessage, AuthPayload, SendMessagePayload, TypingPayload, CallSignalPayload } from './types.js';
import { ConnectionManager } from './connectionManager.js';
import { validateToken } from './auth.js';
import { publishMessage } from './redis.js';

/**
 * Message Handler
 * Handles incoming WebSocket messages and routes them appropriately
 */
export class MessageHandler {
  constructor(private connectionManager: ConnectionManager) {}
  
  /**
   * Handle incoming WebSocket message
   * 
   * @param ws - WebSocket connection
   * @param data - Raw message data
   */
  async handleMessage(ws: ExtendedWebSocket, data: string): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // Route message based on type
      switch (message.type) {
        case MessageType.AUTH:
          await this.handleAuth(ws, message.payload as AuthPayload);
          break;
          
        case MessageType.PONG:
          // Pong is handled automatically by ws library
          ws.isAlive = true;
          break;
          
        case MessageType.SEND_MESSAGE:
          await this.handleSendMessage(ws, message.payload as SendMessagePayload);
          break;
          
        case MessageType.TYPING_START:
          await this.handleTypingStart(ws, message.payload as TypingPayload);
          break;
          
        case MessageType.TYPING_STOP:
          await this.handleTypingStop(ws, message.payload as TypingPayload);
          break;

        case MessageType.CALL_SIGNAL:
          await this.handleCallSignal(ws, message.payload as CallSignalPayload);
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
      this.sendError(ws, 'Invalid message format');
    }
  }
  
  /**
   * Handle authentication
   * Requirements: 19.3 - Authenticate user using existing VORP session tokens
   * 
   * @param ws - WebSocket connection
   * @param payload - Authentication payload
   */
  private async handleAuth(ws: ExtendedWebSocket, payload: AuthPayload): Promise<void> {
    if (!payload || !payload.token) {
      this.sendError(ws, 'Missing authentication token');
      ws.close();
      return;
    }
    
    // Validate JWT token
    const session = await validateToken(payload.token);
    
    if (!session) {
      this.connectionManager.sendMessage(ws, {
        type: MessageType.AUTH_ERROR,
        payload: { message: 'Invalid or expired token' },
        timestamp: Date.now(),
      });
      ws.close();
      return;
    }
    
    // Add authenticated connection
    this.connectionManager.addConnection(ws, session);
    
    // Send success response
    this.connectionManager.sendMessage(ws, {
      type: MessageType.AUTH_SUCCESS,
      payload: {
        userId: session.userId,
        channels: session.channels,
      },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Handle send message
   * 
   * @param ws - WebSocket connection
   * @param payload - Send message payload
   */
  private async handleSendMessage(ws: ExtendedWebSocket, payload: SendMessagePayload): Promise<void> {
    const session = this.connectionManager.getSession(ws);
    
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    // Validate channel membership
    if (!ws.channels?.has(payload.channel_id)) {
      this.sendError(ws, 'Not a member of this channel');
      return;
    }
    
    // Publish message to Redis for distribution across server instances
    await publishMessage('communication:messages', {
      type: MessageType.MESSAGE_NEW,
      payload: {
        channel_id: payload.channel_id,
        user_id: session.userId,
        content: payload.content,
        thread_parent_id: payload.thread_parent_id,
        attachments: payload.attachments,
        created_at: new Date().toISOString(),
      },
      targetChannelId: payload.channel_id,
      excludeUserId: session.userId,
    });
  }
  
  /**
   * Handle typing start
   * 
   * @param ws - WebSocket connection
   * @param payload - Typing payload
   */
  private async handleTypingStart(ws: ExtendedWebSocket, payload: TypingPayload): Promise<void> {
    const session = this.connectionManager.getSession(ws);
    
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    // Validate channel membership
    if (!ws.channels?.has(payload.channel_id)) {
      return;
    }
    
    // Publish typing indicator to Redis
    await publishMessage('communication:typing', {
      type: MessageType.USER_TYPING,
      payload: {
        channel_id: payload.channel_id,
        user_id: session.userId,
        is_typing: true,
      },
      targetChannelId: payload.channel_id,
      excludeUserId: session.userId,
    });
  }
  
  /**
   * Handle typing stop
   * 
   * @param ws - WebSocket connection
   * @param payload - Typing payload
   */
  private async handleTypingStop(ws: ExtendedWebSocket, payload: TypingPayload): Promise<void> {
    const session = this.connectionManager.getSession(ws);
    
    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }
    
    // Validate channel membership
    if (!ws.channels?.has(payload.channel_id)) {
      return;
    }
    
    // Publish typing indicator to Redis
    await publishMessage('communication:typing', {
      type: MessageType.USER_TYPING,
      payload: {
        channel_id: payload.channel_id,
        user_id: session.userId,
        is_typing: false,
      },
      targetChannelId: payload.channel_id,
      excludeUserId: session.userId,
    });
  }

  /**
   * Handle WebRTC call signaling
   * 
   * @param ws - WebSocket connection
   * @param payload - Call signaling payload
   */
  private async handleCallSignal(ws: ExtendedWebSocket, payload: CallSignalPayload): Promise<void> {
    const session = this.connectionManager.getSession(ws);

    if (!session) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    if (!payload || !payload.target_user_id || !payload.channel_id || !payload.signal_type) {
      this.sendError(ws, 'Invalid call signaling payload');
      return;
    }

    if (!ws.channels?.has(payload.channel_id)) {
      this.sendError(ws, 'Not a member of this channel');
      return;
    }

    await publishMessage('communication:calls', {
      type: MessageType.CALL_SIGNAL,
      payload: {
        channel_id: payload.channel_id,
        target_user_id: payload.target_user_id,
        signal_type: payload.signal_type,
        sdp: payload.sdp,
        candidate: payload.candidate,
        call_id: payload.call_id,
        from_user_id: session.userId,
      },
      targetUserId: payload.target_user_id,
    });
  }
  
  /**
   * Send error message to client
   * 
   * @param ws - WebSocket connection
   * @param message - Error message
   */
  private sendError(ws: ExtendedWebSocket, message: string): void {
    this.connectionManager.sendMessage(ws, {
      type: MessageType.ERROR,
      payload: { message },
      timestamp: Date.now(),
    });
  }
}
