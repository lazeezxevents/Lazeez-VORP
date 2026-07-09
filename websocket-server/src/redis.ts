import Redis from 'ioredis';
import { config } from './config.js';
import { RedisPubSubMessage } from './types.js';

/**
 * Redis clients for pub/sub
 * Requirements: 19.2 - Use Redis Pub/Sub for message distribution across multiple server instances
 */
let publisher: Redis;
let subscriber: Redis;

/**
 * Initialize Redis clients
 */
export function initializeRedis(): void {
  const redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };
  
  publisher = new Redis(redisConfig);
  subscriber = new Redis(redisConfig);
  
  publisher.on('connect', () => {
    console.log('Redis publisher connected');
  });
  
  subscriber.on('connect', () => {
    console.log('Redis subscriber connected');
  });
  
  publisher.on('error', (error) => {
    console.error('Redis publisher error:', error);
  });
  
  subscriber.on('error', (error) => {
    console.error('Redis subscriber error:', error);
  });
}

/**
 * Publish message to Redis channel
 * 
 * @param channel - Redis channel name
 * @param message - Message to publish
 */
export async function publishMessage(
  channel: string,
  message: RedisPubSubMessage
): Promise<void> {
  try {
    await publisher.publish(channel, JSON.stringify(message));
  } catch (error) {
    console.error('Failed to publish message to Redis:', error);
  }
}

/**
 * Subscribe to Redis channel
 * 
 * @param channel - Redis channel name
 * @param callback - Callback function for received messages
 */
export function subscribeToChannel(
  channel: string,
  callback: (message: RedisPubSubMessage) => void
): void {
  subscriber.subscribe(channel, (error) => {
    if (error) {
      console.error(`Failed to subscribe to channel ${channel}:`, error);
    } else {
      console.log(`Subscribed to Redis channel: ${channel}`);
    }
  });
  
  subscriber.on('message', (receivedChannel, message) => {
    if (receivedChannel === channel) {
      try {
        const parsedMessage = JSON.parse(message) as RedisPubSubMessage;
        callback(parsedMessage);
      } catch (error) {
        console.error('Failed to parse Redis message:', error);
      }
    }
  });
}

/**
 * Unsubscribe from Redis channel
 * 
 * @param channel - Redis channel name
 */
export async function unsubscribeFromChannel(channel: string): Promise<void> {
  try {
    await subscriber.unsubscribe(channel);
    console.log(`Unsubscribed from Redis channel: ${channel}`);
  } catch (error) {
    console.error(`Failed to unsubscribe from channel ${channel}:`, error);
  }
}

/**
 * Close Redis connections
 */
export async function closeRedis(): Promise<void> {
  await publisher.quit();
  await subscriber.quit();
  console.log('Redis connections closed');
}

/**
 * Get Redis publisher instance
 */
export function getPublisher(): Redis {
  return publisher;
}

/**
 * Get Redis subscriber instance
 */
export function getSubscriber(): Redis {
  return subscriber;
}
