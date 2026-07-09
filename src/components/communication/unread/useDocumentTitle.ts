import { useEffect } from 'react';

/**
 * Hook to update document title with unread count
 * 
 * Requirements: 35.5
 */
export const useDocumentTitle = (unreadCount: number, baseTitle: string = 'Lazeez VORP') => {
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }

    // Cleanup: restore original title on unmount
    return () => {
      document.title = baseTitle;
    };
  }, [unreadCount, baseTitle]);
};
