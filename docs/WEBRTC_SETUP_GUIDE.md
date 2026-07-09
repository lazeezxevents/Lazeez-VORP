# WebRTC Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the WebRTC signaling infrastructure for voice and video calling in the Lazeez VORP Communication Module.

## Prerequisites

- Node.js 18+ installed
- Supabase project configured
- WebSocket server running (see WebSocket Setup section)
- Domain with SSL certificate (for production)

## 1. Environment Configuration

### Development Environment

Add the following to your `.env` file:

```bash
# WebSocket Server URL
VITE_WS_URL=ws://localhost:8080

# STUN Servers (public, no configuration needed)
# Google STUN servers are used by default

# TURN Server (optional for development, required for production)
# Leave empty for development if testing on same network
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

### Production Environment

```bash
# WebSocket Server URL (must use wss:// for secure connection)
VITE_WS_URL=wss://ws.your-domain.com

# TURN Server (required for production)
VITE_TURN_URL=turn:turn.your-domain.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

## 2. STUN Server Configuration

### What is STUN?

STUN (Session Traversal Utilities for NAT) helps peers discover their public IP addresses and port mappings created by NAT devices.

### Default Configuration

The WebRTC implementation uses Google's public STUN servers by default:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

**No additional configuration is required for STUN servers.**

### When STUN is Sufficient

STUN servers work well when:
- Both peers are on networks with symmetric NAT
- Firewalls allow UDP traffic
- Testing on local networks or same ISP

### When TURN is Required

TURN servers are needed when:
- One or both peers are behind restrictive firewalls
- Corporate networks block UDP traffic
- Symmetric NAT prevents direct connections
- Production deployments (recommended)

## 3. TURN Server Setup

### Option 1: Self-Hosted TURN Server (coturn)

#### Installation (Ubuntu/Debian)

```bash
# Update package list
sudo apt-get update

# Install coturn
sudo apt-get install coturn

# Enable coturn service
sudo systemctl enable coturn
```

#### Configuration

Edit `/etc/turnserver.conf`:

```conf
# Listening port for TURN server
listening-port=3478

# TLS listening port (optional but recommended)
tls-listening-port=5349

# External IP address (your server's public IP)
external-ip=YOUR_PUBLIC_IP

# Relay IP address (usually same as external IP)
relay-ip=YOUR_PUBLIC_IP

# Realm (your domain)
realm=turn.your-domain.com

# Server name
server-name=turn.your-domain.com

# Use fingerprint
fingerprint

# Use long-term credential mechanism
lt-cred-mech

# User credentials (username:password)
user=username:password

# Minimum and maximum port range for relay endpoints
min-port=49152
max-port=65535

# Verbose logging (disable in production)
verbose

# Log file
log-file=/var/log/turnserver.log

# Enable STUN
stun-only=0

# Disable UDP relay (optional, use only TCP)
# no-udp-relay

# Disable TCP relay (optional, use only UDP)
# no-tcp-relay

# SSL/TLS certificate (for secure connections)
# cert=/etc/letsencrypt/live/turn.your-domain.com/fullchain.pem
# pkey=/etc/letsencrypt/live/turn.your-domain.com/privkey.pem
```

#### Generate Strong Credentials

```bash
# Generate random username
USERNAME=$(openssl rand -hex 8)

# Generate random password
PASSWORD=$(openssl rand -hex 16)

# Add to turnserver.conf
echo "user=$USERNAME:$PASSWORD" | sudo tee -a /etc/turnserver.conf

# Update .env file
echo "VITE_TURN_USERNAME=$USERNAME" >> .env
echo "VITE_TURN_CREDENTIAL=$PASSWORD" >> .env
```

#### Start TURN Server

```bash
# Start coturn service
sudo systemctl start coturn

# Check status
sudo systemctl status coturn

# View logs
sudo tail -f /var/log/turnserver.log
```

#### Firewall Configuration

```bash
# Allow TURN server ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp

# Allow relay port range
sudo ufw allow 49152:65535/tcp
sudo ufw allow 49152:65535/udp
```

#### SSL/TLS Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d turn.your-domain.com

# Update turnserver.conf with certificate paths
sudo nano /etc/turnserver.conf
# Uncomment and update:
# cert=/etc/letsencrypt/live/turn.your-domain.com/fullchain.pem
# pkey=/etc/letsencrypt/live/turn.your-domain.com/privkey.pem

