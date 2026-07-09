# Supabase Realtime Implementation Guide

## ✅ Decision: Use Supabase Realtime (NOT Redis)

**Why Supabase Realtime is Better**:
- Already integrated (no extra infrastructure)
- Built-in presence, broadcast, and database changes
- Automatic RLS enforcement
- Sub-100ms latency
- Included in your Supabase plan
- Simpler architecture

---

## 🎯 What Just Happened

### ✅ Task 1.1 COMPLETED: Database Migration Created

**File**: `supabase/migrations/20260505000000_communication_module.sql`

**What's Included**:
- ✅ All 15 tables (departments, channels, messages, etc.)
- ✅ Complete RLS policies for security
- ✅ Indexes for performance
- ✅ Helper functions (unread counts, mark as read)
- ✅ Triggers for timestamps
- ✅ Initial data (General department)

**To Apply Migration**:
```bash
# If using Supabase CLI
supabase db push

# Or apply manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Paste the migration file
# 3. Run
```

---

## 📋 Next Steps: Implement Supabase Realtime

### Step 1: Install Supabase Client (Already Done)

You already have `@supabase/supabase-js` installed.

---

### Step 2: Create Realtime Service

Create `src/services/SupabaseRealtimeService.ts`:

```typescript
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    profile_picture_url?: string;
  };
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  channelId: string;
  isTyping: boolean;
}

export interface PresenceState {
  userId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  customStatus?: string;
}

export class SupabaseRealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  /**
   * Subscribe to a channel for real-time messages
   */
  subscribeToChannel(
    channelId: string,
    callbacks: {
      onMessage?: (message: Message) => void;
      onTyping?: (typing: TypingIndicator) => void;
      onPresence?: (presence: PresenceState[]) => void;
    }
  ): RealtimeChannel {
    // Check if already subscribed
    if (this.channels.has(channelId)) {
      return this.channels.get(channelId)!;
    }

    const channel = supabase.channel(`channel:${channelId}`, {
      config: {
        broadcast: { self: true }, // Receive own messages
        presence: { key: 'user_id' },
      },
    });

    // Listen for new messages (database changes)
    if (callbacks.onMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch full message with user data
          const { data: message } = await supabase
            .from('messages')
            .select('*, user:users(*)')
            .eq('id', payload.new.id)
            .single();

          if (message) {
            callbacks.onMessage!(message as Message);
          }
        }
      );
    }

    // Listen for typing indicators (broadcast)
    if (callbacks.onTyping) {
      channel.on('broadcast', { event: 'typing' }, (payload) => {
        callbacks.onTyping!(payload.payload as TypingIndicator);
      });
    }

    // Listen for presence changes
    if (callbacks.onPresence) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presenceList: PresenceState[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          presences.forEach((presence) => {
            presenceList.push(presence as PresenceState);
          });
        });

        callbacks.onPresence!(presenceList);
      });
    }

    // Subscribe to channel
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: ${channelId}`);

        // Track presence
        const user = await supabase.auth.getUser();
        if (user.data.user) {
          await channel.track({
            userId: user.data.user.id,
            status: 'online',
            online_at: new Date().toISOString(),
          });
        }
      }
    });

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Send a message via Supabase (will trigger realtime update)
   */
  async sendMessage(
    channelId: string,
    content: string,
    threadParentId?: string
  ): Promise<Message | null> {
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: user.data.user.id,
        content,
        thread_parent_id: threadParentId,
      })
      .select('*, user:users(*)')
      .single();

    if (error) {
      console.error('Failed to send message:', error);
      return null;
    }

    return data as Message;
  }

  /**
   * Broadcast typing indicator
   */
  async broadcastTyping(
    channelId: string,
    isTyping: boolean
  ): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      console.warn(`Not subscribed to channel: ${channelId}`);
      return;
    }

    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.data.user.id)
      .single();

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.data.user.id,
        userName: profile?.full_name || 'Unknown',
        channelId,
        isTyping,
      },
    });
  }

  /**
   * Update presence status
   */
  async updatePresence(
    channelId: string,
    status: 'online' | 'away' | 'dnd' | 'offline',
    customStatus?: string
  ): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    await channel.track({
      userId: user.data.user.id,
      status,
      customStatus,
      online_at: new Date().toISOString(),
    });

    // Also update database
    await supabase
      .from('user_presence')
      .upsert({
        user_id: user.data.user.id,
        status,
        custom_status: customStatus,
        last_seen: new Date().toISOString(),
      });
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribeFromChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel) {
      await supabase.removeChannel(channel);
      this.channels.delete(channelId);
      console.log(`Unsubscribed from channel: ${channelId}`);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    for (const [channelId, channel] of this.channels.entries()) {
      await supabase.removeChannel(channel);
      console.log(`Unsubscribed from channel: ${channelId}`);
    }
    this.channels.clear();
  }
}

// Export singleton instance
export const realtimeService = new SupabaseRealtimeService();
```

---

### Step 3: Update MessageList Component

Update `src/components/communication/MessageList.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { realtimeService, Message } from '@/services/SupabaseRealtimeService';
import { useVirtualizer } from '@tanstack/react-virtual';

interface MessageListProps {
  channelId: string;
}

