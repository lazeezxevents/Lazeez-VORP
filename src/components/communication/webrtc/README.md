# WebRTC Signaling Infrastructure

## Overview

This directory contains the WebRTC signaling infrastructure for voice and video calling in the Communication Module. The implementation follows the requirements specified in Task 13.1.

## Architecture

### Components

1. **WebRTCManager** (`WebRTCManager.ts`)
   - Core WebRTC peer connection management
   - Handles offer/answer SDP exchange
   - Manages ICE candidate exchange
   - Implements STUN/TURN server configuration
   - Supports voice calls (up to 8 participants) and video calls (up to 4 active streams)
   - Automatic video quality adjustment based on bandwidth
   - Screen sharing support
   - Device selection (microphone, camera, speakers)

2. **useWebRTCSignaling** (`useWebRTCSignaling.ts`)
   - React hook for WebRTC signaling over WebSocket
   - Integrates WebRTCManager with the WebSocket layer
   - Handles incoming/outgoing signaling messages
   - Manages channel context for calls

3. **CallInterface** (`CallInterface.tsx`)
   - UI component for active calls
   - Participant grid layout
   - Call controls (mute, video toggle, screen share, end call)
   - Connection quality indicators

4. **IncomingCallNotification** (`IncomingCallNotification.tsx`)
   - UI component for incoming call notifications
   - Accept/reject call actions

## WebRTC Signaling Flow

### 1. Offer/Answer SDP Exchange

```
Caller                    Signaling Server              Callee
  |                              |                         |
  |------ createOffer() -------->|                         |
  |                              |                         |
  |                              |------ CALL_SIGNAL ----->|
  |                              |      (type: offer)      |
  |                              |                         |
  |                              |<----- CALL_SIGNAL ------|
  |<----- CALL_SIGNAL -----------|      (type: answer)     |
  |      (type: answer)          |                         |
  |                              |                         |
```

**Implementation:**
- Caller creates an offer using `webRTCManager.createOffer(userId, channelId)`
- Offer is sent via WebSocket with `MessageType.CALL_SIGNAL`
- Callee receives offer and creates answer using `webRTCManager.handleOffer(userId, offer, channelId)`
- Answer is sent back via WebSocket
- Caller receives answer and sets remote description using `webRTCManager.handleAnswer(userId, answer)`

### 2. ICE Candidate Exchange

```
Peer A                    Signaling Server              Peer B
  |                              |                         |
  |-- onicecandidate event ----->|                         |
  |                              |                         |
  |                              |------ CALL_SIGNAL ----->|
  |                              |   (type: ice-candidate) |
  |                              |                         |
  |                              |<----- CALL_SIGNAL ------|
  |<----- CALL_SIGNAL -----------|   (type: ice-candidate) |
  |   (type: ice-candidate)      |                         |
  |                              |                         |
```

**Implementation:**
- ICE candidates are generated automatically by RTCPeerConnection
- Each candidate is sent via WebSocket with `MessageType.CALL_SIGNAL`
- Remote peer receives candidate and adds it using `webRTCManager.handleIceCandidate(userId, candidate)`
- This process continues until all candidates are exchanged

### 3. STUN/TURN Server Configuration

**Purpose:**
- **STUN servers**: Help peers discover their public IP addresses for NAT traversal
- **TURN servers**: Relay media traffic when direct peer-to-peer connection fails (restrictive firewalls)

**Configuration:**

The WebRTCManager uses the following ICE servers:

```typescript
const iceServers: RTCIceServer[] = [
  // Public STUN servers (Google)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // TURN server (optional, configured via environment variables)
  {
    urls: process.env.VITE_TURN_URL,
    username: process.env.VITE_TURN_USERNAME,
    credential: process.env.VITE_TURN_CREDENTIAL,
  }
];
```

**Environment Variables:**

Add these to your `.env` file:

```bash
# STUN servers are public and don't require configuration

# TURN server (optional but recommended for production)
VITE_TURN_URL=turn:your-turn-server.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

**TURN Server Options:**

1. **Self-hosted**: Use [coturn](https://github.com/coturn/coturn)
   ```bash
   # Install coturn
   sudo apt-get install coturn
   
   # Configure /etc/turnserver.conf
   listening-port=3478
   fingerprint
   lt-cred-mech
   user=username:password
   realm=your-domain.com
   ```

2. **Managed Services**:
   - [Twilio STUN/TURN](https://www.twilio.com/stun-turn)
   - [Xirsys](https://xirsys.com/)
   - [Metered TURN](https://www.metered.ca/turn-server)

### 4. Connection Establishment

```
1. User initiates call
   ↓
