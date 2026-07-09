/**
 * IncomingCallManager Component
 * Task 13.4: Implement incoming call notifications
 * Requirements: 2.9
 * 
 * Manages incoming call notifications and integrates with WebSocket
 */

import { useIncomingCall } from './useIncomingCall';
import { IncomingCallNotification } from './IncomingCallNotification';

interface IncomingCallManagerProps {
  onAcceptCall?: (callId: string, callType: 'voice' | 'video', channelId: string) => void;
  onRejectCall?: (callId: string) => void;
}

/**
 * IncomingCallManager - Manages incoming call notifications
 * 
 * This component listens for incoming call WebSocket events and displays
 * the IncomingCallNotification UI when a call is received.
 * 
 * Usage:
 * ```tsx
 * <IncomingCallManager
 *   onAcceptCall={(callId, callType, channelId) => {
 *     // Navigate to call interface or join call
 *   }}
 *   onRejectCall={(callId) => {
 *     // Handle call rejection
 *   }}
 * />
 * ```
 */
export const IncomingCallManager = ({
  onAcceptCall,
  onRejectCall,
}: IncomingCallManagerProps) => {
  const { incomingCall, acceptCall, rejectCall } = useIncomingCall({
    onAccept: (call) => {
      onAcceptCall?.(call.callId, call.callType, call.channelId);
    },
    onReject: (call) => {
      onRejectCall?.(call.callId);
    },
  });

  if (!incomingCall) {
    return null;
  }

  return (
    <IncomingCallNotification
      callId={incomingCall.callId}
      callType={incomingCall.callType}
      callerName={incomingCall.callerName}
      callerAvatar={incomingCall.callerAvatar}
      channelName={incomingCall.channelName}
      onAccept={acceptCall}
      onReject={rejectCall}
      autoRejectAfter={30000} // 30 seconds
    />
  );
};
