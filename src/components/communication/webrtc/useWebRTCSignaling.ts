import { useEffect, useCallback } from 'react';
import { useWebSocket, MessageType, WebSocketMessage } from '@/lib/websocket';
import { webRTCManager } from './WebRTCManager';

interface UseWebRTCSignalingOptions {
  channelId: string | null;
}

interface OutgoingCallSignalPayload {
  targetUserId: string;
  channelId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callId?: string;
}

interface IncomingCallSignalPayload {
  channel_id: string;
  from_user_id: string;
  signal_type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  call_id?: string;
}

/**
 * Hook to wire WebRTC signaling over the WebSocket layer.
 */
export function useWebRTCSignaling({ channelId }: UseWebRTCSignalingOptions) {
  const { send, on, off, isConnected } = useWebSocket();

  const sendSignal = useCallback(
    (payload: OutgoingCallSignalPayload) => {
      if (!payload.channelId) {
        console.warn('[WebRTC] Missing channel id for signaling payload');
        return;
      }

      const message: WebSocketMessage = {
        type: MessageType.CALL_SIGNAL,
        payload: {
          channel_id: payload.channelId,
          target_user_id: payload.targetUserId,
          signal_type: payload.signalType,
          sdp: payload.sdp,
          candidate: payload.candidate,
          call_id: payload.callId,
        },
        timestamp: Date.now(),
      };

      send(message);
    },
    [send]
  );

  useEffect(() => {
    webRTCManager.setSignalSender(sendSignal);
  }, [sendSignal]);

  useEffect(() => {
    webRTCManager.setChannelId(channelId);

    return () => {
      webRTCManager.setChannelId(null);
    };
  }, [channelId]);

  useEffect(() => {
    const handler = (message: WebSocketMessage) => {
      const payload = message.payload as IncomingCallSignalPayload | undefined;
      if (!payload || !payload.from_user_id) {
        return;
      }

      if (channelId && payload.channel_id !== channelId) {
        return;
      }

      void webRTCManager.handleSignalPayload({
        fromUserId: payload.from_user_id,
        channelId: payload.channel_id,
        signalType: payload.signal_type,
        sdp: payload.sdp,
        candidate: payload.candidate,
        callId: payload.call_id,
      });
    };

    on(MessageType.CALL_SIGNAL, handler);
    return () => off(MessageType.CALL_SIGNAL, handler);
  }, [channelId, on, off]);

  return { isConnected };
}
