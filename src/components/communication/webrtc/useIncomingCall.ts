/**
 * useIncomingCall Hook
 * Task 13.4: Implement incoming call notifications
 * Requirements: 2.9
 * 
 * Manages incoming call state and displays notification UI
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/lib/websocket/useWebSocket';
import { MessageType, WebSocketMessage } from '@/lib/websocket/client';

export interface IncomingCall {
  callId: string;
  callType: 'voice' | 'video';
  channelId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  channelName?: string;
}

interface UseIncomingCallOptions {
  onAccept?: (call: IncomingCall) => void;
  onReject?: (call: IncomingCall) => void;
}

/**
 * Hook to manage incoming call notifications
 * 
 * Features:
 * - Listen for incoming call WebSocket events
 * - Display incoming call notification
 * - Handle accept/reject actions
 * - Play notification sound
 */
export function useIncomingCall({ onAccept, onReject }: UseIncomingCallOptions = {}) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { on, off, send } = useWebSocket();

  // Handle incoming call WebSocket event
  useEffect(() => {
    const handleIncomingCall = (message: WebSocketMessage) => {
      const payload = message.payload;
      
      if (!payload) {
        console.warn('[IncomingCall] Missing payload in call_incoming event');
        return;
      }

      const call: IncomingCall = {
        callId: payload.call_id,
        callType: payload.call_type,
        channelId: payload.channel_id,
        callerId: payload.caller_id,
        callerName: payload.caller_name,
        callerAvatar: payload.caller_avatar,
        channelName: payload.channel_name,
      };

      console.log('[IncomingCall] Received incoming call:', call);
      setIncomingCall(call);
    };

    on(MessageType.CALL_INCOMING, handleIncomingCall);

    return () => {
      off(MessageType.CALL_INCOMING, handleIncomingCall);
    };
  }, [on, off]);

  // Accept call
  const acceptCall = useCallback(() => {
    if (!incomingCall) return;

    console.log('[IncomingCall] Accepting call:', incomingCall.callId);
    
    // Send accept signal to server
    send({
      type: MessageType.CALL_SIGNAL,
      payload: {
        call_id: incomingCall.callId,
        channel_id: incomingCall.channelId,
        signal_type: 'accept',
      },
    });

    // Call user-provided callback
    onAccept?.(incomingCall);

    // Clear incoming call state
    setIncomingCall(null);
  }, [incomingCall, send, onAccept]);

  // Reject call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    console.log('[IncomingCall] Rejecting call:', incomingCall.callId);
    
    // Send reject signal to server
    send({
      type: MessageType.CALL_SIGNAL,
      payload: {
        call_id: incomingCall.callId,
        channel_id: incomingCall.channelId,
        signal_type: 'reject',
      },
    });

    // Call user-provided callback
    onReject?.(incomingCall);

    // Clear incoming call state
    setIncomingCall(null);
  }, [incomingCall, send, onReject]);

  return {
    incomingCall,
    acceptCall,
    rejectCall,
  };
}