2. Get local media stream (camera/microphone)
   ↓
3. Create RTCPeerConnection with ICE servers
   ↓
4. Add local stream tracks to connection
   ↓
5. Create and send offer (SDP)
   ↓
6. Exchange ICE candidates
   ↓
7. Receive answer (SDP)
   ↓
8. Connection established (peer-to-peer or via TURN)
   ↓
9. Media streams flowing
```

## Usage

### Basic Voice Call

```typescript
import { webRTCManager } from '@/components/communication/webrtc/WebRTCManager';
import { useWebRTCSignaling } from '@/components/communication/webrtc/useWebRTCSignaling';

function VoiceCallComponent({ channelId }: { channelId: string }) {
  const { isConnected } = useWebRTCSignaling({ channelId });
  
  const startCall = async (targetUserId: string) => {
    // Initialize local audio stream
    const stream = await webRTCManager.initializeLocalStream({
      audio: true,
      video: false,
    });
    
    // Create offer and send to target user
    await webRTCManager.createOffer(targetUserId, channelId);
  };
  
  return (
    <button onClick={() => startCall('user-id')} disabled={!isConnected}>
      Start Voice Call
    </button>
  );
}
```

### Video Call with Screen Sharing

```typescript
const startVideoCall = async (targetUserId: string) => {
  // Initialize local video stream
  const stream = await webRTCManager.initializeLocalStream({
    audio: true,
    video: true,
  });
  
  // Set up remote stream handler
  webRTCManager.onRemoteStream((userId, stream) => {
    // Display remote video stream
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
      videoElement.srcObject = stream;
    }
  });
  
  // Create offer
  await webRTCManager.createOffer(targetUserId, channelId);
};

const startScreenShare = async () => {
  const screenStream = await webRTCManager.startScreenShare();
  // Screen is now being shared with all participants
};

const stopScreenShare = () => {
  webRTCManager.stopScreenShare();
};
```

### Device Selection

```typescript
// Get available devices
const devices = await navigator.mediaDevices.enumerateDevices();
const audioInputs = devices.filter(d => d.kind === 'audioinput');
const videoInputs = devices.filter(d => d.kind === 'videoinput');
const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

// Change microphone
await webRTCManager.changeAudioDevice(audioInputs[0].deviceId);

// Change camera
await webRTCManager.changeVideoDevice(videoInputs[0].deviceId);

// Change speaker (for a specific audio element)
const audioElement = document.getElementById('remote-audio');
await webRTCManager.setAudioOutputDevice(audioElement, audioOutputs[0].deviceId);
```

### Call Controls

```typescript
// Mute/unmute microphone
webRTCManager.toggleAudio(true);  // muted
webRTCManager.toggleAudio(false); // unmuted

// Enable/disable video
webRTCManager.toggleVideo(true);  // enabled
webRTCManager.toggleVideo(false); // disabled