# Restart coturn
sudo systemctl restart coturn
```

### Option 2: Managed TURN Services

#### Twilio STUN/TURN

1. Sign up at [Twilio](https://www.twilio.com/stun-turn)
2. Get API credentials
3. Use Twilio's API to generate temporary TURN credentials:

```typescript
// Server-side code to generate TURN credentials
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function getTurnCredentials() {
  const token = await client.tokens.create();
  return {
    iceServers: token.iceServers,
  };
}
```

#### Xirsys

1. Sign up at [Xirsys](https://xirsys.com/)
2. Create a channel
3. Get API credentials
4. Use Xirsys API to get TURN credentials:

```typescript
// Server-side code
const response = await fetch('https://global.xirsys.net/_turn/YOUR_CHANNEL', {
  method: 'PUT',
  headers: {
    'Authorization': 'Basic ' + btoa('username:secret'),
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
const iceServers = data.v.iceServers;
```

#### Metered TURN

1. Sign up at [Metered](https://www.metered.ca/turn-server)
2. Get API key
3. Use provided TURN server URLs:

```bash
VITE_TURN_URL=turn:a.relay.metered.ca:80
VITE_TURN_USERNAME=your-api-key
VITE_TURN_CREDENTIAL=your-api-key
```

## 4. Testing TURN Server

### Test TURN Connectivity

Use the [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) test page:

1. Open https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. Add your TURN server:
   ```
   turn:turn.your-domain.com:3478
   ```
3. Enter username and credential
4. Click "Gather candidates"
5. Look for "relay" type candidates (indicates TURN is working)

### Test from Command Line

```bash
# Install turnutils
sudo apt-get install turnutils-client

# Test TURN server
turnutils_uclient -v -u username -w password turn.your-domain.com
```

Expected output:
```
0: Total connect time is 0
0: start_mclient: msz=2, tot_send_msgs=0, tot_recv_msgs=0, tot_send_bytes ~ 0, tot_recv_bytes ~ 0
1: start_mclient: msz=2, tot_send_msgs=3, tot_recv_msgs=3, tot_send_bytes ~ 300, tot_recv_bytes ~ 300
```

## 5. WebSocket Server Setup

The WebRTC signaling requires a WebSocket server to exchange SDP offers/answers and ICE candidates.

### Create WebSocket Server

Create `websocket-server/index.js`:

```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const wss = new WebSocket.Server({ port: PORT });

// Store connected clients
const clients = new Map();

wss.on('connection', (ws) => {
  let userId = null;
  let isAuthenticated = false;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      // Handle authentication
      if (message.type === 'auth') {
        try {
          const decoded = jwt.verify(message.payload.token, JWT_SECRET);
          userId = decoded.sub;
          isAuthenticated = true;
          clients.set(userId, ws);

          ws.send(JSON.stringify({
            type: 'auth_success',
            payload: { userId },
          }));

          console.log(`User ${userId} authenticated`);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'auth_error',
            payload: { error: 'Invalid token' },
          }));
          ws.close();
        }
        return;
      }

      // Require authentication for other messages
      if (!isAuthenticated) {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { error: 'Not authenticated' },
        }));
        return;
      }

      // Handle call signaling
      if (message.type === 'call_signal') {
        const { target_user_id, ...signalData } = message.payload;
        const targetWs = clients.get(target_user_id);

        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({
            type: 'call_signal',
            payload: {
              ...signalData,
              from_user_id: userId,
            },
          }));
        }
      }

      // Handle ping
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`WebSocket server running on port ${PORT}`);
```

### Install Dependencies

```bash
cd websocket-server
npm init -y
npm install ws jsonwebtoken
```

### Run WebSocket Server

```bash
# Development
JWT_SECRET=your-secret-key node index.js

# Production (with PM2)
pm2 start index.js --name websocket-server
```

### Nginx Configuration (Production)

```nginx
upstream websocket {
    server localhost:8080;
}

server {
    listen 443 ssl;
    server_name ws.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/ws.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ws.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout
        proxy_read_timeout 86400;
    }
}
```

## 6. Verification

### Test WebRTC Connection

1. **Open two browser windows**
2. **Login as different users**
3. **Open browser console** (F12)
4. **Initiate a call**
5. **Check console logs**:
   ```
   WebSocket connected
   WebSocket authenticated successfully
   [WebRTC] New ICE candidate: {type: "host", ...}
   [WebRTC] New ICE candidate: {type: "srflx", ...}  // STUN
   [WebRTC] New ICE candidate: {type: "relay", ...}  // TURN
   [WebRTC] Connection state: connected
   ```

### Verify ICE Candidates

Open `chrome://webrtc-internals/` and look for:
- **host**: Local network candidates
- **srflx**: Server reflexive (STUN) candidates
- **relay**: Relayed (TURN) candidates

If you see "relay" candidates, TURN is working correctly.

## 7. Troubleshooting

### WebSocket Connection Failed

