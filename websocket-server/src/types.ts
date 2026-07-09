import { WebSocket } from 'ws';

/**
 * Extended WebSocket with custom properties for connection management
 */
export interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  heartbeatTimer?: NodeJS.Timeout;
  channels?: Set<string>;
}

/**
 * WebSocket message types for client-server communication
 */
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

/**
 * Base message structure
 */
export interface WebSocketMessage {
  type: MessageType;
  payload?: any;
  timestamp?: number;
}

/**
 * Authentication message payload
 */
export interface AuthPayload {
  token: string;
}

/**
 * Send message payload
 */
export interface SendMessagePayload {
  channel_id: string;
  content: string;
  thread_parent_id?: string;
  attachments?: Array<{
    file_url: string;
    file_name: string;
    file_size: number;
    file_type: string;
  }>;
}

/**
 * Typing indicator payload
 */
export interface TypingPayload {
  channel_id: string;
}

/**
 * Call signaling payload
 */
export interface CallSignalPayload {
  channel_id: string;
  signal_type: 'offer' | 'answer' | 'ice-candidate';
  target_user_id: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from_user_id?: string;
  call_id?: string;
}

/**
 * User session information
 */
export interface UserSession {
  userId: string;
  email: string;
  role: string;
  channels: string[];
}

/**
 * Redis pub/sub message structure
 */
export interface RedisPubSubMessage {
  type: MessageType;
  payload: any;
  targetUserId?: string;
  targetChannelId?: string;
  excludeUserId?: string;
}
