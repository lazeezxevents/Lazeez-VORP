import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type ChannelRow = {
  id: string;
  department_id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  is_private: boolean;
  is_archived: boolean;
  created_at: string;
  created_by: string | null;
};

export type ChannelSettingsBundle = {
  channel: {
    id: string;
    name: string;
    description?: string;
    purpose?: string;
    isPrivate: boolean;
    isArchived: boolean;
    createdBy: string;
  };
  members: Array<{
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    role: 'owner' | 'admin' | 'member';
    joinedAt: string;
  }>;
  pinnedMessages: Array<{
    id: string;
    messageId: string;
    content: string;
    userName: string;
    createdAt: string;
    pinnedBy: string;
    pinnedAt: string;
  }>;
};

async function loadChannelSettings(channelId: string): Promise<ChannelSettingsBundle> {
  const { data: ch, error: chErr } = await supabase
    .from('channels')
    .select('*')
    .eq('id', channelId)
    .single();

  if (chErr || !ch) {
    throw chErr || new Error('Channel not found');
  }

  const row = ch as ChannelRow;

  const { data: memberRows, error: mErr } = await supabase
    .from('channel_members')
    .select('id, user_id, role, joined_at')
    .eq('channel_id', channelId);

  if (mErr) throw mErr;

  const userIds = [...new Set((memberRows || []).map((m) => m.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };

  const profileMap = new Map(
    (profiles || []).map((p) => [
      p.id,
      { name: p.full_name || 'Unknown', avatar: p.avatar_url || undefined },
    ])
  );

  const members = (memberRows || []).map((m) => {
    const prof = profileMap.get(m.user_id);
    const r = (m.role || 'member').toLowerCase();
    const role: 'owner' | 'admin' | 'member' =
      r === 'owner' ? 'owner' : r === 'admin' ? 'admin' : 'member';
    return {
      id: m.id,
      userId: m.user_id,
      userName: prof?.name || 'Unknown',
      userAvatar: prof?.avatar,
      role,
      joinedAt: m.joined_at,
    };
  });

  const { data: pins } = await supabase
    .from('pinned_messages')
    .select('id, message_id, pinned_by, pinned_at')
    .eq('channel_id', channelId);

  const messageIds = [...new Set((pins || []).map((p) => p.message_id))];
  let pinnedMessages: ChannelSettingsBundle['pinnedMessages'] = [];

  if (messageIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, content, created_at, user_id')
      .in('id', messageIds);

    const authorIds = [...new Set((msgs || []).map((m) => m.user_id))];
    const { data: authors } = authorIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const authorMap = new Map(
      (authors || []).map((a) => [a.id, a.full_name || 'Unknown'])
    );

    const msgMap = new Map(
      (msgs || []).map((m) => [
        m.id,
        {
          content: m.content,
          createdAt: m.created_at,
          userName: authorMap.get(m.user_id) || 'Unknown',
        },
      ])
    );

    pinnedMessages = (pins || []).map((p) => {
      const msg = msgMap.get(p.message_id);
      return {
        id: p.id,
        messageId: p.message_id,
        content: msg?.content || '(message unavailable)',
        userName: msg?.userName || 'Unknown',
        createdAt: msg?.createdAt || p.pinned_at,
        pinnedBy: p.pinned_by,
        pinnedAt: p.pinned_at,
      };
    });
  }

  return {
    channel: {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      purpose: row.purpose || undefined,
      isPrivate: row.is_private,
      isArchived: row.is_archived,
      createdBy: row.created_by || members.find((m) => m.role === 'owner')?.userId || '',
    },
    members,
    pinnedMessages,
  };
}

export type ChannelPinBrief = { pinId: string; messageId: string; content: string };

export async function fetchChannelPinsBrief(channelId: string): Promise<ChannelPinBrief[]> {
  const { data: pins, error } = await supabase
    .from('pinned_messages')
    .select('id, message_id, pinned_at')
    .eq('channel_id', channelId)
    .order('pinned_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  const ids = [...new Set((pins || []).map((p) => p.message_id))];
  if (ids.length === 0) return [];

  const { data: msgs, error: msgErr } = await supabase.from('messages').select('id, content').in('id', ids);
  if (msgErr) throw msgErr;
  const byId = new Map((msgs || []).map((m) => [m.id, m.content as string]));

  return (pins || []).map((p) => ({
    pinId: p.id,
    messageId: p.message_id,
    content: (byId.get(p.message_id) || '').slice(0, 160),
  }));
}

export function useChannelAdmin(channelId: string | null, dialogOpen: boolean) {
  const queryClient = useQueryClient();
  const key = ['channel-settings', channelId] as const;
  const pinsKey = ['channel-pins', channelId] as const;

  const invalidatePinsAndSettings = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: pinsKey });
  };

  const query = useQuery({
    queryKey: key,
    enabled: Boolean(channelId && dialogOpen),
    queryFn: () => loadChannelSettings(channelId!),
  });

  const updateChannel = useMutation({
    mutationFn: async (updates: {
      name?: string;
      description?: string;
      purpose?: string;
      isPrivate?: boolean;
    }) => {
      if (!channelId) return;
      const { error } = await supabase
        .from('channels')
        .update({
          name: updates.name,
          description: updates.description ?? null,
          purpose: updates.purpose ?? null,
          is_private: updates.isPrivate,
        })
        .eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const setArchived = useMutation({
    mutationFn: async (archived: boolean) => {
      if (!channelId) return;
      const { error } = await supabase
        .from('channels')
        .update({ is_archived: archived })
        .eq('id', channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels-archived'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberRowId: string) => {
      const { error } = await supabase.from('channel_members').delete().eq('id', memberRowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const addMember = useMutation({
    mutationFn: async (params: { userId: string; isPrivate: boolean; channelName: string }) => {
      if (!channelId) return;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { error } = await supabase.from('channel_members').insert({
        channel_id: channelId,
        user_id: params.userId,
        role: 'member',
      });
      if (error) throw error;

      if (params.isPrivate) {
        const { error: nErr } = await supabase.from('notifications').insert({
          user_id: params.userId,
          type: 'info',
          category: 'communication',
          title: 'Private channel invitation',
          message: `You were added to the private channel #${params.channelName}.`,
          entity_type: 'channel',
          entity_id: channelId,
          created_by: uid,
        });
        if (nErr) console.error('[Channel] notification insert failed:', nErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const transferOwnership = useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!channelId) throw new Error('No channel');
      const { data: rows, error: fe } = await supabase
        .from('channel_members')
        .select('id, user_id, role')
        .eq('channel_id', channelId);
      if (fe) throw fe;

      const oldOwner = rows?.find((r) => r.role === 'owner');
      const target = rows?.find((r) => r.user_id === newOwnerId);
      if (!oldOwner || !target) throw new Error('Member not found');
      if (oldOwner.user_id === newOwnerId) return;

      const { error: e1 } = await supabase
        .from('channel_members')
        .update({ role: 'admin' })
        .eq('id', oldOwner.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('channel_members').update({ role: 'owner' }).eq('id', target.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels-archived'] });
    },
  });

  const pinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!channelId) return;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { error } = await supabase.from('pinned_messages').insert({
        channel_id: channelId,
        message_id: messageId,
        pinned_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePinsAndSettings(),
  });

  const unpinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!channelId) return;
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', channelId)
        .eq('message_id', messageId);
      if (error) throw error;
    },
    onSuccess: () => invalidatePinsAndSettings(),
  });

  return {
    bundle: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updateChannel,
    setArchived,
    removeMember,
    addMember,
    transferOwnership,
    pinMessage,
    unpinMessage,
  };
}

/** Pin/unpin without loading full settings bundle (e.g. from message list). */
export function useChannelPinMutations(channelId: string | null) {
  const queryClient = useQueryClient();
  const key = ['channel-settings', channelId] as const;
  const pinsKey = ['channel-pins', channelId] as const;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: pinsKey });
  };

  const pinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!channelId) return;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not authenticated');
      const { error } = await supabase.from('pinned_messages').insert({
        channel_id: channelId,
        message_id: messageId,
        pinned_by: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const unpinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!channelId) return;
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('channel_id', channelId)
        .eq('message_id', messageId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  return { pinMessage, unpinMessage };
}
