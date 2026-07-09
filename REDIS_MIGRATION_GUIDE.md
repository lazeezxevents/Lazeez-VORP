# Redis Migration Guide for Communication Module

## Overview

This guide provides step-by-step instructions for migrating the communication module from localStorage-based implementations to production-ready Redis integration.

---

## Part 1: Windows 11 Redis Setup

### Recommended: Docker Desktop Method

#### Step 1: Install Docker Desktop
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop/
2. Run the installer
3. Restart your computer
4. Open Docker Desktop and complete setup

#### Step 2: Run Redis Container
```powershell
# Open PowerShell
docker run -d --name redis-comm -p 6379:6379 redis:latest

# Verify Redis is running
docker ps
# Should show redis-comm container

# Test Redis connection
docker exec -it redis-comm redis-cli ping
# Should return: PONG
```

#### Step 3: Install Redis GUI (Optional but Recommended)
Download RedisInsight: https://redis.com/redis-enterprise/redis-insight/

This provides a visual interface to inspect Redis data.

---

## Part 2: Node.js Redis Integration

### Install Redis Client

```bash
npm install ioredis
npm install --save-dev @types/ioredis
```

### Create Redis Client Singleton

Create `src/services/RedisClient.ts`:

```typescript
import Redis from 'ioredis';

class RedisClientSingleton {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!this.instance) {
      this.instance = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.instance.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.instance.on('connect', () => {
        console.log('Redis Client Connected');
      });
    }

    return this.instance;
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
    }
  }
}

export const getRedisClient = () => RedisClientSingleton.getInstance();
export const disconnectRedis = () => RedisClientSingleton.disconnect();
```

### Update Environment Variables

Add to `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_password_if_needed
```

---

## Part 3: Migrate Rate Limiter to Redis

### Current Implementation (localStorage - FRAGILE)

```typescript
// src/services/RateLimiterService.ts (CURRENT - DON'T USE)
class RateLimiterService {
  private getViolations(key: string): number[] {
    const stored = localStorage.getItem(key); // ❌ Browser-only, easily bypassed
    return stored ? JSON.parse(stored) : [];
  }
}
```

### New Implementation (Redis - PRODUCTION-READY)

Create `src/services/RedisRateLimiterService.ts`:

