/**
 * DirectMessageChat - Real-time Chat Component
 * 
 * Features:
 * - Instant messaging (like WhatsApp)
 * - File attachments (up to 1GB)
 * - Emoji reactions
 * - Real-time updates via Supabase subscriptions
 * - Message editing and deletion
 * - Typing indicators
 * 
 * Requirements: 13.1, 13.4, 13.6, 13.8
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  X,
  Check,
  CheckCheck,
  Loader2,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Mic,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { EmojiReactions } from '../EmojiReactions';
import { MessageAttachments } from '../MessageAttachments';
import { 
  useDirectMessageMessages, 
  useSendDirectMessage,
  useEditDMMessage,
  useDeleteDMMessage,
  useAddDMReaction,
  useRemoveDMReaction,
  DirectMessageConversation,
  DirectMessage
} from '@/components/hooks/useDirectMessages';

// Common emoji set
const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🚀', '👀', '🔥', '✅', '❌', '💯', '🙏', '💪', '🤔', '👏'];

interface DirectMessageChatProps {
  conversation: DirectMessageConversation;
  currentUserId: string;
  onClose: () => void;
}

export const DirectMessageChat: React.FC<DirectMessageChatProps> = ({
  conversation,
  currentUserId,
  onClose,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const dmMessagesQuery = useDirectMessageMessages(conversation.id);
  const messages: DirectMessage[] = dmMessagesQuery.data ?? [];
  const isLoadingMessages = dmMessagesQuery.isLoading;
  const sendMessageMutation = useSendDirectMessage();
  const editMessageMutation = useEditDMMessage();
  const deleteMessageMutation = useDeleteDMMessage();
  const addReactionMutation = useAddDMReaction();
  const removeReactionMutation = useRemoveDMReaction();

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel(`dm-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_messages',
        filter: `direct_message_id=eq.${conversation.id}`,
      }, (payload) => {
        // New message received - instantly update
        console.log('New DM received:', payload);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'dm_messages',
        filter: `direct_message_id=eq.${conversation.id}`,
      }, (payload) => {
        // Message updated
        console.log('DM updated:', payload);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dm_message_reactions',
      }, (payload) => {
        // Reaction changed
        console.log('Reaction changed:', payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if ((!inputValue.trim() && selectedFiles.length === 0) || sendMessageMutation.isPending) return;

    const content = inputValue.trim();
    setInputValue('');
    
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: conversation.id,
        content: content || '(attachment)',
        attachments: selectedFiles.length > 0 ? selectedFiles : undefined,
        recipientId: conversation.otherUser.id,
      });
      setSelectedFiles([]);
    } catch (error) {
      toast.error('Failed to send message');
      setInputValue(content); // Restore on error
    }
  }, [inputValue, selectedFiles, conversation.id, conversation.otherUser.id, sendMessageMutation]);

  // Handle typing indicator
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    
    if (!isTyping) {
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Reset typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  }, [isTyping]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 1024 * 1024 * 1024; // 1GB

    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 1GB limit`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 files
  }, []);

  // Handle file removal
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle edit message
  const startEdit = useCallback((message: DirectMessage) => {
    setIsEditing(message.id);
    setEditValue(message.content);
  }, []);

  const saveEdit = useCallback(async (messageId: string) => {
    if (!editValue.trim()) return;
    
    try {
      await editMessageMutation.mutateAsync({
        messageId,
        content: editValue.trim(),
        conversationId: conversation.id,
      });
      setIsEditing(null);
      setEditValue('');
    } catch (error) {
      toast.error('Failed to edit message');
    }
  }, [editValue, conversation.id, editMessageMutation]);

  // Handle delete message
  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await deleteMessageMutation.mutateAsync({
        messageId,
        conversationId: conversation.id,
      });
    } catch (error) {
      toast.error('Failed to delete message');
    }
  }, [conversation.id, deleteMessageMutation]);

  // Handle emoji reaction
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await addReactionMutation.mutateAsync({ messageId, emoji });
    } catch (error) {
      // Reaction might already exist, try removing
      await removeReactionMutation.mutateAsync({ messageId, emoji });
    }
  }, [addReactionMutation, removeReactionMutation]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={conversation.otherUser.profilePictureUrl || undefined}
                alt={conversation.otherUser.fullName}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {conversation.otherUser.fullName?.charAt(0)?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div 
              className={cn(
                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                conversation.otherUser.presence.status === 'online' && "bg-green-500",
                conversation.otherUser.presence.status === 'away' && "bg-yellow-500",
                conversation.otherUser.presence.status === 'dnd' && "bg-red-500",
                conversation.otherUser.presence.status === 'offline' && "bg-gray-400"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold">{conversation.otherUser.fullName}</h3>
            <p className="text-xs text-muted-foreground">
              {conversation.otherUser.presence.status === 'online' 
                ? 'Online' 
                : conversation.otherUser.presence.customStatus 
                  ? conversation.otherUser.presence.customStatus
                  : conversation.otherUser.presence.status === 'dnd'
                    ? 'Do not disturb'
                    : conversation.otherUser.presence.status === 'away'
                      ? 'Away'
                      : 'Offline'}
            </p>
          </div>
        </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 lg:hidden">
            <X className="h-4 w-4" />
          </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.user_id === currentUserId;
              const showAvatar = !isOwnMessage && (
                index === 0 || messages[index - 1]?.user_id !== message.user_id
              );

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-3",
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  {showAvatar ? (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={message.user?.avatar_url || undefined} />
                      <AvatarFallback>
                        {message.user?.full_name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-8 flex-shrink-0" />
                  )}

                  {/* Message Content */}
                  <div className={cn(
                    "flex flex-col max-w-[70%]",
                    isOwnMessage ? "items-end" : "items-start"
                  )}>
                    {/* Sender name for others */}
                    {!isOwnMessage && showAvatar && (
                      <span className="text-xs text-muted-foreground mb-1">
                        {message.user?.full_name}
                      </span>
                    )}

                    {/* Message Bubble */}
                    <div className={cn(
                      "group relative px-4 py-2 rounded-2xl",
                      isOwnMessage 
                        ? "bg-primary text-primary-foreground rounded-br-none" 
                        : "bg-accent text-accent-foreground rounded-bl-none",
                      message.deleted_at && "italic opacity-50"
                    )}>
                      {/* Edit Mode */}
                      {isEditing === message.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 min-w-[200px]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(message.id);
                              if (e.key === 'Escape') {
                                setIsEditing(null);
                                setEditValue('');
                              }
                            }}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => saveEdit(message.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8"
                            onClick={() => {
                              setIsEditing(null);
                              setEditValue('');
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          {message.edited_at && (
                            <span className="text-xs opacity-70"> (edited)</span>
                          )}

                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.attachments.map((attachment) => (
                                <div 
                                  key={attachment.id}
                                  className="flex items-center gap-2 p-2 rounded bg-background/50"
                                >
                                  {attachment.file_type.startsWith('image/') ? (
                                    <ImageIcon className="w-4 h-4" />
                                  ) : attachment.file_type.startsWith('video/') ? (
                                    <Video className="w-4 h-4" />
                                  ) : (
                                    <FileIcon className="w-4 h-4" />
                                  )}
                                  <span className="text-xs truncate flex-1">
                                    {attachment.file_name}
                                  </span>
                                  <span className="text-xs opacity-70">
                                    {formatFileSize(attachment.file_size)}
                                  </span>
                                  <a 
                                    href={attachment.file_url}
                                    download
                                    className="text-xs hover:underline"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions Menu for own messages */}
                          {isOwnMessage && !message.deleted_at && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => startEdit(message)}>
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(message.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )}
                    </div>

                    {/* Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => handleReaction(message.id, reaction.emoji)}
                            className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                              "bg-accent hover:bg-accent/80 transition-colors",
                              reaction.user_ids.includes(currentUserId) && "bg-primary/20"
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp and reactions */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), 'h:mm a')}
                      </span>
                      
                      {/* Emoji Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <Smile className="w-3 h-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <div className="flex flex-wrap gap-1">
                            {COMMON_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(message.id, emoji)}
                                className="hover:bg-accent rounded p-1 transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-accent/50">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div 
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full text-sm"
              >
                <FileIcon className="w-4 h-4" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <button 
                  onClick={() => removeFile(index)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          {/* File Attachment */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || selectedFiles.length >= 10}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Voice Message */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            <Mic className="h-5 w-5" />
          </Button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-[120px] pr-10 resize-none"
              disabled={isUploading}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {isTyping && 'Typing...'}
            </span>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendMessage}
            disabled={(!inputValue.trim() && selectedFiles.length === 0) || sendMessageMutation.isPending || isUploading}
            className="h-10 w-10 p-0 flex-shrink-0"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line • Files up to 1GB
        </p>
      </div>
    </motion.div>
  );
};
