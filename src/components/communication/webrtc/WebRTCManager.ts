/**
 * WebRTC Manager
 * Task 13.1: Implement WebRTC signaling infrastructure
 * Task 13.3: Implement call features
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.10, 36.5, 36.10, 36.11, 36.12
 */

interface WebRTCConfig {
  iceServers: RTCIceServer[];
  maxParticipants: {
    voice: number;
    video: number;
  };
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface CallOptions {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

type CallType = 'voice' | 'video';

type VideoQualityProfile = 'low' | 'medium' | 'high';

interface OutgoingCallSignal {
  targetUserId: string;
  channelId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callId?: string;
}

interface IncomingCallSignal {
  fromUserId: string;
  channelId: string;
  signalType: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  callId?: string;
}

/**
 * WebRTC Manager for handling peer-to-peer connections
 */
export class WebRTCManager {
  private config: WebRTCConfig;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private onRemoteStreamCallback?: (userId: string, stream: MediaStream) => void;
  private onRemoteStreamRemovedCallback?: (userId: string) => void;
  private onConnectionStateChangeCallback?: (userId: string, state: RTCPeerConnectionState) => void;
  private signalSender?: (payload: OutgoingCallSignal) => void;
  private activeChannelId: string | null = null;
  private callType: CallType = 'voice';
  private bandwidthMonitorTimer?: number;
  private lastBytesSent?: number;
  private lastBytesTimestamp?: number;
  private currentVideoProfile: VideoQualityProfile = 'high';

  constructor(config?: Partial<WebRTCConfig>) {
    const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    this.config = {
      iceServers: config?.iceServers || iceServers,
      maxParticipants: config?.maxParticipants || {
        voice: 8,
        video: 4,
      },
    };
  }

  /**
   * Initialize local media stream
   */
  async initializeLocalStream(options: CallOptions): Promise<MediaStream> {
    try {
      this.callType = options.video ? 'video' : 'voice';
      const constraints: MediaStreamConstraints = {
        audio: options.audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              deviceId: options.audioDeviceId ? { exact: options.audioDeviceId } : undefined,
            }
          : false,
        video: options.video
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              deviceId: options.videoDeviceId ? { exact: options.videoDeviceId } : undefined,
            }
          : false,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.callType === 'video') {
        this.applyVideoQualityProfile(this.currentVideoProfile);
      }
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local stream:', error);
      throw new Error('Failed to access camera/microphone. Please check permissions.');
    }
  }

