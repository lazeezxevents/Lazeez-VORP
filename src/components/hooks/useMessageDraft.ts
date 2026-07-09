import { useEffect, useRef } from 'react';
import { debounce } from '@/components/utils/debounce';

interface DraftData {
  content: string;
  attachments?: string[];
  threadParentId?: string;
}

/**
 * Hook for managing message drafts with auto-save
 * Drafts are saved to localStorage with 500ms debounce
 */
export const useMessageDraft = (channelId: string, threadParentId?: string) => {
  const draftKey = threadParentId
    ? `draft:${channelId}:${threadParentId}`
    : `draft:${channelId}`;

  // Debounced save function (500ms delay)
  const saveDraftRef = useRef(
    debounce((draft: DraftData) => {
      try {
        if (draft.content.trim() || draft.attachments?.length) {
          localStorage.setItem(draftKey, JSON.stringify(draft));
        } else {
          // Clear draft if empty
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 500)
  );

  /**
   * Save draft to localStorage (debounced)
   */
  const saveDraft = (content: string, attachments?: string[]) => {
    saveDraftRef.current({
      content,
      attachments,
      threadParentId,
    });
  };

  /**
   * Load draft from localStorage
   */
  const loadDraft = (): DraftData | null => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    return null;
  };

  /**
   * Clear draft from localStorage
   */
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  /**
   * Get all drafts for the current channel
   */
  const getAllChannelDrafts = (): Record<string, DraftData> => {
    const drafts: Record<string, DraftData> = {};
    try {
      const prefix = `draft:${channelId}`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            drafts[key] = JSON.parse(value);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get channel drafts:', error);
    }
    return drafts;
  };

  /**
   * Clean up old drafts (older than 7 days)
   */
  const cleanupOldDrafts = () => {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('draft:')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const draft = JSON.parse(value);
              const timestamp = draft.timestamp || 0;
              if (timestamp < sevenDaysAgo) {
                keysToRemove.push(key);
              }
            } catch {
              // Invalid draft, remove it
              keysToRemove.push(key);
            }
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to cleanup old drafts:', error);
    }
  };

  // Cleanup old drafts on mount
  useEffect(() => {
    cleanupOldDrafts();
  }, []);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    getAllChannelDrafts,
  };
};
