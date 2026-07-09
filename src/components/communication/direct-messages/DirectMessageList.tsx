/**
 * DirectMessageList Component
 * Task 17.1: Implement direct message infrastructure
 * Task 17.2: Implement direct message features
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.8
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/components/lib/utils';
import { PresenceBadge } from '../presence/PresenceStatusSelector';
import { PresenceStatus } from '../presence/PresenceManager';

interface DirectMessageConversation {
  id: string;
  otherUser: {
    id: string;
    fullName: string;
    profilePictureUrl?: string;
    presence: {
      status: PresenceStatus;
      customStatus?: string;
    };
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    isRead: boolean;
  };
  unreadCount: number;
}

interface DirectMessageListProps {
  conversations: DirectMessageConversation[];
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  isLoading?: boolean;
}

/**
 * DirectMessageList - List of direct message conversations
 * 
 * Features:
 * - Display conversations with last message
 * - Unread count badges
 * - User presence indicators
 * - Search conversations
 * - Create new conversation
 */
export const DirectMessageList = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  isLoading = false,
}: DirectMessageListProps) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Direct messages</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onCreateConversation}
            aria-label="New direct message"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            // Loading skeleton
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-accent/50 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="space-y-1"
            >
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={activeConversationId === conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  variants={itemVariants}
                />
              ))}
            </motion.div>
          ) : (
            // Empty state
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-sm">
                {searchQuery ? 'No conversations found' : 'No direct messages yet'}
              </p>
              <p className="text-xs">
                {searchQuery ? 'Try a different search' : 'Start a conversation with a colleague'}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCreateConversation}
                  className="mt-3"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New message
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * ConversationItem - Individual conversation list item
 */
interface ConversationItemProps {
  conversation: DirectMessageConversation;
  isActive: boolean;
  onClick: () => void;
  variants: any;
}

const ConversationItem = ({
  conversation,
  isActive,
  onClick,
  variants,
}: ConversationItemProps) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  return (
    <motion.button
      variants={variants}
      onClick={onClick}
      whileHover={{ x: 2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
        'hover:bg-accent/50',
        isActive && 'bg-accent'
      )}
    >
      {/* Avatar with presence */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={conversation.otherUser.profilePictureUrl || undefined}
            alt={conversation.otherUser.fullName}
          />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {conversation.otherUser.fullName?.charAt(0)?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-0.5 -right-0.5">
          <PresenceBadge status={conversation.otherUser.presence.status} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn(
            'font-medium text-sm truncate',
            conversation.unreadCount > 0 && 'font-semibold'
          )}>
            {conversation.otherUser.fullName}
          </span>
          {conversation.lastMessage && (
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {formatTime(conversation.lastMessage.createdAt)}
            </span>
          )}
        </div>

        {/* Custom status or last message */}
        {conversation.otherUser.presence.customStatus ? (
          <p className="text-xs text-muted-foreground truncate">
            {conversation.otherUser.presence.customStatus}
          </p>
        ) : conversation.lastMessage ? (
          <p className={cn(
            'text-xs truncate',
            conversation.unreadCount > 0
              ? 'text-foreground font-medium'
              : 'text-muted-foreground'
          )}>
            {conversation.lastMessage.content}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No messages yet</p>
        )}
      </div>

      {/* Unread badge */}
      {conversation.unreadCount > 0 && (
        <Badge
          variant="default"
          className="h-5 min-w-[20px] px-1.5 text-xs font-medium bg-primary text-primary-foreground flex-shrink-0"
        >
          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
        </Badge>
      )}
    </motion.button>
  );
};