```typescript
import { getRedisClient } from './RedisClient';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export class RedisRateLimiterService {
  private redis = getRedisClient();

  /**
   * Check if action is allowed under rate limit
   * Uses sliding window algorithm with Redis
   */
  async checkRateLimit(
    userId: string,
    action: 'message' | 'upload' | 'api',
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const limits: Record<string, RateLimitConfig> = {
      message: { maxRequests: 60, windowSeconds: 60 },
      upload: { maxRequests: 10, windowSeconds: 60 },
      api: { maxRequests: 100, windowSeconds: 60 },
    };

    const limit = config || limits[action];
    const key = `ratelimit:${action}:${userId}`;
    const now = Date.now();
    const windowStart = now - limit.windowSeconds * 1000;

    try {
      // Use Redis sorted set for sliding window
      const multi = this.redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, now, `${now}`);

      // Count requests in window
      multi.zcard(key);

      // Set expiry on key
      multi.expire(key, limit.windowSeconds);

      const results = await multi.exec();

      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const count = results[2][1] as number;
      const allowed = count <= limit.maxRequests;
      const remaining = Math.max(0, limit.maxRequests - count);
      const resetAt = new Date(now + limit.windowSeconds * 1000);

      // Log violation if rate limit exceeded
      if (!allowed) {
        await this.logViolation(userId, action, count);
      }

      return { allowed, remaining, resetAt };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: limit.maxRequests,
        resetAt: new Date(now + limit.windowSeconds * 1000),
      };
    }
  }

  /**
   * Log rate limit violation to audit logs
   */
  private async logViolation(
    userId: string,
    action: string,
    attemptCount: number
  ): Promise<void> {
    try {
      const violationKey = `ratelimit:violations:${userId}`;
      const violation = {
        action,
        attemptCount,
        timestamp: new Date().toISOString(),
      };

      await this.redis.lpush(violationKey, JSON.stringify(violation));
      await this.redis.ltrim(violationKey, 0, 99); // Keep last 100 violations
      await this.redis.expire(violationKey, 86400); // 24 hours

      // TODO: Also log to VORP audit_logs table
      console.warn(`Rate limit violation: ${userId} - ${action} (${attemptCount} attempts)`);
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Get rate limit status without incrementing
   */
  async getRateLimitStatus(
    userId: string,
    action: 'message' | 'upload' | 'api'
  ): Promise<RateLimitResult> {
    const limits: Record<string, RateLimitConfig> = {
      message: { maxRequests: 60, windowSeconds: 60 },
      upload: { maxRequests: 10, windowSeconds: 60 },
      api: { maxRequests: 100, windowSeconds: 60 },
    };

    const limit = limits[action];
    const key = `ratelimit:${action}:${userId}`;
    const now = Date.now();
    const windowStart = now - limit.windowSeconds * 1000;

    try {
      // Remove old entries
      await this.redis.zremrangebyscore(key, 0, windowStart);

      // Count current requests
      const count = await this.redis.zcard(key);
      const remaining = Math.max(0, limit.maxRequests - count);
      const resetAt = new Date(now + limit.windowSeconds * 1000);

      return {
        allowed: count < limit.maxRequests,
        remaining,
        resetAt,
      };
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return {
        allowed: true,
        remaining: limit.maxRequests,
        resetAt: new Date(now + limit.windowSeconds * 1000),
      };
    }
  }

  /**
   * Reset rate limit for a user (admin action)
   */
  async resetRateLimit(userId: string, action?: string): Promise<void> {
    try {
      if (action) {
        const key = `ratelimit:${action}:${userId}`;
        await this.redis.del(key);
      } else {
        // Reset all rate limits for user
        const pattern = `ratelimit:*:${userId}`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redisRateLimiter = new RedisRateLimiterService();
```

### Create API Endpoint for Rate Limit Checks

Create `supabase/functions/check-rate-limit/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Redis } from 'https://deno.land/x/redis@v0.29.0/mod.ts';

const redis = await Redis.connect({
  hostname: Deno.env.get('REDIS_HOST') || 'localhost',
  port: parseInt(Deno.env.get('REDIS_PORT') || '6379'),
});

serve(async (req) => {
  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const { action } = await req.json();
    const userId = user.id;

    // Rate limit configuration
    const limits: Record<string, { max: number; window: number }> = {
      message: { max: 60, window: 60 },
      upload: { max: 10, window: 60 },
      api: { max: 100, window: 60 },
    };

    const limit = limits[action] || limits.api;
    const key = `ratelimit:${action}:${userId}`;
    const now = Date.now();
    const windowStart = now - limit.window * 1000;

    // Sliding window algorithm
    await redis.zremrangebyscore(key, 0, windowStart);
    await redis.zadd(key, now, `${now}`);
    const count = await redis.zcard(key);
    await redis.expire(key, limit.window);

    const allowed = count <= limit.max;
    const remaining = Math.max(0, limit.max - count);

    // Log violation
    if (!allowed) {
      console.warn(`Rate limit exceeded: ${userId} - ${action} (${count}/${limit.max})`);
    }

    return new Response(
      JSON.stringify({
        allowed,
        remaining,
        resetAt: new Date(now + limit.window * 1000).toISOString(),
      }),
      {
        status: allowed ? 200 : 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Rate limit check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### Update Frontend to Use Redis Rate Limiter

Update `src/components/communication/MessageComposer.tsx`:

```typescript
import { redisRateLimiter } from '@/services/RedisRateLimiterService';

