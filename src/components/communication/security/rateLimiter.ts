/**
 * Rate Limiting Implementation
 * Task 11.2: Implement rate limiting
 * Requirements: 20.3, 20.4, 20.5
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter for client-side enforcement
 * Server-side should use Redis for distributed rate limiting
 */
class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   * @param key - Unique identifier (e.g., userId + action)
   * @returns true if allowed, false if rate limited
   */
  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No previous requests or window expired
    if (!entry || now >= entry.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return { allowed: true };
    }

    // Within rate limit
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return { allowed: true };
    }

    // Rate limited
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Message rate limiter: 60 messages per minute per user
export const messageRateLimiter = new RateLimiter({
  maxRequests: 60,
  windowMs: 60000, // 1 minute
  message: 'You are sending messages too quickly. Please wait a moment.'
});

// File upload rate limiter: 10 uploads per minute per user
export const fileUploadRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: 'You are uploading files too quickly. Please wait a moment.'
});

// API request rate limiter: 100 requests per minute per user
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  message: 'Too many requests. Please slow down.'
});

/**
 * Check if user can send a message
 */
export function checkMessageRateLimit(userId: string): {
  allowed: boolean;
  error?: string;
  retryAfter?: number;
} {
  const result = messageRateLimiter.check(`message:${userId}`);
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: 'You are sending messages too quickly. Please wait a moment.',
      retryAfter: result.retryAfter
    };
  }

  return { allowed: true };
}

/**
 * Check if user can upload a file
 */
export function checkFileUploadRateLimit(userId: string): {
  allowed: boolean;
  error?: string;
  retryAfter?: number;
} {
  const result = fileUploadRateLimiter.check(`upload:${userId}`);
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: 'You are uploading files too quickly. Please wait a moment.',
      retryAfter: result.retryAfter
    };
  }

  return { allowed: true };
}

/**
 * Check if user can make an API request
 */
export function checkApiRateLimit(userId: string, endpoint: string): {
  allowed: boolean;
  error?: string;
  retryAfter?: number;
} {
  const result = apiRateLimiter.check(`api:${userId}:${endpoint}`);
  
  if (!result.allowed) {
    return {
      allowed: false,
      error: 'Too many requests. Please slow down.',
      retryAfter: result.retryAfter
    };
  }

  return { allowed: true };
}

/**
 * Log rate limit violation
 */
export function logRateLimitViolation(
  userId: string,
  action: string,
  metadata?: Record<string, any>
): void {
  console.warn('[Rate Limit] Violation detected', {
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...metadata
  });

  // In production, send to monitoring system
  // Example: sendToMonitoring({ type: 'rate_limit_violation', userId, action });
}
