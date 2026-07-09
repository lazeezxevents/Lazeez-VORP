/**
 * CSRF Protection and Token Management
 * Task 11.3: Implement CSRF protection and token management
 * Requirements: 20.2, 20.7, 20.8
 */

import { supabase } from '@/integrations/supabase/client';

const CSRF_TOKEN_KEY = 'vorp_csrf_token';
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store CSRF token in session storage
 */
export function storeCsrfToken(token: string): void {
  const expiry = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify({ token, expiry }));
}

/**
 * Get CSRF token from session storage
 */
export function getCsrfToken(): string | null {
  const stored = sessionStorage.getItem(CSRF_TOKEN_KEY);
  
  if (!stored) {
    return null;
  }

  try {
    const { token, expiry } = JSON.parse(stored);
    
    // Check if token has expired
    if (Date.now() >= expiry) {
      sessionStorage.removeItem(CSRF_TOKEN_KEY);
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Initialize CSRF token on app load
 */
export function initializeCsrfToken(): string {
  let token = getCsrfToken();
  
  if (!token) {
    token = generateCsrfToken();
    storeCsrfToken(token);
  }

  return token;
}

/**
 * Validate CSRF token for state-changing operations
 */
export function validateCsrfToken(providedToken: string): boolean {
  const storedToken = getCsrfToken();
  
  if (!storedToken || !providedToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(storedToken, providedToken);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Add CSRF token to request headers
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfToken();
  
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token
    };
  }

  return headers;
}

/**
 * Token refresh manager
 * Automatically refreshes auth token before expiry
 */
class TokenRefreshManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  async start(): Promise<void> {
    await this.scheduleRefresh();
  }

  stop(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async scheduleRefresh(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return;
      }

      // Calculate time until token expiry
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const refreshIn = Math.max(0, timeUntilExpiry - this.REFRESH_BEFORE_EXPIRY_MS);

      // Schedule refresh
      this.refreshTimer = setTimeout(async () => {
        await this.refreshToken();
        await this.scheduleRefresh(); // Schedule next refresh
      }, refreshIn);

    } catch (error) {
      console.error('[Token Refresh] Failed to schedule refresh:', error);
    }
  }

  private async refreshToken(): Promise<void> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[Token Refresh] Failed to refresh token:', error);
        return;
      }

      if (data.session) {
        console.log('[Token Refresh] Token refreshed successfully');
      }
    } catch (error) {
      console.error('[Token Refresh] Unexpected error:', error);
    }
  }
}

export const tokenRefreshManager = new TokenRefreshManager();

/**
 * Ensure WebSocket connections use TLS/SSL
 */
export function getSecureWebSocketUrl(baseUrl: string): string {
  // Force wss:// protocol for secure WebSocket connections
  if (baseUrl.startsWith('ws://')) {
    return baseUrl.replace('ws://', 'wss://');
  }
  
  if (!baseUrl.startsWith('wss://')) {
    return `wss://${baseUrl}`;
  }

  return baseUrl;
}

/**
 * Validate session token
 */
export async function validateSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return false;
    }

    // Check if session is expired
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (Date.now() >= expiresAt) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
