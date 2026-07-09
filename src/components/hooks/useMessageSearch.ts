import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/components/utils/debounce';
import { Message } from '@/services/SupabaseRealtimeService';

interface SearchFilters {
  channelId?: string;
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface SearchResult extends Message {
  channel_name?: string;
  highlight?: string;
}

/**
 * Hook for searching messages with debouncing (300ms)
 * Implements full-text search across message content
 */
export const useMessageSearch = (initialQuery: string = '', filters?: SearchFilters) => {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);

  // Search messages
  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ['message-search', debouncedQuery, filters],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return [];
      }

      let queryBuilder = supabase
        .from('messages')
        .select(`
          *,
          user:profiles!messages_user_id_fkey(
            id,
            full_name,
            profile_picture_url,
            main_role,
            designation
          ),
          channel:channels!messages_channel_id_fkey(
            id,
            name
          )
        `)
        .textSearch('search_vector', debouncedQuery, {
          type: 'websearch',
          config: 'english',
        })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply filters
      if (filters?.channelId) {
        queryBuilder = queryBuilder.eq('channel_id', filters.channelId);
      }

      if (filters?.senderId) {
        queryBuilder = queryBuilder.eq('user_id', filters.senderId);
      }

      if (filters?.dateFrom) {
        queryBuilder = queryBuilder.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        queryBuilder = queryBuilder.lte('created_at', filters.dateTo);
      }

      // Check user has access to channels
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: memberChannels } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      const accessibleChannelIds = memberChannels?.map((m) => m.channel_id) || [];

      if (accessibleChannelIds.length === 0) {
        return [];
      }

      queryBuilder = queryBuilder.in('channel_id', accessibleChannelIds);

      const { data, error: searchError } = await queryBuilder;

      if (searchError) {
        console.error('Search error:', searchError);
        throw searchError;
      }

      // Add highlights
      return (data || []).map((message: any) => ({
        ...message,
        channel_name: message.channel?.name,
        highlight: highlightSearchTerms(message.content, debouncedQuery),
      })) as SearchResult[];
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 30000, // 30 seconds
  });

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    isSearching: query !== debouncedQuery, // True while debouncing
  };
};

/**
 * Highlight search terms in content
 */
function highlightSearchTerms(content: string, searchQuery: string): string {
  if (!searchQuery.trim()) return content;

  const terms = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  let highlighted = content;

  terms.forEach((term) => {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
