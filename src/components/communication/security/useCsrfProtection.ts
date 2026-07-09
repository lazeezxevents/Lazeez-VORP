/**
 * CSRF Protection React Hook
 * Task 11.3: Implement CSRF protection and token management
 * Requirements: 20.2, 20.7, 20.8
 * 
 * Provides easy integration of CSRF protection in React components
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  initializeCsrfToken, 
  getCsrfToken, 
  validateSession,
  tokenRefreshManager 
} from './csrfProtection';
import { communicationApi, secureSupabaseClient } from './communicationApi';

/**
 * Hook for CSRF protection and token management
 * 
 * Automatically:
 * - Initializes CSRF token on mount
 * - Starts token refresh manager
 * - Provides secure API clients
 * - Validates session state
 */
export function useCsrfProtection() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isSessionValid, setIsSessionValid] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize CSRF token and start token refresh
  useEffect(() => {
    const initialize = async () => {
      // Initialize CSRF token
      const token = initializeCsrfToken();
      setCsrfToken(token);

      // Start automatic token refresh
      await tokenRefreshManager.start();

      // Validate initial session
      const isValid = await validateSession();
      setIsSessionValid(isValid);

      setIsInitialized(true);
    };

    initialize();

    // Cleanup on unmount
    return () => {
      tokenRefreshManager.stop();
    };
  }, []);

  // Refresh CSRF token manually
  const refreshCsrfToken = useCallback(() => {
    const token = initializeCsrfToken();
    setCsrfToken(token);
    return token;
  }, []);

  // Check session validity
  const checkSession = useCallback(async () => {
    const isValid = await validateSession();
    setIsSessionValid(isValid);
    return isValid;
  }, []);

  // Get current CSRF token
  const getCurrentToken = useCallback(() => {
    return getCsrfToken();
  }, []);

  return {
    // State
    csrfToken,
    isSessionValid,
    isInitialized,

    // Methods
    refreshCsrfToken,
    checkSession,
    getCurrentToken,

    // Secure API clients
    api: communicationApi,
    supabase: secureSupabaseClient,
  };
}

/**
 * Hook for secure message operations
 * 
 * Provides CSRF-protected message operations with optimized performance
 */
export function useSecureMessages() {
  const { supabase, isSessionValid } = useCsrfProtection();

  const sendMessage = useCallback(
    async (channelId: string, content: string, threadParentId?: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.sendMessage(channelId, content, threadParentId);
    },
    [supabase, isSessionValid]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.editMessage(messageId, content);
    },
    [supabase, isSessionValid]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.deleteMessage(messageId);
    },
    [supabase, isSessionValid]
  );

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.addReaction(messageId, emoji);
    },
    [supabase, isSessionValid]
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string, userId: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.removeReaction(messageId, emoji, userId);
    },
    [supabase, isSessionValid]
  );

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    isSessionValid,
  };
}

/**
 * Hook for secure channel operations
 * 
 * Provides CSRF-protected channel operations
 */
export function useSecureChannels() {
  const { supabase, isSessionValid } = useCsrfProtection();

  const createChannel = useCallback(
    async (
      departmentId: string,
      name: string,
      description?: string,
      isPrivate: boolean = false
    ) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.createChannel(departmentId, name, description, isPrivate);
    },
    [supabase, isSessionValid]
  );

  const archiveChannel = useCallback(
    async (channelId: string) => {
      if (!isSessionValid) {
        throw new Error('Session expired. Please log in again.');
      }
      return supabase.archiveChannel(channelId);
    },
    [supabase, isSessionValid]
  );

  return {
    createChannel,
    archiveChannel,
    isSessionValid,
  };
}