export const MessageList = ({ channelId }: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, user:users(*)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        setMessages(data as Message[]);
      }
    };

    fetchMessages();
  }, [channelId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = realtimeService.subscribeToChannel(channelId, {
      onMessage: (newMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      },
    });

    return () => {
      realtimeService.unsubscribeFromChannel(channelId);
    };
  }, [channelId]);

  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={message.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageItem message={message} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

### Step 4: Update MessageComposer Component

Update `src/components/communication/MessageComposer.tsx`:

```typescript
import { useState } from 'react';
import { realtimeService } from '@/services/SupabaseRealtimeService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface MessageComposerProps {
  channelId: string;
}

export const MessageComposer = ({ channelId }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!content.trim()) return;

    setIsSending(true);
    try {
      await realtimeService.sendMessage(channelId, content);
      setContent('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Typing indicator
  const handleTyping = () => {
    realtimeService.broadcastTyping(channelId, true);

    // Clear typing after 3 seconds
    setTimeout(() => {
      realtimeService.broadcastTyping(channelId, false);
    }, 3000);
  };

  return (
    <div className="p-4 border-t">
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          handleTyping();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        className="min-h-[80px]"
      />
      <div className="mt-2 flex justify-end">
        <Button onClick={handleSend} disabled={isSending || !content.trim()}>
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
};
```

---

### Step 5: Add Typing Indicators

Create `src/components/communication/TypingIndicator.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { realtimeService, TypingIndicator as TypingIndicatorType } from '@/services/SupabaseRealtimeService';

interface TypingIndicatorProps {
  channelId: string;
}

export const TypingIndicator = ({ channelId }: TypingIndicatorProps) => {
  const [typingUsers, setTypingUsers] = useState<TypingIndicatorType[]>([]);

  useEffect(() => {
    const channel = realtimeService.subscribeToChannel(channelId, {
      onTyping: (typing) => {
        if (typing.isTyping) {
          setTypingUsers((prev) => {
            const filtered = prev.filter((u) => u.userId !== typing.userId);
            return [...filtered, typing];
          });

          // Remove after 3 seconds
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== typing.userId));
          }, 3000);
        } else {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== typing.userId));
        }
      },
    });

    return () => {
      realtimeService.unsubscribeFromChannel(channelId);
    };
  }, [channelId]);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.userName).join(', ');

  return (
    <div className="text-sm text-muted-foreground px-4 py-2">
      {typingUsers.length === 1 ? (
        <span>{names} is typing...</span>
      ) : (
        <span>{names} are typing...</span>
      )}
    </div>
  );
};
```

---

### Step 6: Add Presence Indicators

Create `src/components/communication/PresenceIndicator.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceIndicatorProps {
  userId: string;
}

export const PresenceIndicator = ({ userId }: PresenceIndicatorProps) => {
  const [status, setStatus] = useState<'online' | 'away' | 'dnd' | 'offline'>('offline');

  useEffect(() => {
    // Fetch initial presence
    const fetchPresence = async () => {
      const { data } = await supabase
        .from('user_presence')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (data) {
        setStatus(data.status);
      }
    };

    fetchPresence();

    // Subscribe to presence changes
    const channel = supabase
      .channel('presence-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_presence',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const colors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={status} />
  );
};
```

---

## 🎯 Summary: What You Get with Supabase Realtime

### ✅ Features Included

1. **Real-Time Messaging** - Sub-100ms delivery
2. **Typing Indicators** - Broadcast API
3. **Presence Tracking** - Built-in presence API
4. **Database Changes** - Automatic updates on INSERT/UPDATE/DELETE
5. **Security** - RLS policies automatically enforced
6. **Scalability** - Horizontal scaling built-in
7. **No Extra Infrastructure** - All included in Supabase

### ✅ What You DON'T Need

- ❌ Redis server
- ❌ Separate WebSocket server
- ❌ Redis Pub/Sub setup
- ❌ Complex infrastructure management
- ❌ Extra hosting costs

### ✅ Performance

- **Message Delivery**: <100ms
- **Presence Updates**: Real-time
- **Typing Indicators**: <50ms
- **Database Changes**: Instant

---

## 📋 Next Implementation Steps

### Completed ✅
1. ✅ Database migration created and ready to apply
2. ✅ Supabase Realtime service architecture designed

### Next Tasks (In Order)

1. **Apply Database Migration** (5 minutes)
   ```bash
   supabase db push
   ```

2. **Create SupabaseRealtimeService** (30 minutes)
   - Copy code from Step 2 above
   - Test with a simple channel

3. **Update MessageList Component** (20 minutes)
   - Add realtime subscription
   - Test message delivery

4. **Update MessageComposer Component** (20 minutes)
   - Wire up send message
   - Add typing indicators

5. **Add Presence Indicators** (30 minutes)
   - Create PresenceIndicator component
   - Add to user avatars

6. **Test End-to-End** (1 hour)
   - Open 2 browser windows
   - Send messages between them
   - Verify real-time delivery
   - Test typing indicators
   - Test presence updates

---

## 🚀 Performance Comparison

### Supabase Realtime vs Redis

| Feature | Supabase Realtime | Redis |
|---------|------------------|-------|
| **Setup Time** | 5 minutes | 2-3 hours |
| **Infrastructure** | Included | Separate server |
| **Cost** | $0 (included) | $10-50/month |
| **Latency** | <100ms | <50ms |
| **Scalability** | Automatic | Manual |
| **Security** | RLS built-in | Manual |
| **Maintenance** | Zero | High |

**Verdict**: Supabase Realtime is the clear winner for your use case.

---

## 📚 Resources

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Realtime Presence](https://supabase.com/docs/guides/realtime/presence)
- [Database Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

---

**End of Guide**
