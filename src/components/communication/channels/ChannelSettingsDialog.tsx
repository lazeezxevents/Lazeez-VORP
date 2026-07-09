/**
 * ChannelSettingsDialog Component
 * Task 18.2: Implement channel settings
 * Task 18.3: Implement private channels
 * Task 18.4: Implement channel archiving
 * Task 18.5: Implement pinned messages
 * Requirements: 14.2-14.7, 15.1-15.7, 26.1-26.6, 26.9-26.11
 */

import { useState } from 'react';
import {
  Settings,
  Lock,
  Archive,
  Pin,
  Crown,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddChannelMemberDialog } from '@/components/communication/channels/AddChannelMemberDialog';

interface Channel {
  id: string;
  name: string;
  description?: string;
  purpose?: string;
  isPrivate: boolean;
  isArchived: boolean;
  createdBy: string;
}

interface ChannelMember {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface PinnedMessage {
  id: string;
  /** messages.id — used for unpin RPC / delete by message_id */
  messageId: string;
  content: string;
  userName: string;
  createdAt: string;
  pinnedBy: string;
  pinnedAt: string;
}

interface ChannelSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  members: ChannelMember[];
  pinnedMessages: PinnedMessage[];
  currentUserId: string;
  /** Channel roles (owner/admin) from channel_members.role */
  isAdmin: boolean;
  /** Organization admin (main_role) — archive/unarchive per policy */
  isOrgAdmin: boolean;
  onUpdateChannel: (updates: Partial<Channel>) => Promise<void>;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onTransferOwnership: (newOwnerId: string) => Promise<void>;
  onArchiveChannel: () => Promise<void>;
  onUnarchiveChannel: () => Promise<void>;
  onPinMessage: (messageId: string) => Promise<void>;
  onUnpinMessage: (messageId: string) => Promise<void>;
}

/**
 * ChannelSettingsDialog - Comprehensive channel management interface
 */
