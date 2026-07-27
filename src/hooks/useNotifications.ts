import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { useUserCommunicationDeliveryPrefs } from "@/components/hooks/useUserCommunicationDeliveryPrefs";
import { useChannelMuteSet } from "@/components/hooks/useChannelMutes";
import { isWithinQuietHours } from "@/lib/communication/quietHours";
import {
  isCommunicationNotificationPayload,
  notificationChannelId,
  isLikelyMentionNotification,
} from "@/lib/communication/linkPreview";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  category: "performance" | "project" | "finance" | "delivery" | "system" | "mou" | "issue" | "payment" | "vendor" | "attendance" | "leave" | "appraisal";
  title: string;
  message: string;
  read: boolean;
  entity_type: string | null;
  entity_id: string | null;
  action_url?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: preferences } = useNotificationPreferences();
  const { preferences: uiPrefs } = useNotificationUIPreferences();
  const { data: commDelivery } = useUserCommunicationDeliveryPrefs();
  const { data: mutedChannelSet } = useChannelMuteSet();
  
  // Debounce state for sound playback
  const soundDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Fetch notifications from database
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["unified-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("Failed to fetch notifications:", error);
        return [];
      }
      
      // Map database notifications to frontend format
      return (data || []).map(n => ({
        id: n.id,
        type: n.type as Notification["type"],
        category: n.category as Notification["category"],
        title: n.title,
        message: n.message,
        read: n.read,
        entity_type: n.entity_type,
        entity_id: n.entity_id,
        action_url: n.action_url || undefined,
        created_at: n.created_at,
        metadata: n.metadata || {}
      }));
    },
    enabled: !!user,
    refetchInterval: false, // Rely on real-time
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)
        .eq("user_id", user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  // Archive notification mutation
  const archiveNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("archive_notification", { notification_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
    },
  });

  // Archive all notifications mutation
  const archiveAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("archive_all_notifications");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      toast.success("All notifications archived");
    },
  });

  // Handler functions
  const handleMarkAsRead = useCallback((id: string) => {
    markAsReadMutation.mutate(id);
  }, [markAsReadMutation]);

  const handleMarkAllAsRead = useCallback((ids: string[]) => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const handleDelete = useCallback((id: string) => {
    archiveNotificationMutation.mutate(id);
  }, [archiveNotificationMutation]);

  const handleDeleteAll = useCallback((ids: string[]) => {
    archiveAllMutation.mutate();
  }, [archiveAllMutation]);

  const handleMarkCategoryAsRead = useCallback(async (category: string) => {
    const categoryNotifs = notifications.filter(n => n.category === category && !n.read);
    for (const notif of categoryNotifs) {
      await markAsReadMutation.mutateAsync(notif.id);
    }
    toast.success(`All ${category} notifications marked as read`);
  }, [notifications, markAsReadMutation]);

  const handleArchiveCategory = useCallback(async (category: string) => {
    const categoryNotifs = notifications.filter(n => n.category === category);
    for (const notif of categoryNotifs) {
      await archiveNotificationMutation.mutateAsync(notif.id);
    }
    toast.success(`All ${category} notifications archived`);
  }, [notifications, archiveNotificationMutation]);

  const handleExportCategory = useCallback((category: string) => {
    const categoryNotifications = notifications.filter(n => n.category === category);
    const dataStr = JSON.stringify(categoryNotifications, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notifications-${category}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [notifications]);

  const handleExportAll = useCallback(() => {
    const dataStr = JSON.stringify(notifications, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-notifications-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [notifications]);

  const handleArchiveOld = useCallback(async () => {
    const { data, error } = await supabase.rpc("archive_old_notifications");
    if (error) {
      toast.error("Failed to archive old notifications");
    } else {
      queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      toast.success(`Archived ${data} old notifications`);
    }
  }, [queryClient]);

  const manualRefresh = useCallback(async () => {
    const previousCount = notifications.length;
    const { data: newNotifications } = await refetch();
    
    if (newNotifications && newNotifications.length === 0) {
      toast("You are all caught up", {
        description: "No notifications to display.",
      });
    } else if (newNotifications && newNotifications.length === previousCount) {
      toast("No new notifications", {
        description: "Your notification feed is up to date.",
      });
    } else {
      toast.success("Feed updated", {
        description: "New notifications have been loaded.",
      });
    }
  }, [refetch, notifications.length]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('New notification received:', payload);
        queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
        
        const newNotif = payload.new as any;

        const isComm = isCommunicationNotificationPayload(newNotif);
        const chId = notificationChannelId(newNotif);
        const mention = isLikelyMentionNotification(newNotif);
        const muted = chId && mutedChannelSet?.has(chId) && !mention;

        let suppressSound = false;
        let suppressToast = false;

        if (isComm && commDelivery) {
          if (commDelivery.notification_sounds === false) suppressSound = true;
          if (commDelivery.push_notifications === false) suppressToast = true;
          if (
            commDelivery.quiet_hours_enabled &&
            isWithinQuietHours(
              new Date(),
              commDelivery.quiet_hours_start ?? "",
              commDelivery.quiet_hours_end ?? "",
              true
            )
          ) {
            suppressSound = true;
            if (!mention) suppressToast = true;
          }
        }
        if (muted) {
          suppressSound = true;
          suppressToast = true;
        }

        const volumePercent =
          commDelivery?.sound_volume_percent ??
          Math.round((uiPrefs?.sound_volume ?? 0.4) * 100);
        const volume = Math.min(1, Math.max(0, volumePercent / 100));

        if (uiPrefs?.enable_sound && !soundPlayed && !suppressSound) {
          const { playSound } = require("@/components/utils/soundEffects");
          const soundType = uiPrefs.notification_sound_type || 'notification';
          playSound(soundType, { volume });
          
          setSoundPlayed(true);
          
          if (soundDebounceTimerRef.current) {
            clearTimeout(soundDebounceTimerRef.current);
          }
          
          soundDebounceTimerRef.current = setTimeout(() => {
            setSoundPlayed(false);
          }, 300);
        }
        
        if (newNotif && uiPrefs?.enable_popup_alerts && !suppressToast) {
          toast(String(newNotif.title || "Notification"), {
            description: newNotif.message ? String(newNotif.message) : undefined,
            action: newNotif.action_url ? {
              label: "View",
              onClick: () => navigate(String(newNotif.action_url))
            } : undefined
          });
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      })
      .subscribe();

    return () => {
      if (soundDebounceTimerRef.current) {
        clearTimeout(soundDebounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, uiPrefs, navigate, commDelivery, mutedChannelSet, soundPlayed]);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        const cid = notificationChannelId({
          entity_id: n.entity_id,
          entity_type: n.entity_type,
          metadata: n.metadata,
        });
        if (cid && mutedChannelSet?.has(cid) && !isLikelyMentionNotification(n)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications, mutedChannelSet]);

  const unreadNotifications = useMemo(() => 
    filteredNotifications.filter(n => !n.read),
  [filteredNotifications]);

  const unreadCount = unreadNotifications.length;

  return {
    notifications: filteredNotifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDelete,
    handleDeleteAll,
    handleMarkCategoryAsRead,
    handleArchiveCategory,
    handleExportCategory,
    handleExportAll,
    handleArchiveOld,
    refetch,
    manualRefresh,
    readItems: new Set(),
    deletedItems: new Set()
  };
}
