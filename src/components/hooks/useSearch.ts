/**
 * useSearch Hook
 * Task 15.1: Create search interface with keyboard shortcut
 * Requirements: 9.1, 9.5, 9.6, 9.7
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useSearch = () => {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut handler (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation handlers
  const handleNavigateToMessage = useCallback((channelId: string, messageId: string) => {
    navigate(`/communication/channels/${channelId}?message=${messageId}`);
    setIsSearchOpen(false);
  }, [navigate]);

  const handleNavigateToChannel = useCallback((channelId: string) => {
    navigate(`/communication/channels/${channelId}`);
    setIsSearchOpen(false);
  }, [navigate]);

  const handleNavigateToUser = useCallback((userId: string) => {
    navigate(`/communication/direct-messages/${userId}`);
    setIsSearchOpen(false);
  }, [navigate]);

  const handleClose = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  return {
    isSearchOpen,
    openSearch,
    closeSearch: handleClose,
    handleNavigateToMessage,
    handleNavigateToChannel,
    handleNavigateToUser,
  };
};
