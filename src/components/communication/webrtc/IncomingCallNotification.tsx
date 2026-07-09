/**
 * IncomingCallNotification Component
 * Task 13.4: Implement incoming call notifications
 * Requirements: 2.9
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface IncomingCallNotificationProps {
  callId: string;
  callType: 'voice' | 'video';
  callerName: string;
  callerAvatar?: string;
  channelName?: string;
  onAccept: () => void;
  onReject: () => void;
  autoRejectAfter?: number; // milliseconds
}

/**
 * IncomingCallNotification - Display incoming call with accept/reject options
 * 
 * Features:
 * - Display caller information
 * - Accept/reject buttons
 * - Notification sound
 * - Auto-reject after timeout
 */
export const IncomingCallNotification = ({
  callId,
  callType,
  callerName,
  callerAvatar,
  channelName,
  onAccept,
  onReject,
  autoRejectAfter = 30000, // 30 seconds default
}: IncomingCallNotificationProps) => {
  const [timeRemaining, setTimeRemaining] = useState(autoRejectAfter / 1000);
  const [isRinging, setIsRinging] = useState(true);

  // Play notification sound
  useEffect(() => {
    // Use existing pop.mp3 sound as notification (looped)
    // In production, replace with a proper incoming call ringtone
    const audio = new Audio('/sounds/pop.mp3');
    audio.loop = true;
    audio.volume = 0.5; // Set volume to 50% to avoid being too loud
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.warn('[Call] Failed to play notification sound:', error);
        // Browser may block autoplay - user interaction required
      });
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  // Auto-reject timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onReject]);

  // Pulse animation for ringing
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRinging((prev) => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 right-4 z-50"
      >
        <Card className="w-96 p-6 shadow-2xl border-2 border-primary/50">
          <div className="flex flex-col items-center gap-4">
            {/* Caller avatar with pulse animation */}
            <motion.div
              animate={{
                scale: isRinging ? 1.05 : 1,
              }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <Avatar className="h-24 w-24">
                <AvatarImage src={callerAvatar} alt={callerName} />
                <AvatarFallback className="text-2xl">
                  {callerName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {/* Call type indicator */}
              <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2">
                {callType === 'video' ? (
                  <Video className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Phone className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
            </motion.div>

            {/* Caller info */}
            <div className="text-center">
              <h3 className="font-semibold text-lg">{callerName}</h3>
              <p className="text-sm text-muted-foreground">
                Incoming {callType} call
              </p>
              {channelName && (
                <p className="text-xs text-muted-foreground mt-1">
                  in #{channelName}
                </p>
              )}
            </div>

            {/* Timer */}
            <div className="text-sm text-muted-foreground">
              Auto-reject in {timeRemaining}s
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 w-full">
              <Button
                variant="destructive"
                size="lg"
                onClick={onReject}
                className="flex-1 rounded-full"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                Decline
              </Button>
              
              <Button
                variant="default"
                size="lg"
                onClick={onAccept}
                className="flex-1 rounded-full bg-green-600 hover:bg-green-700"
              >
                <Phone className="h-5 w-5 mr-2" />
                Accept
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Minimal incoming call toast (for when user is in another call)
 */
export const IncomingCallToast = ({
  callerName,
  callType,
  onAccept,
  onReject,
}: {
  callerName: string;
  callType: 'voice' | 'video';
  onAccept: () => void;
  onReject: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <Card className="p-4 shadow-lg flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          {callType === 'video' ? (
            <Video className="h-4 w-4 text-primary" />
          ) : (
            <Phone className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-medium">{callerName} is calling...</span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onAccept}
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