const MessageComposer = () => {
  const handleSend = async () => {
    // Check rate limit before sending
    const rateLimitResult = await redisRateLimiter.checkRateLimit(
      user.id,
      'message'
    );

    if (!rateLimitResult.allowed) {
      toast.error(
        `Rate limit exceeded. Please wait ${Math.ceil(
          (rateLimitResult.resetAt.getTime() - Date.now()) / 1000
        )} seconds.`
      );
      return;
    }

    // Send message
    await sendMessage(content);
  };

  return (
    // ... component JSX
  );
};
```

---

## Part 4: WebSocket Pub/Sub with Redis

### Create WebSocket Server with Redis Pub/Sub

Create `websocket-server/index.ts`:

```typescript
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { getRedisClient } from '../src/services/RedisClient';
import jwt from 'jsonwebtoken';

const wss = new WebSocketServer({ port: 8080 });
const redis = getRedisClient();
const redisSub = redis.duplicate();

// Connection map: userId -> WebSocket[]
const connections = new Map<string, WebSocket[]>();

// Authenticate WebSocket connection
async function authenticateConnection(token: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Handle new WebSocket connection
wss.on('connection', async (ws, req) => {
  // Extract token from query string
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  const userId = await authenticateConnection(token);

  if (!userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // Add connection to map
  if (!connections.has(userId)) {
    connections.set(userId, []);
  }
  connections.get(userId)!.push(ws);

  console.log(`User ${userId} connected (${connections.get(userId)!.length} connections)`);

  // Subscribe to user's channels
  const userChannels = await getUserChannels(userId);
  for (const channelId of userChannels) {
    await redisSub.subscribe(`channel:${channelId}`);
  }

  // Heartbeat
  const heartbeatInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  // Handle messages from client
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'send_message':
          await handleSendMessage(userId, message.payload);
          break;
        case 'typing_start':
          await handleTypingStart(userId, message.payload.channelId);
          break;
        case 'typing_stop':
          await handleTypingStop(userId, message.payload.channelId);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    clearInterval(heartbeatInterval);

    const userConnections = connections.get(userId);
    if (userConnections) {
      const index = userConnections.indexOf(ws);
      if (index > -1) {
        userConnections.splice(index, 1);
      }

      if (userConnections.length === 0) {
        connections.delete(userId);
        console.log(`User ${userId} disconnected (all connections closed)`);
      }
    }
  });
});

// Listen to Redis Pub/Sub
redisSub.on('message', (channel, message) => {
  const data = JSON.parse(message);

  // Broadcast to all connected clients subscribed to this channel
  if (channel.startsWith('channel:')) {
    const channelId = channel.replace('channel:', '');
    broadcastToChannel(channelId, data);
  }
});

// Broadcast message to all users in a channel
function broadcastToChannel(channelId: string, data: any) {
  // Get all users in channel
  getChannelMembers(channelId).then((memberIds) => {
    for (const memberId of memberIds) {
      const userConnections = connections.get(memberId);
      if (userConnections) {
        for (const ws of userConnections) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
          }
        }
      }
    }
  });
}

// Handle send message
async function handleSendMessage(userId: string, payload: any) {
  const { channelId, content, threadParentId, attachments } = payload;

  // Check rate limit
  const rateLimitKey = `ratelimit:message:${userId}`;
  const count = await redis.incr(rateLimitKey);

  if (count === 1) {
    await redis.expire(rateLimitKey, 60);
  }

  if (count > 60) {
    // Rate limit exceeded
    const userConnections = connections.get(userId);
    if (userConnections) {
      for (const ws of userConnections) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Rate limit exceeded',
          })
        );
      }
    }
    return;
  }

  // Save message to database
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      user_id: userId,
      content,
      thread_parent_id: threadParentId,
    })
    .select('*, user:users(*)')
    .single();

  if (error) {
    console.error('Failed to save message:', error);
    return;
  }

  // Publish to Redis
  await redis.publish(
    `channel:${channelId}`,
    JSON.stringify({
      type: 'message_new',
      payload: message,
    })
  );
}

