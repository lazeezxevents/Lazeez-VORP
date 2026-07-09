/**
 * CallInterface Component
 * Task 13.2: Create CallInterface component
 * Requirements: 2.6, 36.1, 36.7
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  Settings,
  Users,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/components/lib/utils';

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  stream?: MediaStream;
  audioLevel?: number;
}

interface CallInterfaceProps {
  callId: string;
  callType: 'voice' | 'video';
  participants: Participant[];
  localStream?: MediaStream;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSelectDevice: (deviceId: string, type: 'audio' | 'video' | 'speaker') => void;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  isScreenSharing?: boolean;
  connectionQuality?: 'excellent' | 'good' | 'poor';
}

/**
 * CallInterface - Main UI for voice and video calls
 * 
 * Features:
 * - Participant grid layout (1-4 video streams)
 * - Call controls (mute, video toggle, screen share, end call)
 * - Call duration display
 * - Connection quality indicator
 * - Audio level indicators
 * - Device selection
 */
export const CallInterface = ({
  callId,
  callType,
  participants,
  localStream,
  onEndCall,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onSelectDevice,
  isMuted = false,
  isVideoEnabled = true,
  isScreenSharing = false,
  connectionQuality = 'good',
}: CallInterfaceProps) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const callStartTime = useRef(Date.now());

  // Update call duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Enumerate media devices
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
      } catch (error) {
        console.error('[Call] Failed to enumerate devices:', error);
      }
    };

    enumerateDevices();
  }, []);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Connection quality indicator
  const qualityConfig = {
    excellent: { color: 'bg-green-500', label: 'Excellent' },
    good: { color: 'bg-yellow-500', label: 'Good' },
    poor: { color: 'bg-red-500', label: 'Poor' },
  };

  // Calculate grid layout based on participant count
  const getGridLayout = (count: number): string => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    return 'grid-cols-3';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'fixed inset-0 z-50 bg-black flex flex-col',
        isFullscreen && 'fullscreen'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
            {formatDuration(callDuration)}
          </Badge>
          
          <div className="flex items-center gap-2">
            <span
              className={cn('w-2 h-2 rounded-full', qualityConfig[connectionQuality].color)}
            />
            <span className="text-sm text-white/70">
              {qualityConfig[connectionQuality].label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowParticipants(!showParticipants)}
            className="text-white hover:bg-white/10"
          >
            <Users className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-white hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Participant Grid */}
      <div className="flex-1 p-4">
        <div className={cn('grid gap-4 h-full', getGridLayout(participants.length + 1))}>
          {/* Local video */}
          <ParticipantVideo
            participant={{
              id: 'local',
              name: 'You',
              isMuted,
              isVideoEnabled,
              stream: localStream,
            }}
            isLocal
          />

          {/* Remote participants */}
          {participants.map((participant) => (
            <ParticipantVideo
              key={participant.id}
              participant={participant}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 bg-black/50 backdrop-blur">
        <div className="flex items-center justify-center gap-4">
          {/* Mute/Unmute */}
          <Button
            size="lg"
            variant={isMuted ? 'destructive' : 'secondary'}
            onClick={onToggleMute}
            className="rounded-full h-14 w-14"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          {/* Video toggle (only for video calls) */}
          {callType === 'video' && (
            <Button
              size="lg"
              variant={!isVideoEnabled ? 'destructive' : 'secondary'}
              onClick={onToggleVideo}
              className="rounded-full h-14 w-14"
            >
              {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </Button>
          )}

          {/* Screen share */}
          {callType === 'video' && (
            <Button
              size="lg"
              variant={isScreenSharing ? 'default' : 'secondary'}
              onClick={onToggleScreenShare}
              className="rounded-full h-14 w-14"
            >
              {isScreenSharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
            </Button>
          )}

          {/* Device settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                variant="secondary"
                className="rounded-full h-14 w-14"
              >
                <Settings className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-2">
                <p className="text-sm font-medium mb-2">Microphone</p>
                {audioDevices.map((device) => (
                  <DropdownMenuItem
                    key={device.deviceId}
                    onClick={() => onSelectDevice(device.deviceId, 'audio')}
                  >
                    {device.label || 'Microphone'}
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="p-2 border-t">
                <p className="text-sm font-medium mb-2">Speakers</p>
                {outputDevices.length === 0 && (
                  <DropdownMenuItem disabled>
                    Default output
                  </DropdownMenuItem>
                )}
                {outputDevices.map((device) => (
                  <DropdownMenuItem
                    key={device.deviceId}
                    onClick={() => onSelectDevice(device.deviceId, 'speaker')}
                  >
                    {device.label || 'Speaker'}
                  </DropdownMenuItem>
                ))}
              </div>
              {callType === 'video' && (
                <div className="p-2 border-t">
                  <p className="text-sm font-medium mb-2">Camera</p>
                  {videoDevices.map((device) => (
                    <DropdownMenuItem
                      key={device.deviceId}
                      onClick={() => onSelectDevice(device.deviceId, 'video')}
                    >
                      {device.label || 'Camera'}
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* End call */}
          <Button
            size="lg"
            variant="destructive"
            onClick={onEndCall}
            className="rounded-full h-14 w-14"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Participants sidebar */}
      <AnimatePresence>
        {showParticipants && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className="absolute right-0 top-0 bottom-0 w-80 bg-background border-l p-4 overflow-y-auto"
          >
            <h3 className="font-semibold mb-4">
              Participants ({participants.length + 1})
            </h3>
            <div className="space-y-2">
              <ParticipantListItem
                name="You"
                isMuted={isMuted}
                isVideoEnabled={isVideoEnabled}
              />
              {participants.map((p) => (
                <ParticipantListItem
                  key={p.id}
                  name={p.name}
                  isMuted={p.isMuted}
                  isVideoEnabled={p.isVideoEnabled}
                  audioLevel={p.audioLevel}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * ParticipantVideo - Individual participant video tile
 */
interface ParticipantVideoProps {
  participant: Participant;
  isLocal?: boolean;
}

const ParticipantVideo = ({ participant, isLocal = false }: ParticipantVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <Card className="relative overflow-hidden bg-black border-0">
      {participant.isVideoEnabled && participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary">
              {participant.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white font-medium">{participant.name}</span>
          <div className="flex items-center gap-2">
            {participant.isMuted && (
              <MicOff className="h-4 w-4 text-red-500" />
            )}
            {!participant.isVideoEnabled && (
              <VideoOff className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
      </div>

      {/* Audio level indicator */}
      {!participant.isMuted && participant.audioLevel && participant.audioLevel > 0.1 && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center animate-pulse">
            <Volume2 className="h-4 w-4 text-green-500" />
          </div>
        </div>
      )}
    </Card>
  );
};

/**
 * ParticipantListItem - Participant in sidebar list
 */
interface ParticipantListItemProps {
  name: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  audioLevel?: number;
}

const ParticipantListItem = ({
  name,
  isMuted,
  isVideoEnabled,
  audioLevel = 0,
}: ParticipantListItemProps) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="font-medium">{name}</span>
      </div>

      <div className="flex items-center gap-2">
        {isMuted ? (
          <MicOff className="h-4 w-4 text-muted-foreground" />
        ) : audioLevel > 0.1 ? (
          <Volume2 className="h-4 w-4 text-green-500" />
        ) : (
          <Mic className="h-4 w-4 text-muted-foreground" />
        )}
        
        {!isVideoEnabled && (
          <VideoOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
};
