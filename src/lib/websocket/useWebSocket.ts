import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient, MessageType, WebSocketMessage } from './client';
import { useAuth } from '@/components/contexts/AuthContext';

/**
 * React hook for WebSocket connection management
 * 
 * Provides automatic connection/disconnection based on authentication state
 * and component lifecycle.
 */
export function useWebSocket() {
  const { session } = useAuth();
  const clientRef = useRef<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closing' | 'closed'>('closed');
  
  // Initialize WebSocket client
  useEffect(() => {
    // Get WebSocket URL from environment or default to localhost
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';
    
    if (!clientRef.current) {
      clientRef.current = new WebSocketClient(wsUrl);
    }
    
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);
  
  // Connect when authenticated
  useEffect(() => {
    if (session?.access_token && clientRef.current) {
      clientRef.current.connect(session.access_token);
      
      // Monitor connection state
      const checkConnection = setInterval(() => {
        if (clientRef.current) {
          setIsConnected(clientRef.current.isConnected());
          setConnectionState(clientRef.current.getState());
        }
      }, 1000);
      
      return () => {
        clearInterval(checkConnection);
      };
    } else if (clientRef.current) {
      clientRef.current.disconnect();
      setIsConnected(false);
      setConnectionState('closed');
    }
  }, [session?.access_token]);
  
  /**
   * Send message through WebSocket
   */
  const send = useCallback((message: WebSocketMessage) => {
    if (clientRef.current) {
      clientRef.current.send(message);
    }
  }, []);
  
  /**
   * Register message handler
   */
  const on = useCallback((type: MessageType, handler: (message: WebSocketMessage) => void) => {
    if (clientRef.current) {
      clientRef.current.on(type, handler);
    }
  }, []);
  
  /**
   * Unregister message handler
   */
  const off = useCallback((type: MessageType, handler: (message: WebSocketMessage) => void) => {
    if (clientRef.current) {
      clientRef.current.off(type, handler);
    }
  }, []);
  
  return {
    isConnected,
    connectionState,
    send,
    on,
    off,
    client: clientRef.current,
  };
}
