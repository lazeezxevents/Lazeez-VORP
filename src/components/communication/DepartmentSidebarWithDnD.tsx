import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Hash, Plus, ChevronDown, ChevronRight, Lock, Users, Settings, Trash2, MoreVertical, GripVertical, Archive, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreateDepartmentDialog } from './CreateDepartmentDialog';
import { CreateChannelDialog } from './CreateChannelDialog';
import { DeleteDepartmentDialog } from './DeleteDepartmentDialog';
import { cn } from '@/components/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCommunicationPermissions } from '@/components/hooks/useCommunicationPermissions';
import { useChannelUnreadMapQuery } from '@/components/hooks/useChannelUnreadMapQuery';
import { useChannelMuteSet } from '@/components/hooks/useChannelMutes';

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

interface UserPreferences {
  department_order: string[];
  enable_department_reordering: boolean;
}

// Sortable Department Item
const SortableDepartmentItem = ({
  dept,
  channels,
  isExpanded,
  selectedChannel,
  isAdmin,
  canCreateChannel,
  enableReordering,
  mutedChannelIds,
  onToggle,
  onChannelClick,
  onCreateChannel,
  onDelete,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dept.id, disabled: !enableReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-1 group pr-2">
        {enableReordering && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 justify-start font-medium min-w-0 px-2"
          onClick={() => onToggle(dept.id)}
        >
          <span className="flex items-center gap-1 min-w-0 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{dept.name}</span>
          </span>
          <span className="ml-2 text-xs text-muted-foreground flex-shrink-0">
            {channels.length}
          </span>
        </Button>
        {(isAdmin || canCreateChannel) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCreateChannel(dept.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Channel
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  onClick={() => onDelete(dept)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Department
                </DropdownMenuItem>
              )}
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
          className="ml-3 space-y-0.5 mt-1"
        >
          {channels.length === 0 ? (
            <div className="py-2 px-3 text-xs text-muted-foreground">
              {isAdmin || canCreateChannel ? (
                <button
                  onClick={() => onCreateChannel(dept.id)}
                  className="hover:underline"
                >
                  + Create first channel
                </button>
              ) : (
                'No channels'
              )}
            </div>
          ) : (
            channels.map((channel: Channel) => (
              <Button
                key={channel.id}
                variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start text-sm min-w-0 px-2',
                  selectedChannel === channel.id && 'bg-accent',
                  (channel.unread_count ?? 0) > 0 && 'font-semibold'
                )}
                onClick={() => onChannelClick(channel.id, channel.name)}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  {channel.is_private ? (
                    <Lock className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <Hash className="w-3 h-3 flex-shrink-0" />
                  )}
                  {mutedChannelIds?.has(channel.id) && (
                    <BellOff className="w-3 h-3 flex-shrink-0 text-muted-foreground" aria-label="Muted" />
                  )}
                  <span className="truncate">{channel.name}</span>
                </span>
                {channel.unread_count && channel.unread_count > 0 && (
                  <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                    {channel.unread_count}
                  </span>
                )}
              </Button>
            ))
          )}
        </motion.div>
      )}
    </div>
  );
};

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
  const [orderedDepartments, setOrderedDepartments] = useState<Department[]>([]);

  const isAdmin = hasPermission('admin');
  const { canCreateChannel } = useCommunicationPermissions();
  const { data: unreadPack } = useChannelUnreadMapQuery();
  const { data: mutedChannelSet } = useChannelMuteSet();

  const unreadMap = unreadPack?.map ?? new Map<string, number>();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch user preferences
  const { data: preferences } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_communication_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data as UserPreferences | null;
    },
    enabled: !!user,
  });

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
        .select('*')
        .eq('is_archived', false)
        .order('name');
      
      if (error) {
        console.error('Error fetching channels:', error);
        throw error;
      }

      return data as Channel[];
    },
    enabled: !!user,
  });

  const { data: archivedChannels = [] } = useQuery({
    queryKey: ['channels-archived', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('is_archived', true)
        .order('name');

      if (error) {
        console.error('Error fetching archived channels:', error);
        throw error;
      }
      return data as Channel[];
    },
    enabled: !!user,
  });

  const channelsWithUnread = useMemo(() => {
    return allChannels.map((c) => ({
      ...c,
      unread_count: unreadMap.get(c.id) ?? 0,
    }));
  }, [allChannels, unreadMap]);

  useEffect(() => {
    if (!user) return;
    const rt = supabase
      .channel('communication-sidebar-unread')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channel_members', filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['channel-unread-map'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['channel-unread-map'] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(rt);
    };
  }, [user, queryClient]);

  // Apply user's department order
  useEffect(() => {
    if (departments.length > 0) {
      if (preferences?.department_order && preferences.department_order.length > 0) {
        // Sort by user preference
        const ordered = [...departments].sort((a, b) => {
          const indexA = preferences.department_order.indexOf(a.id);
          const indexB = preferences.department_order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        setOrderedDepartments(ordered);
      } else {
        setOrderedDepartments(departments);
      }
    }
  }, [departments, preferences]);

  // Save department order mutation
  const saveDepartmentOrderMutation = useMutation({
    mutationFn: async (order: string[]) => {
      if (!user) return;

      const { error } = await supabase
        .from('user_communication_preferences')
        .upsert({
          user_id: user.id,
          department_order: order,
          enable_department_reordering: preferences?.enable_department_reordering ?? true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedDepartments((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Save to database
        saveDepartmentOrderMutation.mutate(newOrder.map(d => d.id));
        
        return newOrder;
      });
    }
  };

  // Separate general channel from department channels
  // Find general channel - it should be in the General department
  const generalChannel = channelsWithUnread.find((c) => c.name.toLowerCase() === 'general');
  const departmentChannels = channelsWithUnread.filter((c) => c.name.toLowerCase() !== 'general');

  const toggleDepartment = (deptId: string) => {
    setExpandedDepts((prev) => {
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
    return departmentChannels
      .filter((c) => c.department_id === deptId)
      .sort((a, b) => {
        const ua = a.unread_count ?? 0;
        const ub = b.unread_count ?? 0;
        if (ub !== ua) return ub - ua;
        return a.name.localeCompare(b.name);
      });
  };

  const handleDeleteDept = (dept: Department) => {
    const channelCount = getChannelsForDept(dept.id).length;
    setDeleteDept({ id: dept.id, name: dept.name, channelCount });
  };

  const enableReordering = preferences?.enable_department_reordering ?? true;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-lg truncate">Communication</h2>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            onClick={() => setShowCreateDept(true)}
            title="Create Department"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Channels List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* General Channel - No heading, directly at top */}
          {generalChannel ? (
            <div className="mb-3">
              <Button
                variant={selectedChannel === generalChannel.id ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start text-sm min-w-0 px-2',
                  selectedChannel === generalChannel.id && 'bg-accent',
                  (generalChannel.unread_count ?? 0) > 0 && 'font-semibold'
                )}
                onClick={() => handleChannelClick(generalChannel.id, generalChannel.name)}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  {mutedChannelSet?.has(generalChannel.id) && (
                    <BellOff className="w-3 h-3 flex-shrink-0 text-muted-foreground" aria-label="Muted" />
                  )}
                  <span className="truncate font-medium">{generalChannel.name}</span>
                </span>
                {generalChannel.unread_count && generalChannel.unread_count > 0 && (
                  <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 flex-shrink-0">
                    {generalChannel.unread_count}
                  </span>
                )}
              </Button>
            </div>
          ) : !loadingChannels ? (
            <div className="mb-3 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                #general channel not found. {isAdmin && 'Please run FIX_GENERAL_CHANNEL.sql to set it up.'}
              </p>
            </div>
          ) : null}

          {/* Departments Section */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Departments
          </div>

          {(() => {
            if (loadingDepts) {
              return (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading departments...
                </div>
              );
            }
            if (orderedDepartments.length === 0) {
              return (
                <div className="p-4 text-center text-sm text-muted-foreground space-y-2">
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
              );
            }
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedDepartments.map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {orderedDepartments.map((dept) => (
                      <SortableDepartmentItem
                        key={dept.id}
                        dept={dept}
                        channels={getChannelsForDept(dept.id)}
                        isExpanded={expandedDepts.has(dept.id)}
                        selectedChannel={selectedChannel}
                        isAdmin={isAdmin}
                        canCreateChannel={canCreateChannel}
                        enableReordering={enableReordering}
                        mutedChannelIds={mutedChannelSet ?? new Set()}
                        onToggle={toggleDepartment}
                        onChannelClick={handleChannelClick}
                        onCreateChannel={setShowCreateChannel}
                        onDelete={handleDeleteDept}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            );
          })()}

          {archivedChannels.length > 0 && (
            <>
              <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Archived
              </div>
              <div className="space-y-0.5">
                {archivedChannels.map((channel) => (
                  <Button
                    key={channel.id}
                    variant={selectedChannel === channel.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start text-sm min-w-0 px-2',
                      selectedChannel === channel.id && 'bg-accent'
                    )}
                    onClick={() => handleChannelClick(channel.id, channel.name)}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <Archive className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{channel.name}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1 flex-shrink-0">
        <Button variant="ghost" size="sm" className="w-full justify-start px-2">
          <Users className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">Direct Messages</span>
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start px-2">
          <Settings className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">Settings</span>
        </Button>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <>
          <CreateDepartmentDialog
            open={showCreateDept}
            onOpenChange={setShowCreateDept}
          />
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
      {(isAdmin || canCreateChannel) && showCreateChannel && (
        <CreateChannelDialog
          open={!!showCreateChannel}
          onOpenChange={(open) => !open && setShowCreateChannel(null)}
          departmentId={showCreateChannel}
        />
      )}
    </div>
  );
};