```bash
# Check if WebSocket server is running
netstat -tuln | grep 8080

# Check WebSocket server logs
pm2 logs websocket-server

# Test WebSocket connection
wscat -c ws://localhost:8080
```

### TURN Server Not Working

```bash
# Check coturn status
sudo systemctl status coturn

# Check coturn logs
sudo tail -f /var/log/turnserver.log

# Test TURN connectivity
turnutils_uclient -v -u username -w password turn.your-domain.com

# Check firewall rules
sudo ufw status
```

### No ICE Candidates

1. **Check STUN/TURN configuration** in `.env`
2. **Verify network connectivity** to STUN/TURN servers
3. **Check browser console** for errors
4. **Test with public STUN servers** first

### Call Not Connecting

1. **Verify WebSocket is connected**:
   ```typescript
   const { isConnected } = useWebRTCSignaling({ channelId });
   console.log('WebSocket connected:', isConnected);
   ```

2. **Check ICE gathering state**:
   ```typescript
   webRTCManager.onConnectionStateChange((userId, state) => {
     console.log(`Connection to ${userId}: ${state}`);
   });
   ```

3. **Verify both peers are online** and in the same channel

## 8. Production Checklist

- [ ] WebSocket server running with SSL (wss://)
- [ ] TURN server configured with strong credentials
- [ ] Firewall rules configured for TURN ports
- [ ] SSL certificates installed and valid
- [ ] Environment variables set correctly
- [ ] WebSocket server monitored (PM2, systemd)
- [ ] TURN server monitored (systemd)
- [ ] Backup TURN server configured (optional)
- [ ] Load balancer configured for WebSocket (optional)
- [ ] Logging and monitoring set up
- [ ] Rate limiting configured
- [ ] TURN credential rotation scheduled

## 9. Security Best Practices

1. **Use TLS/SSL for all connections**
   - WebSocket: wss://
   - TURN: turns:// (port 5349)

2. **Rotate TURN credentials regularly**
   - Generate new credentials monthly
   - Use time-limited credentials (Twilio, Xirsys)

3. **Limit TURN server access**
   - Whitelist IP addresses if possible
   - Use strong, random credentials
   - Monitor TURN server usage

4. **Implement rate limiting**
   - Limit call initiation rate per user
   - Limit ICE candidate exchange rate

5. **Monitor and log**
   - Log all call attempts
   - Monitor TURN server bandwidth usage
   - Alert on suspicious activity

## 10. Cost Optimization

### Self-Hosted TURN

**Pros:**
- One-time setup cost
- No per-minute charges
- Full control

**Cons:**
- Requires server maintenance
- Bandwidth costs
- Scaling complexity

**Estimated Cost:**
- VPS: $10-50/month (depending on bandwidth)
- Bandwidth: $0.01-0.10/GB

### Managed TURN Services

**Pros:**
- No maintenance
- Easy scaling
- Global infrastructure

**Cons:**
- Per-minute or per-GB charges
- Vendor lock-in

**Estimated Cost:**
- Twilio: $0.0004/minute
- Xirsys: $0.0005/minute
- Metered: $0.50/GB

### Recommendation

- **Development**: Use public STUN servers (free)
- **Small deployments**: Self-hosted TURN ($10-20/month)
- **Large deployments**: Managed TURN service (pay-as-you-go)

## 11. Monitoring and Analytics

### Key Metrics to Monitor

1. **Connection Success Rate**
   - Track successful vs failed connections
   - Monitor ICE gathering failures

2. **Call Quality**
   - Audio/video bitrate
   - Packet loss
   - Latency

3. **TURN Usage**
   - Percentage of calls using TURN
   - TURN bandwidth usage
   - TURN server load

4. **WebSocket Health**
   - Connection count
   - Reconnection rate
   - Message latency

### Logging Example

```typescript
// Log call metrics
webRTCManager.onConnectionStateChange((userId, state) => {
  if (state === 'connected') {
    // Log successful connection
    analytics.track('call_connected', {
      userId,
      channelId,
      connectionTime: Date.now() - callStartTime,
    });
  } else if (state === 'failed') {
    // Log failed connection
    analytics.track('call_failed', {
      userId,
      channelId,
      reason: 'connection_failed',
    });
  }
});
```

## 12. References

- [WebRTC Documentation](https://webrtc.org/)
- [coturn Documentation](https://github.com/coturn/coturn/wiki)
- [STUN/TURN Protocols](https://datatracker.ietf.org/doc/html/rfc5389)
- [ICE Protocol](https://datatracker.ietf.org/doc/html/rfc8445)
- [WebRTC Security](https://webrtc-security.github.io/)