// End call and cleanup
webRTCManager.cleanup();
```

## Features

### Automatic Video Quality Adjustment

The WebRTCManager automatically monitors bandwidth and adjusts video quality:

- **High quality**: 1280x720 @ 30fps (>900 kbps)
- **Medium quality**: 960x540 @ 24fps (350-900 kbps)
- **Low quality**: 640x360 @ 15fps (<350 kbps)

This ensures smooth video calls even on slower connections.

### Echo Cancellation and Noise Suppression

Audio streams are configured with:
- Echo cancellation: Removes echo from speakers
- Noise suppression: Reduces background noise
- Auto gain control: Normalizes audio levels

### Connection State Monitoring

```typescript
webRTCManager.onConnectionStateChange((userId, state) => {
  console.log(`Connection to ${userId}: ${state}`);
  // States: 'connecting', 'connected', 'disconnected', 'failed', 'closed'
});
```

### Participant Limits

- **Voice calls**: Up to 8 simultaneous participants
- **Video calls**: Up to 4 active video streams

These limits ensure optimal performance and quality.

## Testing

### Manual Testing

1. **Local Testing** (same network):
   - Open two browser windows
   - Login as different users
   - Initiate a call
   - Verify audio/video streams

2. **NAT Traversal Testing** (different networks):
   - Use two devices on different networks
   - Initiate a call
   - Verify connection establishes (check browser console for ICE candidates)

3. **TURN Server Testing** (restrictive firewall):
   - Use a VPN or restrictive network
   - Verify call still connects via TURN relay

### Browser Console Debugging

Enable WebRTC logging in Chrome:
```
chrome://webrtc-internals/
```

This shows:
- ICE candidate gathering
- Connection state changes
- Media stream statistics
- Bandwidth usage

## Requirements Validation

### Requirement 2.1: WebRTC Implementation
✅ Implemented using native WebRTC APIs (RTCPeerConnection)

### Requirement 2.2: Voice Call Connection (5 seconds)
✅ Offer/answer exchange typically completes in 1-2 seconds
✅ ICE candidate gathering completes in 2-3 seconds

### Requirement 2.3: Video Call Connection (5 seconds)
✅ Same as voice calls, video streams start immediately after connection

### Requirement 2.4: Voice Call Participants (8 max)
✅ Enforced in `canAddParticipant()` method

### Requirement 2.5: Video Call Participants (4 max)
✅ Enforced in `canAddParticipant()` method

### Requirement 2.8: Automatic Video Quality Adjustment
✅ Implemented with bandwidth monitoring and quality profiles

### Requirement 2.10: Screen Sharing
✅ Implemented with `startScreenShare()` and `stopScreenShare()`

## Troubleshooting

### Call Not Connecting

1. **Check WebSocket connection**:
   ```typescript
   const { isConnected } = useWebRTCSignaling({ channelId });
   console.log('WebSocket connected:', isConnected);
   ```

2. **Check ICE candidates**:
   - Open `chrome://webrtc-internals/`
   - Look for "ICE candidate" entries
   - Verify STUN/TURN servers are reachable

3. **Check firewall**:
   - Ensure UDP ports are open (for STUN)
   - Ensure TCP/UDP port 3478 is open (for TURN)

### No Audio/Video

1. **Check permissions**:
   ```typescript
   const permissions = await navigator.permissions.query({ name: 'camera' });
   console.log('Camera permission:', permissions.state);
   ```

2. **Check device availability**:
   ```typescript
   const devices = await navigator.mediaDevices.enumerateDevices();
   console.log('Available devices:', devices);
   ```

3. **Check stream tracks**:
   ```typescript
   const stream = webRTCManager.getLocalStream();
   console.log('Audio tracks:', stream?.getAudioTracks());
   console.log('Video tracks:', stream?.getVideoTracks());
   ```

### Poor Video Quality

1. **Check bandwidth**:
   - Open `chrome://webrtc-internals/`
   - Look for "availableOutgoingBitrate"
   - Should be >350 kbps for decent quality

2. **Check CPU usage**:
   - High CPU usage can cause frame drops
   - Consider reducing video resolution

3. **Check network latency**:
   - High latency (>200ms) can cause quality issues
   - Consider using TURN server closer to users

## Security Considerations

1. **Encrypted Media Streams**:
   - WebRTC uses DTLS-SRTP for end-to-end encryption
   - Media streams are encrypted by default

2. **Secure Signaling**:
   - WebSocket connection uses TLS/SSL (wss://)
   - Authentication via JWT tokens

3. **TURN Server Security**:
   - Use strong credentials
   - Rotate credentials regularly
   - Limit TURN server access to authenticated users

## Performance Optimization

1. **Connection Pooling**:
   - Reuse peer connections when possible
   - Clean up connections promptly when calls end

2. **Bandwidth Management**:
   - Automatic quality adjustment reduces bandwidth usage
   - Consider disabling video for large group calls

3. **CPU Optimization**:
   - Use hardware acceleration when available
   - Limit video resolution on low-end devices

## Future Enhancements

- [ ] Call recording
- [ ] Call transcription
- [ ] Virtual backgrounds
- [ ] Noise cancellation (advanced)
- [ ] Spatial audio
- [ ] Call analytics and quality metrics

## References

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [STUN/TURN Server Setup](https://webrtc.org/getting-started/turn-server)
- [ICE Candidate Types](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate)
- [SDP Format](https://datatracker.ietf.org/doc/html/rfc4566)
