import { WebSocketServer } from 'ws';
import { config, validateConfig } from './config.js';
import { initializeSupabase } from './auth.js';
import { initializeRedis, subscribeToChannel, closeRedis } from './redis.js';
import { ConnectionManager } from './connectionManager.js';
import { MessageHandler } from './messageHandler.js';
import { ExtendedWebSocket, MessageType, RedisPubSubMessage } from './types.js';

/**
 * WebSocket Server for VORP Communication Module
 * 
 * Requirements:
 * - 19.1: Implement WebSocket connections using the WebSocket protocol
 * - 19.3: Authenticate user using existing VORP session tokens
 * - 19.4: Attempt reconnection with exponential backoff (1s, 2s, 4s, 8s, 16s max)
 * - 19.5: Maintain connection heartbeat with 30-second ping intervals
 * - 19.6: Close connection and attempt reconnection when heartbeat fails
 * - 19.7: Support at least 1000 concurrent WebSocket connections per server instance
 */

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('Configuration error:', error);
  process.exit(1);
}

// Initialize services
initializeSupabase();
initializeRedis();

// Create connection manager and message handler
const connectionManager = new ConnectionManager();
const messageHandler = new MessageHandler(connectionManager);

// Create WebSocket server
// Requirements: 19.1 - Implement WebSocket connections using the WebSocket protocol
const wss = new WebSocketServer({
  port: config.server.port,
  host: config.server.host,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

// Handle new connections
wss.on('connection', (ws: ExtendedWebSocket) => {
  console.log('New WebSocket connection established');
  
  // Handle incoming messages
  ws.on('message', async (data: Buffer) => {
    try {
      await messageHandler.handleMessage(ws, data.toString());
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Handle connection close
  ws.on('close', () => {
    connectionManager.removeConnection(ws);
  });
  
  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectionManager.removeConnection(ws);
  });
});

// Subscribe to Redis channels for cross-server communication
// Requirements: 19.2 - Use Redis Pub/Sub for message distribution across multiple server instances
subscribeToChannel('communication:messages', (message: RedisPubSubMessage) => {
  if (message.targetChannelId) {
    connectionManager.sendToChannel(
      message.targetChannelId,
      {
        type: message.type,
        payload: message.payload,
        timestamp: Date.now(),
      },
      message.excludeUserId
    );
  }
});

subscribeToChannel('communication:typing', (message: RedisPubSubMessage) => {
  if (message.targetChannelId) {
    connectionManager.sendToChannel(
      message.targetChannelId,
      {
        type: message.type,
        payload: message.payload,
        timestamp: Date.now(),
      },
      message.excludeUserId
    );
  }
});

subscribeToChannel('communication:presence', (message: RedisPubSubMessage) => {
  connectionManager.broadcast({
    type: message.type,
    payload: message.payload,
    timestamp: Date.now(),
  });
});

subscribeToChannel('communication:calls', (message: RedisPubSubMessage) => {
  if (message.targetUserId) {
    connectionManager.sendToUser(message.targetUserId, {
      type: message.type,
      payload: message.payload,
      timestamp: Date.now(),
    });
  }
});

// Server status logging
wss.on('listening', () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  VORP WebSocket Server                                         ║
║  Status: Running                                               ║
║  Host: ${config.server.host.padEnd(52)}║
║  Port: ${config.server.port.toString().padEnd(52)}║
║  Heartbeat Interval: ${(config.heartbeat.interval / 1000).toString()}s${' '.repeat(40)}║
║  Environment: ${config.env.padEnd(47)}║
╚════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Close all WebSocket connections
  connectionManager.closeAll();
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Close Redis connections
  await closeRedis();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  // Close all WebSocket connections
  connectionManager.closeAll();
  
  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });
  
  // Close Redis connections
  await closeRedis();
  
  process.exit(0);
});

// Log connection statistics every 60 seconds
setInterval(() => {
  const userCount = connectionManager.getConnectedUserCount();
  const connectionCount = connectionManager.getTotalConnectionCount();
  console.log(`[Stats] Connected users: ${userCount}, Total connections: ${connectionCount}`);
}, 60000);

export { wss, connectionManager, messageHandler };
