/**
 * DirectMessageView - Complete Direct Messaging Container
 * 
 * Fully functional DM system with:
 * - Real-time messaging (instant like WhatsApp)
 * - Conversation list sidebar
 * - Chat view with message composer
 * - File attachments (up to 1GB)
 * - Emoji reactions
 * - User search and new conversations
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 13.8
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/components/lib/utils';
import { DirectMessageList } from './DirectMessageList';
import { DirectMessageChat } from './DirectMessageChat';
import { 
  useDirectMessages, 
  useCreateDirectMessage, 
  useSearchUsers,
  DirectMessageConversation 
} from '@/components/hooks/useDirectMessages';

export const DirectMessageView: React.FC = () => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations, error } = useDirectMessages();
  const createConversationMutation = useCreateDirectMessage();
  const { data: searchResults = [], isLoading: isSearching } = useSearchUsers(searchQuery);

  // Get selected conversation details
  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  // Handle creating new conversation
  const handleCreateConversation = useCallback(async (recipientId: string) => {
    if (!user) {
      toast.error('Please sign in to start a conversation');
      return;
    }

    if (recipientId === user.id) {
      toast.error('Cannot create conversation with yourself');
      return;
    }

    try {
      const conversationId = await createConversationMutation.mutateAsync({ recipientId });
      setSelectedConversationId(conversationId);
      setIsNewConversationDialogOpen(false);
      setSearchQuery('');
      toast.success('Conversation created');
    } catch (err) {
      toast.error('Failed to create conversation');
    }
  }, [user, createConversationMutation]);

  // Handle starting new conversation flow
  const handleStartNewConversation = useCallback(() => {
    setIsNewConversationDialogOpen(true);
    setSearchQuery('');
  }, []);

  // Transform conversations for the list component
  const listConversations = conversations.map(conv => ({
    id: conv.id,
    otherUser: {
      id: conv.otherUser.id,
      fullName: conv.otherUser.fullName,
      profilePictureUrl: conv.otherUser.profilePictureUrl || undefined,
      presence: conv.otherUser.presence,
    },
    lastMessage: conv.lastMessage ? {
      content: conv.lastMessage.content,
      createdAt: conv.lastMessage.createdAt,
      isRead: conv.lastMessage.isRead,
    } : undefined,
    unreadCount: conv.unreadCount,
  }));

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load conversations</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-border flex-shrink-0">
        <DirectMessageList
          conversations={listConversations}
          activeConversationId={selectedConversationId || undefined}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={handleStartNewConversation}
          isLoading={isLoadingConversations}
        />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {selectedConversation ? (
            <DirectMessageChat
              key={selectedConversation.id}
              conversation={selectedConversation}
              currentUserId={user?.id || ''}
              onClose={() => setSelectedConversationId(null)}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a conversation from the sidebar or start a new one
                </p>
                <Button onClick={handleStartNewConversation}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  New Message
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationDialogOpen} onOpenChange={setIsNewConversationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Direct Message</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Input
                placeholder="Search users by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
              )}
            </div>

            <ScrollArea className="h-64">
              {searchQuery.length < 2 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Type at least 2 characters to search
                </p>
              ) : searchResults.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No users found
                </p>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((foundUser) => (
                    <button
                      key={foundUser.id}
                      onClick={() => handleCreateConversation(foundUser.id)}
                      disabled={createConversationMutation.isPending}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        "hover:bg-accent/50",
                        createConversationMutation.isPending && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src={foundUser.avatar_url || undefined}
                          alt={foundUser.full_name || 'Unknown'}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {foundUser.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-sm truncate">
                          {foundUser.full_name || 'Unknown User'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {foundUser.email}
                        </p>
                      </div>
                      {conversations.some(c => c.otherUser.id === foundUser.id) && (
                        <Badge variant="secondary" className="text-xs">
                          Existing
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
