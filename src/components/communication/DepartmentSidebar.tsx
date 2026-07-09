import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Hash, Plus, ChevronDown, ChevronRight, Lock, Users, Settings, Trash2, MoreVertical, CheckCheck, BellOff, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateDepartmentDialog } from './CreateDepartmentDialog';
import { CreateChannelDialog } from './CreateChannelDialog';
import { DeleteDepartmentDialog } from './DeleteDepartmentDialog';
import { UnreadBadge } from './unread/UnreadBadge';
import { unreadTracker } from './unread/UnreadTracker';
import { useUnreadTracking } from '@/components/hooks/useUnreadTracking';
import { useMutedChannels } from '@/hooks/useMutedChannels';
import { cn } from '@/components/lib/utils';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Channel {
  id: string;
  department_id: string;
  name: string;
  description: string;
  is_private: boolean;
  is_archived: boolean;
  member_count?: number;
  unread_count?: number;
}

export const DepartmentSidebar = ({ 
  onChannelSelect 
}: { 
  onChannelSelect: (channelId: string, channelName: string) => void 
}) => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState<string | null>(null);
  const [deleteDept, setDeleteDept] = useState<{ id: string; name: string; channelCount: number } | null>(null);

  const isAdmin = hasPermission('admin');

  // Get unread tracking data
  const { unreadMap, totalUnread, getUnreadCount, hasUnread: hasChannelUnread } = useUnreadTracking();

  // Get muted channels data
  const { isChannelMuted, toggleMute, isMuting, isUnmuting } = useMutedChannels(user?.id || '');

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user || totalUnread === 0) return;
    
    try {
      await unreadTracker.markAllAsRead(user.id);
      
      // Invalidate all unread-related queries to trigger UI updates
      await queryClient.invalidateQueries({ queryKey: ['channel-unread-map'] });
      await queryClient.invalidateQueries({ queryKey: ['channel-last-read'] });
      
      toast.success('All channels marked as read', {
        description: `Marked ${totalUnread} messages as read`,
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read', {
        description: 'Please try again',
      });
    }
  };

  // Fetch departments (excluding General)
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .neq('name', 'General')
        .order('name');
      
      if (error) throw error;
      return data as Department[];
    },
  });

  // Fetch all channels
  const { data: allChannels = [], isLoading: loadingChannels } = useQuery({
    queryKey: ['channels', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          channel_members!inner(user_id)
        `)
        .eq('channel_members.user_id', user.id)
        .eq('is_archived', false)
        .order('name');
      
      if (error) throw error;
      return data as Channel[];
    },
    enabled: !!user,
  });

  // Separate general channel from department channels
  const generalChannel = allChannels.find(c => c.name === 'general');
  const departmentChannels = allChannels.filter(c => c.name !== 'general');

  // Sort channels: unread first, then alphabetically
  const sortedDepartmentChannels = useMemo(() => {
    return [...departmentChannels].sort((a, b) => {
      const aUnread = getUnreadCount(a.id);
      const bUnread = getUnreadCount(b.id);
      
      // Channels with unread messages come first
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      
      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [departmentChannels, getUnreadCount]);

  const toggleDepartment = (deptId: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const handleChannelClick = (channelId: string, channelName: string) => {
    setSelectedChannel(channelId);
    onChannelSelect(channelId, channelName);
  };

  const getChannelsForDept = (deptId: string) => {
    const channels = sortedDepartmentChannels.filter(c => c.department_id === deptId);
    
    // Sort channels within department: unread first
    return channels.sort((a, b) => {
      const aUnread = getUnreadCount(a.id);
      const bUnread = getUnreadCount(b.id);
      
      if (aUnread > 0 && bUnread === 0) return -1;
      if (aUnread === 0 && bUnread > 0) return 1;
      
      return a.name.localeCompare(b.name);
    });
  };

  const handleDeleteDept = (dept: Department) => {
    const channelCount = getChannelsForDept(dept.id).length;
    setDeleteDept({ id: dept.id, name: dept.name, channelCount });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-lg">Communication</h2>
        <div className="flex items-center gap-1">
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMarkAllAsRead}
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreateDept(true)}
              title="Create Department"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Channels List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Universal General Channel */}
          {generalChannel && (
            <div className="mb-4">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                Universal
              </div>
              <div className="flex items-center gap-1 group">
                <Button
                  variant={selectedChannel === generalChannel.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'flex-1 justify-start text-sm',
                    selectedChannel === generalChannel.id && 'bg-accent',
                    hasChannelUnread(generalChannel.id) && 'font-semibold',
                    isChannelMuted(generalChannel.id) && 'opacity-60'
                  )}
                  onClick={() => handleChannelClick(generalChannel.id, generalChannel.name)}
                >
                  <Hash className="w-3 h-3 mr-2" />
                  {generalChannel.name}
                  {isChannelMuted(generalChannel.id) && (
                    <BellOff className="w-3 h-3 ml-1 text-muted-foreground" />
                  )}
                  {hasChannelUnread(generalChannel.id) && (
                    <div className="ml-auto">
                      <UnreadBadge count={getUnreadCount(generalChannel.id)} />
                    </div>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => toggleMute(generalChannel.id)}
                      disabled={isMuting || isUnmuting}
                    >
                      {isChannelMuted(generalChannel.id) ? (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Unmute channel
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 mr-2" />
                          Mute channel
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* Departments Section */}
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
            Departments
          </div>

          {loadingDepts ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading departments...
            </div>
          ) : departments.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {isAdmin ? (
                <>
                  <p className="mb-2">No departments yet</p>
                  <Button size="sm" onClick={() => setShowCreateDept(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Department
                  </Button>
                </>
              ) : (
                <p>No departments available</p>
              )}
            </div>
          ) : (
            departments.map((dept) => {
              const deptChannels = getChannelsForDept(dept.id);
              const isExpanded = expandedDepts.has(dept.id);

              return (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Department Header */}
                  <div className="flex items-center gap-1 group">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start font-medium"
                      onClick={() => toggleDepartment(dept.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 mr-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 mr-1" />
                      )}
                      {dept.name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {deptChannels.length}
                      </span>
                    </Button>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setShowCreateChannel(dept.id)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Channel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteDept(dept)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Department
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Channels */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="ml-3 space-y-0.5"
                    >
                      {loadingChannels ? (
                        <div className="py-2 px-3 text-xs text-muted-foreground">
                          Loading channels...
                        </div>
                      ) : deptChannels.length === 0 ? (
                        <div className="py-2 px-3 text-xs text-muted-foreground">
                          {isAdmin ? (
                            <button
                              onClick={() => setShowCreateChannel(dept.id)}
                              className="hover:underline"
                            >
                              + Create first channel
                            </button>
                          ) : (
                            'No channels'
                          )}
                        </div>
                      ) : (
                        deptChannels.map((channel) => {
                          const channelUnreadCount = getUnreadCount(channel.id);
                          const channelHasUnread = hasChannelUnread(channel.id);
                          const isMuted = isChannelMuted(channel.id);
                          
                          return (
                            <div key={channel.id} className="flex items-center gap-1 group">
                              <Button
                                variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                  'flex-1 justify-start text-sm',
                                  selectedChannel === channel.id && 'bg-accent',
                                  channelHasUnread && 'font-semibold',
                                  isMuted && 'opacity-60'
                                )}
                                onClick={() => handleChannelClick(channel.id, channel.name)}
                              >
                                {channel.is_private ? (
                                  <Lock className="w-3 h-3 mr-2" />
                                ) : (
                                  <Hash className="w-3 h-3 mr-2" />
                                )}
                                {channel.name}
                                {isMuted && (
                                  <BellOff className="w-3 h-3 ml-1 text-muted-foreground" />
                                )}
                                {channelHasUnread && (
                                  <div className="ml-auto">
                                    <UnreadBadge count={channelUnreadCount} />
                                  </div>
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => toggleMute(channel.id)}
                                    disabled={isMuting || isUnmuting}
                                  >
                                    {isMuted ? (
                                      <>
                                        <Bell className="w-4 h-4 mr-2" />
                                        Unmute channel
                                      </>
                                    ) : (
                                      <>
                                        <BellOff className="w-4 h-4 mr-2" />
                                        Mute channel
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Users className="w-4 h-4 mr-2" />
          Direct Messages
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <CreateDepartmentDialog
            open={showCreateDept}
            onOpenChange={setShowCreateDept}
          />
          {showCreateChannel && (
            <CreateChannelDialog
              open={!!showCreateChannel}
              onOpenChange={(open) => !open && setShowCreateChannel(null)}
              departmentId={showCreateChannel}
            />
          )}
          {deleteDept && (
            <DeleteDepartmentDialog
              open={!!deleteDept}
              onOpenChange={(open) => !open && setDeleteDept(null)}
              departmentId={deleteDept.id}
              departmentName={deleteDept.name}
              channelCount={deleteDept.channelCount}
            />
          )}
        </>
      )}
    </div>
  );
};