export const ChannelSettingsDialog = ({
  isOpen,
  onClose,
  channel,
  members,
  pinnedMessages,
  currentUserId,
  isAdmin,
  isOrgAdmin,
  onUpdateChannel,
  onAddMember,
  onRemoveMember,
  onTransferOwnership,
  onArchiveChannel,
  onUnarchiveChannel,
  onPinMessage,
  onUnpinMessage,
}: ChannelSettingsDialogProps) => {
  const [activeTab, setActiveTab] = useState('general');
  const [channelName, setChannelName] = useState(channel.name);
  const [channelDescription, setChannelDescription] = useState(channel.description || '');
  const [channelPurpose, setChannelPurpose] = useState(channel.purpose || '');
  const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showRemoveMemberConfirm, setShowRemoveMemberConfirm] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<ChannelMember | null>(null);

  const currentUserMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentUserMember?.role === 'owner';
  const canEdit = isOwner || isAdmin;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await onUpdateChannel({
        name: channelName,
        description: channelDescription,
        purpose: channelPurpose,
        isPrivate,
      });
      onClose();
    } catch (error) {
      console.error('[Channel Settings] Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    try {
      if (channel.isArchived) {
        await onUnarchiveChannel();
      } else {
        await onArchiveChannel();
      }
      setShowArchiveConfirm(false);
      onClose();
    } catch (error) {
      console.error('[Channel Settings] Failed to archive/unarchive:', error);
    }
  };

  return (
    <>
      <AddChannelMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        channelId={channel.id}
        channelName={channel.name}
        isPrivate={channel.isPrivate}
        excludeUserIds={members.map((m) => m.userId)}
        onAdded={(userId) => onAddMember(userId)}
      />

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] p-0" key={channel.id}>
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Channel settings
            </DialogTitle>
            <DialogDescription>
              Manage #{channel.name} settings and members
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <div className="px-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="members">
                  Members ({members.length})
                </TabsTrigger>
                <TabsTrigger value="pinned">
                  Pinned ({pinnedMessages.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 px-6 py-4">
              {/* General Settings */}
              <TabsContent value="general" className="space-y-4 mt-0">
                <div className="space-y-4">
                  {/* Channel name */}
                  <div>
                    <Label htmlFor="channel-name">Channel name</Label>
                    <Input
                      id="channel-name"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      disabled={!canEdit}
                      maxLength={100}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="channel-description">Description</Label>
                    <Textarea
                      id="channel-description"
                      value={channelDescription}
                      onChange={(e) => setChannelDescription(e.target.value)}
                      disabled={!canEdit}
                      rows={3}
                      placeholder="What is this channel about?"
                    />
                  </div>

                  {/* Purpose */}
                  <div>
                    <Label htmlFor="channel-purpose">Purpose</Label>
                    <Input
                      id="channel-purpose"
                      value={channelPurpose}
                      onChange={(e) => setChannelPurpose(e.target.value)}
                      disabled={!canEdit}
                      placeholder="e.g., Project updates, Team discussions"
                    />
                  </div>

                  {/* Private channel toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Private channel</p>
                        <p className="text-sm text-muted-foreground">
                          Only invited members can access
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isPrivate}
                      onCheckedChange={setIsPrivate}
                      disabled={!canEdit}
                    />
                  </div>

                  {/* Archive channel */}
                  {canEdit && isOrgAdmin && (
                    <div className="pt-4 border-t">
                      <Button
                        variant={channel.isArchived ? 'default' : 'destructive'}
                        onClick={() => setShowArchiveConfirm(true)}
                        className="w-full"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {channel.isArchived ? 'Unarchive channel' : 'Archive channel'}
                      </Button>
                      {!channel.isArchived && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Archived channels are read-only but preserve message history
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Members */}
              <TabsContent value="members" className="space-y-4 mt-0">
                {canEdit && (
                  <Button type="button" onClick={() => setAddMemberOpen(true)} className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add members
                  </Button>
                )}

                <div className="space-y-2">
                  {members.map((member) => (
                    <MemberItem
                      key={member.id}
                      member={member}
                      canManage={canEdit && member.userId !== currentUserId}
                      onRemove={() => setShowRemoveMemberConfirm(member.id)}
                      onTransferOwnership={() => setTransferTarget(member)}
                      showTransferOwnership={isOwner && member.userId !== currentUserId}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* Pinned Messages */}
              <TabsContent value="pinned" className="space-y-4 mt-0">
                {pinnedMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Pin className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No pinned messages</p>
                    <p className="text-sm">Pin important messages to keep them accessible</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pinnedMessages.map((message) => (
                      <PinnedMessageItem
                        key={message.id}
                        message={message}
                        canUnpin={canEdit}
                        onUnpin={() => onUnpinMessage(message.messageId)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {activeTab === 'general' && canEdit && (
            <DialogFooter className="p-6 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {channel.isArchived ? 'Unarchive channel?' : 'Archive channel?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {channel.isArchived
                ? 'This will restore the channel and allow new messages.'
                : 'This will prevent new messages but preserve message history. You can unarchive it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              {channel.isArchived ? 'Unarchive' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={showRemoveMemberConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setShowRemoveMemberConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This member will no longer have access to this channel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (showRemoveMemberConfirm) {
                  onRemoveMember(showRemoveMemberConfirm);
                  setShowRemoveMemberConfirm(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={transferTarget !== null}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              {transferTarget
                ? `${transferTarget.userName} will become the channel owner. You will be set to admin.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (transferTarget) {
                  void onTransferOwnership(transferTarget.userId);
                }
                setTransferTarget(null);
              }}
            >
              Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/**
 * MemberItem - Individual member in the list
 */
interface MemberItemProps {
  member: ChannelMember;
  canManage: boolean;
  onRemove: () => void;
  onTransferOwnership: () => void;
  showTransferOwnership: boolean;
}

const MemberItem = ({
  member,
  canManage,
  onRemove,
  onTransferOwnership,
  showTransferOwnership,
}: MemberItemProps) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.userAvatar} alt={member.userName} />
          <AvatarFallback>{member.userName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{member.userName}</span>
            {member.role === 'owner' && (
              <Badge variant="secondary" className="text-xs">
                <Crown className="h-3 w-3 mr-1" />
                Owner
              </Badge>
            )}
            {member.role === 'admin' && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {showTransferOwnership && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTransferOwnership}
            >
              <Crown className="h-4 w-4 mr-1" />
              Make owner
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * PinnedMessageItem - Individual pinned message
 */
interface PinnedMessageItemProps {
  message: PinnedMessage;
  canUnpin: boolean;
  onUnpin: () => void;
}

const PinnedMessageItem = ({ message, canUnpin, onUnpin }: PinnedMessageItemProps) => {
  return (
    <div className="p-3 border rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{message.userName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(message.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-foreground line-clamp-2">{message.content}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Pinned by {message.pinnedBy} on {new Date(message.pinnedAt).toLocaleDateString()}
          </p>
        </div>

        {canUnpin && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onUnpin}
            className="h-8 w-8 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
