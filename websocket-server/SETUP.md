# WebSocket Server Setup Guide

This guide walks you through setting up the VORP WebSocket server for local development and production deployment.

## Prerequisites

- Node.js 18+ installed
- Redis server running
- Supabase project configured
- Access to Supabase service role key

## Quick Start

### 1. Install Dependencies

```bash
cd websocket-server
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Redis Configuration (local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WebSocket Server Configuration
WS_PORT=8080
WS_HOST=0.0.0.0

# Heartbeat Configuration
HEARTBEAT_INTERVAL=30000
HEARTBEAT_TIMEOUT=35000

# Environment
NODE_ENV=development
```

### 3. Start Redis

**macOS (Homebrew)**:
```bash
brew services start redis
```

**Linux (systemd)**:
```bash
sudo systemctl start redis
```

**Docker**:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

**Windows**:
Download and install from [Redis Windows](https://github.com/microsoftarchive/redis/releases)

### 4. Verify Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 5. Start Development Server

```bash
npm run dev
```

You should see:

```
╔════════════════════════════════════════════════════════════════╗
║  VORP WebSocket Server                                         ║
║  Status: Running                                               ║
║  Host: 0.0.0.0                                                 ║
║  Port: 8080                                                    ║
║  Heartbeat Interval: 30s                                       ║
║  Environment: development                                      ║
╚════════════════════════════════════════════════════════════════╝
```

## Frontend Configuration

Update your frontend `.env` file to include the WebSocket URL:

```env
# Add to your main project .env file
VITE_WS_URL=ws://localhost:8080
```

## Testing the Connection

### Using Browser Console

Open your React app and check the browser console:

```javascript
// The WebSocket should connect automatically when authenticated
// Look for logs like:
// "WebSocket connected"
// "WebSocket authenticated successfully"
```

### Using wscat (CLI tool)

Install wscat:
```bash
npm install -g wscat
```

Connect and test:
```bash
wscat -c ws://localhost:8080

# Send authentication message (replace with real JWT token):
{"type":"auth","payload":{"token":"your_jwt_token_here"}}

# You should receive:
{"type":"auth_success","payload":{"userId":"...","channels":[...]},"timestamp":...}
```

## Production Deployment

### 1. Build the Server

```bash
npm run build
```

This creates optimized JavaScript in the `dist/` directory.

### 2. Production Environment Variables

Create a production `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Production Redis (e.g., Redis Cloud, AWS ElastiCache)
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

WS_PORT=8080
WS_HOST=0.0.0.0

HEARTBEAT_INTERVAL=30000
HEARTBEAT_TIMEOUT=35000

NODE_ENV=production
```

### 3. Start Production Server

```bash
npm start
```

### 4. Process Manager (PM2)

For production, use PM2 to manage the process:

```bash
# Install PM2 globally
npm install -g pm2

# Start server with PM2
pm2 start dist/index.js --name vorp-websocket

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### 5. Reverse Proxy (Nginx)

Configure Nginx to proxy WebSocket connections with SSL:

```nginx
upstream websocket {
    server localhost:8080;
}

server {
    listen 443 ssl http2;
    server_name ws.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

Update frontend `.env` for production:
```env
VITE_WS_URL=wss://ws.yourdomain.com
```

## Horizontal Scaling

To scale across multiple server instances:

### 1. Deploy Multiple Instances

Deploy the WebSocket server on multiple machines/containers, all connecting to the same Redis instance.

```bash
# Server 1
WS_PORT=8080 npm start

# Server 2
WS_PORT=8081 npm start

# Server 3
WS_PORT=8082 npm start
```

### 2. Load Balancer Configuration

Configure a load balancer (e.g., HAProxy, AWS ALB) with sticky sessions:

**HAProxy Example**:
```
frontend websocket_frontend
    bind *:443 ssl crt /path/to/cert.pem
    default_backend websocket_backend

backend websocket_backend
    balance leastconn
    option httpchk GET /health
    stick-table type ip size 1m expire 30m
    stick on src
    server ws1 10.0.1.10:8080 check
    server ws2 10.0.1.11:8080 check
    server ws3 10.0.1.12:8080 check
```

### 3. Redis Configuration

Use a managed Redis service for production:
- **AWS ElastiCache**
- **Redis Cloud**
- **Azure Cache for Redis**
- **Google Cloud Memorystore**

## Monitoring

### Health Check Endpoint

Add a health check endpoint (future task):

```typescript
// In index.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connections: connectionManager.getTotalConnectionCount(),
    users: connectionManager.getConnectedUserCount(),
    uptime: process.uptime(),
  });
});
```

### Logging

The server logs important events:
- Connection/disconnection events
- Authentication failures
- Redis connection status
- Connection statistics (every 60 seconds)

For production, consider using a logging service:
- **Winston** for structured logging
- **Datadog** for monitoring
- **Sentry** for error tracking

### Metrics to Monitor

- **Active Connections**: Total WebSocket connections
- **Connected Users**: Unique users connected
- **Message Throughput**: Messages per second
- **Latency**: Message delivery time
- **Error Rate**: Failed authentications, disconnections
- **Memory Usage**: Server memory consumption
- **CPU Usage**: Server CPU utilization

## Troubleshooting

### Connection Issues

**Problem**: Client can't connect to WebSocket server

**Solutions**:
1. Verify server is running: `curl http://localhost:8080`
2. Check firewall rules allow port 8080
3. Verify WebSocket URL in frontend `.env`
4. Check browser console for connection errors

### Authentication Failures

**Problem**: "Invalid or expired token" error

**Solutions**:
1. Verify Supabase URL and service role key in `.env`
2. Check JWT token is valid: decode at [jwt.io](https://jwt.io)
3. Ensure user exists in Supabase auth
4. Verify token hasn't expired

### Redis Connection Errors

**Problem**: "Redis connection failed"

**Solutions**:
1. Verify Redis is running: `redis-cli ping`
2. Check Redis host/port in `.env`
3. Verify Redis password if configured
4. Check network connectivity to Redis server

### High Memory Usage

**Problem**: Server memory usage growing over time

**Solutions**:
1. Monitor connection count
2. Check for memory leaks in message handlers
3. Implement connection limits
4. Consider horizontal scaling

### Heartbeat Failures

**Problem**: Connections dropping frequently

**Solutions**:
1. Check network stability
2. Verify heartbeat interval settings
3. Review client-side reconnection logic
4. Check for proxy/firewall timeout settings

## Development Tips

### Hot Reload

The development server uses `tsx watch` for automatic reloading on file changes.

### Debugging

Add debug logging:

```typescript
// In any file
console.log('[DEBUG]', 'Your debug message', data);
```

Use VS Code debugger:

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug WebSocket Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Security Checklist

- [ ] Use HTTPS/WSS in production
- [ ] Rotate Supabase service role key regularly
- [ ] Use strong Redis password
- [ ] Implement rate limiting (future task)
- [ ] Enable CORS restrictions
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Implement proper error handling
- [ ] Add request validation

## Next Steps

After completing this setup:

1. **Test the connection** from your React frontend
2. **Implement message handlers** for your use cases
3. **Add rate limiting** for security
4. **Set up monitoring** and alerting
5. **Configure production deployment**
6. **Implement additional features** (file uploads, calls, etc.)

## Support

For issues or questions:
- Check the [README.md](./README.md) for API documentation
- Review the [design document](.kiro/specs/communication-module/design.md)
- Check server logs for error messages
- Verify all requirements are met

## References

- [WebSocket Protocol (RFC 6455)](https://tools.ietf.org/html/rfc6455)
- [Supabase Documentation](https://supabase.com/docs)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js ws Library](https://github.com/websockets/ws)
