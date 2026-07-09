/**
 * WebSocket Client Library for VORP Communication Module
 * 
 * This module provides WebSocket connectivity with:
 * - JWT authentication
 * - Automatic reconnection with exponential backoff
 * - Heartbeat monitoring
 * - Type-safe message handling
 */

export { WebSocketClient, MessageType } from './client';
export type { WebSocketMessage } from './client';
export { useWebSocket } from './useWebSocket';