// Helper functions
async function getUserChannels(userId: string): Promise<string[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('channel_members')
    .select('channel_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get user channels:', error);
    return [];
  }

  return data.map((row) => row.channel_id);
}

async function getChannelMembers(channelId: string): Promise<string[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('channel_members')
    .select('user_id')
    .eq('channel_id', channelId);

  if (error) {
    console.error('Failed to get channel members:', error);
    return [];
  }

  return data.map((row) => row.user_id);
}

async function handleTypingStart(userId: string, channelId: string) {
  await redis.publish(
    `channel:${channelId}`,
    JSON.stringify({
      type: 'user_typing',
      payload: {
        userId,
        channelId,
        isTyping: true,
      },
    })
  );
}

async function handleTypingStop(userId: string, channelId: string) {
  await redis.publish(
    `channel:${channelId}`,
    JSON.stringify({
      type: 'user_typing',
      payload: {
        userId,
        channelId,
        isTyping: false,
      },
    })
  );
}

console.log('WebSocket server running on ws://localhost:8080');
```

---

## Part 5: User Presence with Redis

### Create Presence Service

Create `src/services/RedisPresenceService.ts`:

```typescript
import { getRedisClient } from './RedisClient';

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  lastSeen: Date;
}

export class RedisPresenceService {
  private redis = getRedisClient();
  private readonly PRESENCE_TTL = 300; // 5 minutes

  /**
   * Update user presence status
   */
  async updatePresence(
    userId: string,
    status: PresenceStatus,
    customStatus?: string
  ): Promise<void> {
    try {
      const key = `presence:${userId}`;
      const data: UserPresence = {
        userId,
        status,
        customStatus,
        lastSeen: new Date(),
      };

      await this.redis.setex(key, this.PRESENCE_TTL, JSON.stringify(data));

      // Publish presence update
      await this.redis.publish(
        'presence:updates',
        JSON.stringify({
          type: 'presence_update',
          payload: data,
        })
      );
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }

  /**
   * Get user presence
   */
  async getPresence(userId: string): Promise<UserPresence | null> {
    try {
      const key = `presence:${userId}`;
      const data = await this.redis.get(key);

      if (!data) {
        return {
          userId,
          status: 'offline',
          lastSeen: new Date(),
        };
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get presence:', error);
      return null;
    }
  }

  /**
   * Get presence for multiple users
   */
  async getBulkPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    const presenceMap = new Map<string, UserPresence>();

    try {
      const pipeline = this.redis.pipeline();

      for (const userId of userIds) {
        pipeline.get(`presence:${userId}`);
      }

      const results = await pipeline.exec();

      if (!results) {
        return presenceMap;
      }

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const [error, data] = results[i];

        if (error || !data) {
          presenceMap.set(userId, {
            userId,
            status: 'offline',
            lastSeen: new Date(),
          });
        } else {
          presenceMap.set(userId, JSON.parse(data as string));
        }
      }

      return presenceMap;
    } catch (error) {
      console.error('Failed to get bulk presence:', error);
      return presenceMap;
    }
  }

