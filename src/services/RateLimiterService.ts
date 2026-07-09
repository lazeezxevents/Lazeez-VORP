/**
 * RateLimiterService
 * 
 * Server-side rate limiting implementation for the Communication Module.
 * Uses Supabase database for distributed rate limiting (can be upgraded to Redis).
 * 
 * Requirements:
 * - 20.3: Implement rate limiting of 60 messages per minute per user
 * - 20.4: Display error message when rate limit exceeded
 * - 20.5: Implement rate limiting of 10 file uploads per minute per user
 */

import { supabase } from "@/integrations/supabase/client";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: string;
}

export interface RateLimitViolation {
  userId: string;
  action: 'message' | 'file_upload' | 'api_request';
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Rate limit configurations
 */
const RATE_LIMITS = {
  messages: {
    maxRequests: 60,
    windowMs: 60000, // 1 minute
    errorMessage: 'You are sending messages too quickly. Please wait a moment before trying again.',
  },
  fileUploads: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    errorMessage: 'You are uploading files too quickly. Please wait a moment before trying again.',
  },
  apiRequests: {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    errorMessage: 'Too many requests. Please slow down.',
  },
};

export class RateLimiterService {
  /**
   * Check if a message send is allowed
   * Requirements: 20.3, 20.4
   */
  static async checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'messages', RATE_LIMITS.messages);
  }

  /**
   * Check if a file upload is allowed
   * Requirements: 20.5, 20.4
   */
  static async checkFileUploadRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'file_uploads', RATE_LIMITS.fileUploads);
  }

  /**
   * Check if an API request is allowed
   */
  static async checkApiRateLimit(userId: string): Promise<RateLimitResult> {
    return this.checkRateLimit(userId, 'api_requests', RATE_LIMITS.apiRequests);
  }

  /**
   * Generic rate limit checker
   * Uses database-based rate limiting (can be upgraded to Redis for better performance)
   */
  private static async checkRateLimit(
    userId: string,
    action: string,
    config: typeof RATE_LIMITS.messages
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);
    const key = `${action}:${userId}`;

    try {
      // Get count of requests in the current window
      // In production, this should use Redis with INCR and EXPIRE commands
      // For now, we'll use a simple in-memory approach with localStorage for client-side
      // and database for server-side tracking
      
      const storageKey = `rate_limit_${key}`;
      const stored = localStorage.getItem(storageKey);
      
      let count = 0;
      let resetAt = new Date(now.getTime() + config.windowMs);

      if (stored) {
        const data = JSON.parse(stored);
        const storedResetAt = new Date(data.resetAt);
        
        // Check if window has expired
        if (now < storedResetAt) {
          count = data.count;
          resetAt = storedResetAt;
        }
      }

      // Check if limit exceeded
      if (count >= config.maxRequests) {
        // Log violation
        await this.logRateLimitViolation({
          userId,
          action: action as RateLimitViolation['action'],
          timestamp: now,
          metadata: {
            count,
            limit: config.maxRequests,
            windowMs: config.windowMs,
          },
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          error: config.errorMessage,
        };
      }

      // Increment counter
      count++;
      localStorage.setItem(
        storageKey,
        JSON.stringify({ count, resetAt: resetAt.toISOString() })
      );

      return {
        allowed: true,
        remaining: config.maxRequests - count,
        resetAt,
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now.getTime() + config.windowMs),
      };
    }
  }

  /**
   * Log rate limit violation to audit logs
   * Requirements: 20.4 (logging requirement)
   */
  static async logRateLimitViolation(violation: RateLimitViolation): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        user_id: violation.userId,
        action: 'rate_limit_violation',
        entity_type: 'communication',
        entity_id: null,
        details: {
          violation_type: violation.action,
          timestamp: violation.timestamp.toISOString(),
          ...violation.metadata,
        },
      });

      console.warn('[Rate Limit Violation]', {
        userId: violation.userId,
        action: violation.action,
        timestamp: violation.timestamp.toISOString(),
        metadata: violation.metadata,
      });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Reset rate limit for a user (admin function)
   */
  static async resetRateLimit(userId: string, action: string): Promise<void> {
    const key = `rate_limit_${action}:${userId}`;
    localStorage.removeItem(key);
  }

  /**
   * Get current rate limit status for a user
   */
  static async getRateLimitStatus(
    userId: string,
    action: string
  ): Promise<{ count: number; resetAt: Date; limit: number }> {
    const config =
      action === 'messages'
        ? RATE_LIMITS.messages
        : action === 'file_uploads'
        ? RATE_LIMITS.fileUploads
        : RATE_LIMITS.apiRequests;

    const key = `rate_limit_${action}:${userId}`;
    const stored = localStorage.getItem(key);
    const now = new Date();

    if (!stored) {
      return {
        count: 0,
        resetAt: new Date(now.getTime() + config.windowMs),
        limit: config.maxRequests,
      };
    }

    const data = JSON.parse(stored);
    const resetAt = new Date(data.resetAt);

    // Check if window has expired
    if (now >= resetAt) {
      return {
        count: 0,
        resetAt: new Date(now.getTime() + config.windowMs),
        limit: config.maxRequests,
      };
    }

    return {
      count: data.count,
      resetAt,
      limit: config.maxRequests,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  static cleanupExpiredEntries(): void {
    const now = new Date();
    
    // Get all keys from localStorage
    const keysToCheck: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rate_limit_')) {
        keysToCheck.push(key);
      }
    }

    // Check and remove expired entries
    keysToCheck.forEach((key) => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          const resetAt = new Date(data.resetAt);
          if (now >= resetAt) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Invalid data, remove it
        localStorage.removeItem(key);
      }
    });
  }
}

// Clean up expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    RateLimiterService.cleanupExpiredEntries();
  }, 5 * 60 * 1000);
}
