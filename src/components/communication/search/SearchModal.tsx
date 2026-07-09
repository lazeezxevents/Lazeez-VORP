/**
 * SearchModal Component
 * Task 15.1: Create search interface
 * Task 15.3: Implement search result navigation
 * Requirements: 9.1, 9.5, 9.6, 9.7, 9.8
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Hash, User, Calendar, X, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/lib/utils';
import { debouncedSearch } from '../performance/debounce';
import { searchService, SearchResult, SearchFilters } from '@/services/SearchService';

// Use imported interfaces from SearchService

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage: (channelId: string, messageId: string) => void;
  onNavigateToChannel: (channelId: string) => void;
  onNavigateToUser: (userId: string) => void;
}

/**
 * SearchModal - Full-text search interface with filters
 * 
 * Features:
 * - Debounced search input (300ms)
 * - Search filters (date range, channel, sender)
 * - Result highlighting
 * - Keyboard navigation
 * - Navigate to message in context
 */
export const SearchModal = ({
  isOpen,
  onClose,
  onNavigateToMessage,
  onNavigateToChannel,
  onNavigateToUser,
}: SearchModalProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [availableChannels, setAvailableChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; fullName: string }>>([]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [channels, users] = await Promise.all([
          searchService.getAvailableChannels(),
          searchService.getAvailableUsers(),
        ]);
        setAvailableChannels(channels);
        setAvailableUsers(users);
      } catch (error) {
        console.error('[SearchModal] Failed to load filter options:', error);
      }
    };

    if (isOpen) {
      loadFilterOptions();
    }
  }, [isOpen]);

  // Perform search with debouncing
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotalResults(0);
      return;
    }

    setIsSearching(true);

    try {
      const response = await searchService.searchAll(searchQuery, searchFilters);
      setResults(response.results);
      setTotalResults(response.total);
    } catch (error) {
      console.error('[Search] Failed to search:', error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    debouncedSearch(query, (debouncedQuery) => {
      performSearch(debouncedQuery, filters);
    });
  }, [query, filters, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setFilters({});
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelectResult = (result: SearchResult) => {
    switch (result.type) {
      case 'message':
        if (result.channelId) {
          onNavigateToMessage(result.channelId, result.id);
        }
        break;
      case 'channel':
        onNavigateToChannel(result.id);
        break;
      case 'user':
        onNavigateToUser(result.id);
        break;
    }
    onClose();
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof SearchFilters]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Search messages</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for messages, channels, or people..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-y bg-accent/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filters:</span>

            {/* Channel filter */}
            <Select
              value={filters.channelId || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  channelId: value === 'all' ? undefined : value,
                }))
              }
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {availableChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User filter */}
            <Select
              value={filters.userId || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  userId: value === 'all' ? undefined : value,
                }))
              }
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <Input
              type="date"
              value={filters.fromDate || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, fromDate: e.target.value }))
              }
              className="w-[150px] h-8"
              placeholder="From date"
            />
            <Input
              type="date"
              value={filters.toDate || ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, toDate: e.target.value }))
              }
              className="w-[150px] h-8"
              placeholder="To date"
            />

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-6 pb-6">
          {isSearching ? (
            <div className="py-8 text-center text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              <p>Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-3">
                {totalResults} result{totalResults !== 1 ? 's' : ''} found
              </div>

              <AnimatePresence mode="popLayout">
                {results.map((result, index) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    isSelected={index === selectedIndex}
                    onClick={() => handleSelectResult(result)}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : query ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No results found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Start typing to search</p>
              <p className="text-sm">Search across all your messages and channels</p>
            </div>
          )}
        </ScrollArea>

        {/* Keyboard shortcuts hint */}
        <div className="px-6 py-3 border-t bg-accent/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * SearchResultItem - Individual search result
 */
interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}

const SearchResultItem = ({ result, isSelected, onClick }: SearchResultItemProps) => {
  const getIcon = () => {
    switch (result.type) {
      case 'message':
        return <Hash className="h-4 w-4" />;
      case 'channel':
        return <Hash className="h-4 w-4" />;
      case 'user':
        return <User className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-colors',
        'hover:bg-accent',
        isSelected && 'bg-accent ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 text-muted-foreground">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            {result.channelName && (
              <Badge variant="secondary" className="text-xs">
                #{result.channelName}
              </Badge>
            )}
            {result.userName && (
              <span className="text-sm font-medium">{result.userName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(result.createdAt)}
            </span>
          </div>

          {/* Content with highlighting */}
          <div
            className="text-sm text-foreground line-clamp-2"
            dangerouslySetInnerHTML={{ __html: result.highlight }}
          />
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      </div>
    </motion.button>
  );
};