  /**
   * Heartbeat to keep presence alive
   */
  async heartbeat(userId: string): Promise<void> {
    try {
      const key = `presence:${userId}`;
      const exists = await this.redis.exists(key);

      if (exists) {
        await this.redis.expire(key, this.PRESENCE_TTL);
      } else {
        // Presence expired, set to online
        await this.updatePresence(userId, 'online');
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  /**
   * Set user offline
   */
  async setOffline(userId: string): Promise<void> {
    try {
      await this.updatePresence(userId, 'offline');
    } catch (error) {
      console.error('Failed to set offline:', error);
    }
  }
}

export const redisPresenceService = new RedisPresenceService();
```

---

## Part 6: Testing Redis Integration

### Test Rate Limiter

Create `src/services/__tests__/RedisRateLimiterService.test.ts`:

```typescript
import { redisRateLimiter } from '../RedisRateLimiterService';
import { getRedisClient } from '../RedisClient';

describe('RedisRateLimiterService', () => {
  const redis = getRedisClient();
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    // Clear test data
    const keys = await redis.keys(`ratelimit:*:${testUserId}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('should allow requests within rate limit', async () => {
    const result = await redisRateLimiter.checkRateLimit(testUserId, 'message');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59); // 60 - 1
  });

  it('should block requests exceeding rate limit', async () => {
    // Send 60 messages (at limit)
    for (let i = 0; i < 60; i++) {
      await redisRateLimiter.checkRateLimit(testUserId, 'message');
    }

    // 61st message should be blocked
    const result = await redisRateLimiter.checkRateLimit(testUserId, 'message');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset rate limit after window expires', async () => {
    // Send 60 messages
    for (let i = 0; i < 60; i++) {
      await redisRateLimiter.checkRateLimit(testUserId, 'message');
    }

    // Wait for window to expire (61 seconds)
    await new Promise((resolve) => setTimeout(resolve, 61000));

    // Should allow again
    const result = await redisRateLimiter.checkRateLimit(testUserId, 'message');

    expect(result.allowed).toBe(true);
  }, 70000); // 70 second timeout

  it('should track different actions separately', async () => {
    // Send 60 messages
    for (let i = 0; i < 60; i++) {
      await redisRateLimiter.checkRateLimit(testUserId, 'message');
    }

    // Upload should still be allowed
    const uploadResult = await redisRateLimiter.checkRateLimit(testUserId, 'upload');

    expect(uploadResult.allowed).toBe(true);
    expect(uploadResult.remaining).toBe(9); // 10 - 1
  });
});
```

### Run Tests

```bash
npm test -- RedisRateLimiterService.test.ts
```

---

## Part 7: Deployment Checklist

### Environment Variables

Add to production `.env`:
```env
# Redis Configuration
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_TLS=true

# WebSocket Server
WEBSOCKET_URL=wss://your-websocket-server.com
```

### Redis Production Setup

For production, use a managed Redis service:

1. **AWS ElastiCache** (Recommended for AWS deployments)
2. **Redis Cloud** (https://redis.com/redis-enterprise-cloud/)
3. **Upstash** (https://upstash.com/) - Serverless Redis

### Monitoring

Add Redis monitoring:

```typescript
// src/services/RedisMonitoring.ts
import { getRedisClient } from './RedisClient';

export async function getRedisStats() {
  const redis = getRedisClient();

  const info = await redis.info();
  const stats = {
    connectedClients: 0,
    usedMemory: 0,
    totalKeys: 0,
    hitRate: 0,
  };

  // Parse info string
  const lines = info.split('\r\n');
  for (const line of lines) {
    if (line.startsWith('connected_clients:')) {
      stats.connectedClients = parseInt(line.split(':')[1]);
    }
    if (line.startsWith('used_memory:')) {
      stats.usedMemory = parseInt(line.split(':')[1]);
    }
  }

  // Get total keys
  stats.totalKeys = await redis.dbsize();

  return stats;
}
```

---

## Summary

This migration guide covers:

1. ✅ Windows 11 Redis setup (Docker Desktop recommended)
2. ✅ Redis client integration
3. ✅ Rate limiter migration from localStorage to Redis
4. ✅ WebSocket Pub/Sub with Redis
5. ✅ User presence tracking with Redis
6. ✅ Testing Redis integration
7. ✅ Production deployment checklist

### Next Steps

1. Set up Redis on Windows 11 using Docker Desktop
2. Implement RedisRateLimiterService
3. Create WebSocket server with Redis Pub/Sub
4. Implement presence service
5. Test all Redis integrations
6. Deploy to production with managed Redis

---

**End of Redis Migration Guide**
