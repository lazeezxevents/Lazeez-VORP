/**
 * Rate Limiter for Finance Module
 * Implements rate limiting for financial endpoints (100 req/min)
 * Tracks and logs rate limit violations
 */

import { supabase } from '@/integrations/supabase/client';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  endpoint: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitViolation {
  user_id: string;
  endpoint: string;
  request_count: number;
  window_start: Date;
  ip_address?: string;
  user_agent?: string;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private limitStore: Map<string, RateLimitEntry> = new Map();
  
  // Default: 100 requests per minute
  private readonly DEFAULT_MAX_REQUESTS = 100;
  private readonly DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute

  private constructor() {
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkLimit(
    userId: string,
    endpoint: string,
    config?: Partial<RateLimitConfig>
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const maxRequests = config?.maxRequests ?? this.DEFAULT_MAX_REQUESTS;
    const windowMs = config?.windowMs ?? this.DEFAULT_WINDOW_MS;
    
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    
    let entry = this.limitStore.get(key);
    
    // Initialize or reset if window expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
      this.limitStore.set(key, entry);
    }
    
    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      // Log violation
      await this.logViolation({
        user_id: userId,
        endpoint,
        request_count: entry.count,
        window_start: new Date(entry.resetTime - windowMs)
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }
    
    // Increment counter
    entry.count++;
    
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Log rate limit violation to database
   */
  private async logViolation(violation: RateLimitViolation): Promise<void> {
    try {
      await supabase.from('finance_rate_limit_violations').insert({
        user_id: violation.user_id,
        endpoint: violation.endpoint,
        request_count: violation.request_count,
        window_start: violation.window_start.toISOString(),
        ip_address: violation.ip_address,
        user_agent: violation.user_agent,
        violated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limitStore.entries()) {
      if (now > entry.resetTime) {
        this.limitStore.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a user/endpoint
   */
  reset(userId: string, endpoint: string): void {
    const key = `${userId}:${endpoint}`;
    this.limitStore.delete(key);
  }

  /**
   * Get current usage for a user/endpoint
   */
  getUsage(userId: string, endpoint: string): RateLimitEntry | null {
    const key = `${userId}:${endpoint}`;
    return this.limitStore.get(key) ?? null;
  }
}

/**
 * React hook for rate limiting
 */
export function useRateLimit(endpoint: string) {
  const limiter = RateLimiter.getInstance();
  
  const checkLimit = async (userId: string) => {
    return await limiter.checkLimit(userId, endpoint);
  };
  
  return { checkLimit };
}

/**
 * Higher-order function to wrap API calls with rate limiting
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  endpoint: string
): T {
  return (async (...args: Parameters<T>) => {
    const limiter = RateLimiter.getInstance();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }
    
    // Check rate limit
    const { allowed, remaining, resetTime } = await limiter.checkLimit(
      user.id,
      endpoint
    );
    
    if (!allowed) {
      const resetDate = new Date(resetTime);
      throw new Error(
        `Rate limit exceeded. Try again after ${resetDate.toLocaleTimeString()}`
      );
    }
    
    // Add rate limit headers to response metadata
    const result = await fn(...args);
    
    // Attach rate limit info if result is an object
    if (result && typeof result === 'object') {
      result._rateLimit = {
        remaining,
        resetTime
      };
    }
    
    return result;
  }) as T;
}

/**
 * Middleware for rate limiting financial operations
 */
export class FinanceRateLimitMiddleware {
  private static readonly ENDPOINTS = {
    JOURNAL_ENTRY: 'finance/journal-entry',
    TRANSACTION: 'finance/transaction',
    INVOICE: 'finance/invoice',
    EXPENSE: 'finance/expense',
    PAYOUT: 'finance/payout',
    REPORT: 'finance/report',
    FORECAST: 'finance/forecast',
    BUDGET: 'finance/budget'
  };

  /**
   * Apply rate limiting to journal entry operations
   */
  static async checkJournalEntry(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.JOURNAL_ENTRY
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for journal entries. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }

  /**
   * Apply rate limiting to transaction operations
   */
  static async checkTransaction(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.TRANSACTION
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for transactions. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }

  /**
   * Apply rate limiting to invoice operations
   */
  static async checkInvoice(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.INVOICE
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for invoices. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }

  /**
   * Apply rate limiting to expense operations
   */
  static async checkExpense(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.EXPENSE
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for expenses. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }

  /**
   * Apply rate limiting to payout operations (stricter limit)
   */
  static async checkPayout(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.PAYOUT,
      { maxRequests: 50 } // Stricter limit for payouts
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for payouts. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }

  /**
   * Apply rate limiting to report generation (stricter limit)
   */
  static async checkReport(userId: string): Promise<void> {
    const limiter = RateLimiter.getInstance();
    const { allowed, resetTime } = await limiter.checkLimit(
      userId,
      this.ENDPOINTS.REPORT,
      { maxRequests: 30 } // Stricter limit for reports
    );
    
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for reports. Reset at ${new Date(resetTime).toLocaleTimeString()}`
      );
    }
  }
}