  /**
   * Create peer connection for a remote user
   */
  async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    if (!this.canAddParticipant(this.callType)) {
      throw new Error(`Maximum ${this.callType} participants reached`);
    }

    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        connection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    connection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      const [remoteStream] = event.streams;
      this.onRemoteStreamCallback?.(userId, remoteStream);
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate:', event.candidate);
        // Send ICE candidate via signaling server
        this.sendSignal(userId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', connection.connectionState);
      this.onConnectionStateChangeCallback?.(userId, connection.connectionState);

      if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
        this.removePeerConnection(userId);
      }
    };

    // Handle ICE connection state
    connection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', connection.iceConnectionState);
    };

    this.peerConnections.set(userId, { id: userId, connection });

    if (this.callType === 'video') {
      this.startBandwidthMonitoring(connection);
    }

    return connection;
  }

  /**
   * Create and send offer to remote peer
   */
  async createOffer(userId: string, channelId?: string): Promise<RTCSessionDescriptionInit> {
    const connection = await this.createPeerConnection(userId);

    const offer = await connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await connection.setLocalDescription(offer);

    // Send offer via signaling server
    this.sendSignal(userId, {
      type: 'offer',
      sdp: offer,
    }, channelId);

    return offer;
  }

  /**
   * Handle incoming offer from remote peer
   */
  async handleOffer(userId: string, offer: RTCSessionDescriptionInit, channelId?: string): Promise<void> {
    const connection = await this.createPeerConnection(userId);

    await connection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    // Send answer via signaling server
    this.sendSignal(userId, {
      type: 'answer',
      sdp: answer,
    }, channelId);
  }

  /**
   * Handle incoming answer from remote peer
   */
  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peerConnections.get(userId);
    if (!peer) {
      console.error('[WebRTC] No peer connection found for user:', userId);
      return;
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peerConnections.get(userId);
    if (!peer) {
      console.error('[WebRTC] No peer connection found for user:', userId);
      return;
    }

    await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Handle incoming signaling payload
   */
  async handleSignalPayload(payload: IncomingCallSignal): Promise<void> {
    if (!payload || !payload.fromUserId) {
      console.warn('[WebRTC] Missing sender information in signal payload');
      return;
    }

    try {
      switch (payload.signalType) {
        case 'offer':
          if (payload.sdp) {
            await this.handleOffer(payload.fromUserId, payload.sdp, payload.channelId);
          }
          break;
        case 'answer':
          if (payload.sdp) {
            await this.handleAnswer(payload.fromUserId, payload.sdp);
          }
          break;
        case 'ice-candidate':
          if (payload.candidate) {
            await this.handleIceCandidate(payload.fromUserId, payload.candidate);
          }
          break;
        default:
          console.warn('[WebRTC] Unknown signal type:', payload.signalType);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle signal payload:', error);
    }
  }

  /**
   * Toggle audio mute
   */
  toggleAudio(muted: boolean): void {
    if (!this.localStream) return;

    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  /**
   * Toggle video
   */
  toggleVideo(enabled: boolean): void {
    if (!this.localStream) return;

    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  /**
   * Set call type for participant limits and track behavior
   */
  setCallType(type: CallType): void {
    this.callType = type;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = type === 'video';
      });
    }

    if (type !== 'video') {
      this.stopBandwidthMonitoring();
    }
  }

  /**
   * Check if another participant can join the call
   */
  canAddParticipant(type: CallType): boolean {
    const limit = type === 'video' ? this.config.maxParticipants.video : this.config.maxParticipants.voice;
    return this.peerConnections.size < limit;
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: false,
      });

      // Replace video track in all peer connections
      const videoTrack = this.screenStream.getVideoTracks()[0];
      this.peerConnections.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Handle screen share stop
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      return this.screenStream;
    } catch (error) {
      console.error('[WebRTC] Failed to start screen share:', error);
      throw new Error('Failed to start screen sharing');
    }
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare(): void {
    if (!this.screenStream) return;

    this.screenStream.getTracks().forEach((track) => track.stop());
    this.screenStream = null;

    // Restore camera video track
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      this.peerConnections.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
    }
  }

  /**
   * Change audio input device
   */
  async changeAudioDevice(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const newAudioTrack = newStream.getAudioTracks()[0];
      const oldAudioTrack = this.localStream.getAudioTracks()[0];

      // Replace audio track in all peer connections
      this.peerConnections.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === 'audio');
        
        if (sender) {
          sender.replaceTrack(newAudioTrack);
        }
      });

      // Stop old track and update local stream
      oldAudioTrack.stop();
      this.localStream.removeTrack(oldAudioTrack);
      this.localStream.addTrack(newAudioTrack);
    } catch (error) {
      console.error('[WebRTC] Failed to change audio device:', error);
      throw new Error('Failed to change microphone');
    }
  }

  /**
   * Change video input device
   */
  async changeVideoDevice(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.localStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      this.peerConnections.forEach((peer) => {
        const sender = peer.connection
          .getSenders()
          .find((s) => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      // Stop old track and update local stream
      oldVideoTrack.stop();
      this.localStream.removeTrack(oldVideoTrack);
      this.localStream.addTrack(newVideoTrack);
    } catch (error) {
      console.error('[WebRTC] Failed to change video device:', error);
      throw new Error('Failed to change camera');
    }
  }

  /**
   * Change audio output device for a media element
   */
  async setAudioOutputDevice(element: HTMLMediaElement, deviceId: string): Promise<void> {
    const mediaElement = element as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
    if (!mediaElement.setSinkId) {
      console.warn('[WebRTC] Audio output selection not supported by this browser');
      return;
    }

    await mediaElement.setSinkId(deviceId);
  }

  /**
   * Get audio level for local stream
   */
  getAudioLevel(): number {
    if (!this.localStream) return 0;

    // This is a simplified version. In production, use Web Audio API for accurate levels
    const audioTrack = this.localStream.getAudioTracks()[0];
    return audioTrack && audioTrack.enabled ? 0.5 : 0;
  }

  /**
   * Start monitoring bandwidth to adjust video quality
   */
  private startBandwidthMonitoring(connection: RTCPeerConnection): void {
    if (this.bandwidthMonitorTimer) {
      return;
    }

    this.bandwidthMonitorTimer = window.setInterval(async () => {
      try {
        const stats = await connection.getStats();
        let availableBitrate: number | undefined;
        let outboundBytes: number | undefined;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.selected) {
            const bitrate = report.availableOutgoingBitrate as number | undefined;
            if (bitrate) {
              availableBitrate = bitrate;
            }
          }

          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            outboundBytes = report.bytesSent as number | undefined;
          }
        });

        const now = Date.now();
        if (this.lastBytesSent !== undefined && outboundBytes !== undefined && this.lastBytesTimestamp) {
          const deltaBytes = outboundBytes - this.lastBytesSent;
          const deltaTime = (now - this.lastBytesTimestamp) / 1000;
          const bitrate = deltaTime > 0 ? (deltaBytes * 8) / deltaTime : undefined;
          if (!availableBitrate && bitrate) {
            availableBitrate = bitrate;
          }
        }

        if (outboundBytes !== undefined) {
          this.lastBytesSent = outboundBytes;
          this.lastBytesTimestamp = now;
        }

        if (availableBitrate) {
          this.adjustVideoQuality(availableBitrate);
        }
      } catch (error) {
        console.warn('[WebRTC] Failed to read stats for bandwidth monitoring:', error);
      }
    }, 3000);
  }

  /**
   * Stop bandwidth monitoring
   */
  private stopBandwidthMonitoring(): void {
    if (this.bandwidthMonitorTimer) {
      window.clearInterval(this.bandwidthMonitorTimer);
      this.bandwidthMonitorTimer = undefined;
    }
  }

  /**
   * Adjust video quality based on available bitrate
   */
  private adjustVideoQuality(availableBitrate: number): void {
    const nextProfile: VideoQualityProfile = availableBitrate < 350_000
      ? 'low'
      : availableBitrate < 900_000
        ? 'medium'
        : 'high';

    if (nextProfile !== this.currentVideoProfile) {
      this.currentVideoProfile = nextProfile;
      this.applyVideoQualityProfile(nextProfile);
    }
  }

  /**
   * Apply a video quality profile to the local track
   */
  private applyVideoQualityProfile(profile: VideoQualityProfile): void {
    if (!this.localStream) return;

    const [videoTrack] = this.localStream.getVideoTracks();
    if (!videoTrack) return;

    const constraints: MediaTrackConstraints =
      profile === 'low'
        ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 20 } }
        : profile === 'medium'
          ? { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 30 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };

    videoTrack.applyConstraints(constraints).catch((error) => {
      console.warn('[WebRTC] Failed to apply video constraints:', error);
    });
  }

  /**
   * Remove peer connection
   */
  removePeerConnection(userId: string): void {
    const peer = this.peerConnections.get(userId);
    if (peer) {
      peer.connection.close();
      this.peerConnections.delete(userId);
      this.onRemoteStreamRemovedCallback?.(userId);
    }
  }

  /**
   * Clean up all connections and streams
   */
  cleanup(): void {
    // Close all peer connections
    this.peerConnections.forEach((peer) => {
      peer.connection.close();
    });
    this.peerConnections.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Stop screen share
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    this.stopBandwidthMonitoring();
  }

  /**
   * Set callback for remote stream
   */
  onRemoteStream(callback: (userId: string, stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  /**
   * Set callback for remote stream removed
   */
  onRemoteStreamRemoved(callback: (userId: string) => void): void {
    this.onRemoteStreamRemovedCallback = callback;
  }

  /**
   * Set callback for connection state change
   */
  onConnectionStateChange(callback: (userId: string, state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  /**
   * Set signaling sender for WebSocket integration
   */
  setSignalSender(sender: (payload: OutgoingCallSignal) => void): void {
    this.signalSender = sender;
  }

  /**
   * Set active channel context for signaling
   */
  setChannelId(channelId: string | null): void {
    this.activeChannelId = channelId;
  }

  /**
   * Send signaling message (to be implemented with WebSocket)
   */
  private sendSignal(
    userId: string,
    signal: { type: 'offer' | 'answer' | 'ice-candidate'; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit },
    channelId?: string
  ): void {
    const targetChannelId = channelId || this.activeChannelId;

    if (!this.signalSender || !targetChannelId) {
      console.warn('[WebRTC] Signaling sender or channel not set');
      return;
    }

    this.signalSender({
      targetUserId: userId,
      channelId: targetChannelId,
      signalType: signal.type,
      sdp: signal.sdp,
      candidate: signal.candidate,
    });
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get peer connections
   */
  getPeerConnections(): Map<string, PeerConnection> {
    return this.peerConnections;
  }
}

// Singleton instance
export const webRTCManager = new WebRTCManager();
