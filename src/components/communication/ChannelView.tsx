import { useEffect, useRef, useState, useMemo, Fragment } from 'react';
import { useCommunication } from '@/components/hooks/useCommunication';
import { useChannelAdmin, fetchChannelPinsBrief, useChannelPinMutations } from '@/components/hooks/useChannelAdmin';
import { useChannelMuteSet, useToggleChannelMute } from '@/components/hooks/useChannelMutes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Hash, Loader2, Lock, Pin, Settings, Bell, BellOff, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/components/lib/utils';
import { MessageComposer } from '@/components/communication/MessageComposer';
import { MessageContent } from '@/components/communication/MessageContent';
import { LinkPreviewCard } from '@/components/communication/LinkPreviewCard';
import { UnreadSeparator } from '@/components/communication/unread/UnreadBadge';
import { ChannelSettingsDialog } from '@/components/communication/channels/ChannelSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message } from '@/services/SupabaseRealtimeService';

interface ChannelViewProps {
  channelId: string;
  channelName: string;
}

type OptimisticFlags = {
  _optimistic?: boolean;
  _failed?: boolean;
};

export const ChannelView = ({ channelId, channelName }: ChannelViewProps) => {
  const { user, isAdmin: orgAdminFlag } = useAuth();
  const orgAdmin = Boolean(orgAdminFlag);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    messages,
    isLoading,
    sendMessageAsync,
    broadcastTyping,
    typingUsers,
    markAsRead,
  } = useCommunication({ channelId });

  const { data: myMembership } = useQuery({
    queryKey: ['channel-my-role', channelId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_members')
        .select('role')
        .eq('channel_id', channelId)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as { role: string };
    },
    enabled: !!channelId && !!user,
  });

  const channelPrivileged =
    myMembership?.role === 'owner' ||
    myMembership?.role === 'admin' ||
    orgAdmin;

  const canModeratePins =
    myMembership?.role === 'owner' || myMembership?.role === 'admin' || orgAdmin;

  const { data: channelMeta } = useQuery({
    queryKey: ['channel-meta', channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('is_archived, is_private')
        .eq('id', channelId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!channelId,
  });

  const archived = Boolean(channelMeta?.is_archived);

  const { data: headerPins = [], refetch: refetchPins } = useQuery({
    queryKey: ['channel-pins', channelId],
    queryFn: () => fetchChannelPinsBrief(channelId),
    enabled: !!channelId,
  });

  const pinnedSet = new Set(headerPins.map((p) => p.messageId));
  const pinActions = useChannelPinMutations(channelId);

  const admin = useChannelAdmin(channelId, settingsOpen);

  const { data: lastReadRow } = useQuery({
    queryKey: ['channel-last-read', channelId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_members')
        .select('last_read_at')
        .eq('channel_id', channelId)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as { last_read_at: string | null };
    },
    enabled: !!channelId && !!user,
  });

  const lastReadAt = lastReadRow?.last_read_at;

  const firstUnreadIndex = useMemo(() => {
    if (!lastReadAt || messages.length === 0) return -1;
    const lr = new Date(lastReadAt).getTime();
    const idx = messages.findIndex((m) => new Date(m.created_at).getTime() > lr);
    return idx;
  }, [messages, lastReadAt]);

  const { data: mutedSet } = useChannelMuteSet();
  const toggleMute = useToggleChannelMute();
  const isMuted = mutedSet?.has(channelId) ?? false;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!channelId || isLoading) return;
    const t = window.setTimeout(() => {
      void markAsRead();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [channelId, isLoading, messages.length, markAsRead]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {channelMeta?.is_private ? (
            <Lock className="w-5 h-5 text-muted-foreground shrink-0" aria-label="Private channel" />
          ) : (
            <Hash className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{channelName}</h2>
            <p className="text-xs text-muted-foreground">
              {messages.length} messages
              {archived ? ' · Archived (read only)' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {user && myMembership && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={toggleMute.isPending}
                onClick={() =>
                  toggleMute.mutate(
                    { channelId, mute: !isMuted },
                    {
                      onSuccess: () =>
                        toast.success(isMuted ? 'Channel unmuted' : 'Channel muted', {
                          description: isMuted
                            ? 'You will receive alerts for this channel again.'
                            : 'Alerts suppressed except direct mentions.',
                        }),
                      onError: () => toast.error('Could not update mute'),
                    }
                  )
                }
                title={isMuted ? 'Unmute channel' : 'Mute channel'}
              >
                {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void markAsRead()}
                title="Mark latest as read"
              >
                <CheckCheck className="w-4 h-4" />
              </Button>
            </>
          )}
          {channelPrivileged && (
            <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </Button>
          )}
        </div>
      </div>

      {headerPins.length > 0 && (
        <div className="border-b border-border px-3 py-2 flex gap-2 flex-wrap items-center bg-muted/25 flex-shrink-0">
          <Pin className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
          {headerPins.map((p) => (
            <span
              key={p.pinId}
              className="text-xs rounded-md border bg-background px-2 py-1 max-w-[240px] truncate text-muted-foreground"
              title={p.content}
            >
              {p.content || '…'}
            </span>
          ))}
        </div>
      )}

      <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Hash className="w-12 h-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg mb-1">Welcome to #{channelName}</h3>
            <p className="text-sm text-muted-foreground">This is the start of the #{channelName} channel.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, idx) => {
              const flags = message as Message & OptimisticFlags;
              const isOptimistic = flags._optimistic;
              const isFailed = flags._failed;
              const isPinned = pinnedSet.has(message.id);
              const isDeleted = Boolean(message.deleted_at);

              return (
                <Fragment key={message.id}>
                  {firstUnreadIndex >= 0 && idx === firstUnreadIndex ? <UnreadSeparator /> : null}
                  <div
                    className={cn(
                      'flex gap-2 sm:gap-3 group items-start',
                      isOptimistic && 'opacity-60',
                      isFailed && 'opacity-40'
                    )}
                  >
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={message.user?.profile_picture_url} />
                    <AvatarFallback>{message.user?.full_name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{message.user?.full_name || 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                      {message.edited_at && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                      )}
                      {isFailed && <span className="text-xs text-destructive">(failed)</span>}
                    </div>
                    <div className="mt-1">
                      <MessageContent content={message.content} currentUserId={user?.id} />
                    </div>
                    {!isDeleted ? <LinkPreviewCard rawContent={message.content} /> : null}
                    {message.attachments && message.attachments.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {message.attachments.map((att) => (
                          <li key={att.id}>
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {att.file_name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {canModeratePins && !isOptimistic && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={
                        pinActions.pinMessage.isPending || pinActions.unpinMessage.isPending
                      }
                      onClick={async () => {
                        try {
                          if (isPinned) {
                            await pinActions.unpinMessage.mutateAsync(message.id);
                            toast.success('Pin removed');
                          } else {
                            if (headerPins.length >= 10) {
                              toast.error('Pin limit reached', {
                                description: 'Maximum 10 pins per channel.',
                              });
                              return;
                            }
                            await pinActions.pinMessage.mutateAsync(message.id);
                            toast.success('Message pinned');
                          }
                          void refetchPins();
                        } catch (e) {
                          toast.error('Could not update pin', {
                            description: e instanceof Error ? e.message : 'Try again',
                          });
                        }
                      }}
                    >
                      {isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                </div>
                </Fragment>
              );
            })}

            {typingUsers.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.length} people are typing...`}
                </span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border flex-shrink-0 p-2 bg-background">
        {archived ? (
          <p className="text-sm text-muted-foreground text-center py-3 px-2">
            This channel is archived. You can read messages but cannot send new ones.
          </p>
        ) : (
          <MessageComposer
            channelId={channelId}
            channelName={channelName}
            placeholder={`Message #${channelName}`}
            onTypingStart={() => broadcastTyping(true)}
            onTypingStop={() => broadcastTyping(false)}
            onSendMessage={async (content, files) => {
              await sendMessageAsync({
                content,
                threadParentId: undefined,
                attachments: files.length > 0 ? files : undefined,
              });
            }}
          />
        )}
      </div>

      {settingsOpen &&
        user &&
        (admin.bundle ? (
          <ChannelSettingsDialog
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            channel={admin.bundle.channel}
            members={admin.bundle.members}
            pinnedMessages={admin.bundle.pinnedMessages}
            currentUserId={user.id}
            isAdmin={
              myMembership?.role === 'owner' ||
              myMembership?.role === 'admin' ||
              orgAdmin
            }
            isOrgAdmin={orgAdmin}
            onUpdateChannel={async (updates) => {
              await admin.updateChannel.mutateAsync({
                name: updates.name,
                description: updates.description,
                purpose: updates.purpose,
                isPrivate: updates.isPrivate,
              });
              toast.success('Channel updated');
            }}
            onAddMember={async (userId) => {
              await admin.addMember.mutateAsync({
                userId,
                isPrivate: admin.bundle!.channel.isPrivate,
                channelName: admin.bundle!.channel.name,
              });
              toast.success('Member added');
            }}
            onRemoveMember={async (memberId) => {
              await admin.removeMember.mutateAsync(memberId);
              toast.success('Member removed');
            }}
            onTransferOwnership={async (newOwnerId) => {
              await admin.transferOwnership.mutateAsync(newOwnerId);
              toast.success('Ownership transferred');
            }}
            onArchiveChannel={async () => {
              await admin.setArchived.mutateAsync(true);
              toast.success('Channel archived');
            }}
            onUnarchiveChannel={async () => {
              await admin.setArchived.mutateAsync(false);
              toast.success('Channel unarchived');
            }}
            onPinMessage={async (messageId) => {
              const count = admin.bundle?.pinnedMessages.length ?? 0;
              if (count >= 10) {
                toast.error('Pin limit reached', { description: 'Maximum 10 pins per channel.' });
                return;
              }
              await admin.pinMessage.mutateAsync(messageId);
              toast.success('Message pinned');
            }}
            onUnpinMessage={async (messageId) => {
              await admin.unpinMessage.mutateAsync(messageId);
              toast.success('Pin removed');
            }}
          />
        ) : admin.isFetching ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setSettingsOpen(false);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">Loading channel settings…</p>
              </div>
            </DialogContent>
          </Dialog>
        ) : admin.isError ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setSettingsOpen(false);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Could not load settings</DialogTitle>
                <DialogDescription>
                  {admin.error instanceof Error ? admin.error.message : 'Please try again.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                  Close
                </Button>
                <Button type="button" onClick={() => void admin.refetch()}>
                  Retry
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : null)}
    </div>
  );
};
