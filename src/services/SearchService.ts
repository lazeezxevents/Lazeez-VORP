/**
 * Search Service
 * Task 15.2: Implement search backend integration
 * Requirements: 9.2, 9.3, 9.4, 9.8
 */

import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  type: 'message' | 'channel' | 'user';
  channelId?: string;
  channelName?: string;
  userId?: string;
  userName?: string;
  content: string;
  highlight: string;
  createdAt: string;
}

export interface SearchFilters {
  channelId?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

/**
 * SearchService - Handles full-text search across messages, channels, and users
 */
export class SearchService {
  /**
   * Search messages with full-text search and filters
   */
  static async searchMessages(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchResponse> {
    try {
      // Build search query with filters
      let searchQuery = supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          channel_id,
          user_id,
          channels!inner(
            id,
            name
          ),
          profiles!inner(
            id,
            full_name
          )
        `, { count: 'exact' });

      // Apply text search
      if (query.trim()) {
        searchQuery = searchQuery.textSearch('content', query);
      }

      // Apply filters
      if (filters.channelId) {
        searchQuery = searchQuery.eq('channel_id', filters.channelId);
      }

      if (filters.userId) {
        searchQuery = searchQuery.eq('user_id', filters.userId);
      }

      if (filters.fromDate) {
        searchQuery = searchQuery.gte('created_at', filters.fromDate);
      }

      if (filters.toDate) {
        searchQuery = searchQuery.lte('created_at', filters.toDate + 'T23:59:59');
      }

      // Order and paginate
      searchQuery = searchQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await searchQuery;

      if (error) {
        console.error('[SearchService] Message search failed:', error);
        throw error;
      }

      // Transform results with highlighting
      const results: SearchResult[] = (data || []).map((message) => ({
        id: message.id,
        type: 'message' as const,
        channelId: message.channel_id,
        channelName: message.channels?.name,
        userId: message.user_id,
        userName: message.profiles?.full_name,
        content: message.content,
        highlight: this.highlightText(message.content, query),
        createdAt: message.created_at,
      }));

      return {
        results,
        total: count || 0,
        hasMore: results.length === limit,
      };
    } catch (error) {
      console.error('[SearchService] Search error:', error);
      throw error;
    }
  }

  /**
   * Search channels by name and description
   */
  static async searchChannels(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select(`
          id,
          name,
          description,
          created_at,
          departments!inner(
            id,
            name
          )
        `)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('name')
        .limit(limit);

      if (error) {
        console.error('[SearchService] Channel search failed:', error);
        throw error;
      }

      const results: SearchResult[] = (data || []).map((channel) => ({
        id: channel.id,
        type: 'channel' as const,
        channelName: channel.name,
        content: channel.description || channel.name,
        highlight: this.highlightText(channel.description || channel.name, query),
        createdAt: channel.created_at,
      }));

      return {
        results,
        total: results.length,
        hasMore: false,
      };
    } catch (error) {
      console.error('[SearchService] Channel search error:', error);
      throw error;
    }
  }

  /**
   * Search users by name and email
   */
  static async searchUsers(
    query: string,
    limit: number = 20
  ): Promise<SearchResponse> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          created_at
        `)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('full_name')
        .limit(limit);

      if (error) {
        console.error('[SearchService] User search failed:', error);
        throw error;
      }

      const results: SearchResult[] = (data || []).map((user) => ({
        id: user.id,
        type: 'user' as const,
        userName: user.full_name,
        content: `${user.full_name} (${user.email})`,
        highlight: this.highlightText(`${user.full_name} (${user.email})`, query),
        createdAt: user.created_at,
      }));

      return {
        results,
        total: results.length,
        hasMore: false,
      };
    } catch (error) {
      console.error('[SearchService] User search error:', error);
      throw error;
    }
  }

  /**
   * Combined search across all entity types
   */
  static async searchAll(
    query: string,
    filters: SearchFilters = {},
    limit: number = 50
  ): Promise<SearchResponse> {
    try {
      // Search messages, channels, and users in parallel
      const [messageResults, channelResults, userResults] = await Promise.all([
        this.searchMessages(query, filters, Math.floor(limit * 0.7), 0),
        this.searchChannels(query, Math.floor(limit * 0.2)),
        this.searchUsers(query, Math.floor(limit * 0.1)),
      ]);

      // Combine and sort by relevance (messages first, then channels, then users)
      const allResults = [
        ...messageResults.results,
        ...channelResults.results,
        ...userResults.results,
      ];

      return {
        results: allResults.slice(0, limit),
        total: messageResults.total + channelResults.total + userResults.total,
        hasMore: messageResults.hasMore,
      };
    } catch (error) {
      console.error('[SearchService] Combined search error:', error);
      throw error;
    }
  }

  /**
   * Get available channels for filter dropdown
   */
  static async getAvailableChannels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select(`
          channels!inner(
            id,
            name
          )
        `)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('[SearchService] Get channels failed:', error);
        return [];
      }

      return (data || []).map((member) => member.channels);
    } catch (error) {
      console.error('[SearchService] Get channels error:', error);
      return [];
    }
  }

  /**
   * Get available users for filter dropdown
   */
  static async getAvailableUsers(): Promise<Array<{ id: string; fullName: string }>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name')
        .limit(100);

      if (error) {
        console.error('[SearchService] Get users failed:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SearchService] Get users error:', error);
      return [];
    }
  }

  /**
   * Highlight search terms in text
   */
  private static highlightText(text: string, query: string): string {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );

    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900">$1</mark>');
  }
}

export const searchService = SearchService;
