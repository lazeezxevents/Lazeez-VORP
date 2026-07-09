import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Server configuration
 */
export const config = {
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  // WebSocket Server
  server: {
    port: parseInt(process.env.WS_PORT || '8080', 10),
    host: process.env.WS_HOST || '0.0.0.0',
  },
  
  // Heartbeat
  heartbeat: {
    interval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10), // 30 seconds
    timeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '35000', 10), // 35 seconds
  },
  
  // Environment
  env: process.env.NODE_ENV || 'development',
  
  // Reconnection settings (for client reference)
  reconnection: {
    delays: [1000, 2000, 4000, 8000, 16000], // Exponential backoff: 1s, 2s, 4s, 8s, 16s max
  },
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required = [
    { key: 'SUPABASE_URL', value: config.supabase.url },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: config.supabase.serviceRoleKey },
  ];
  
  const missing = required.filter(({ value }) => !value);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(({ key }) => key).join(', ')}`
    );
  }
}
