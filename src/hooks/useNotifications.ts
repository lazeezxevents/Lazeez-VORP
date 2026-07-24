import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { differenceInDays } from "date-fns";
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

const READ_STORAGE_KEY = "lazeez-read-notifications";
const DELETE_STORAGE_KEY = "lazeez-deleted-notifications";

function loadItems(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return new Set(JSON.parse(stored));
  } catch { }
  return new Set();
}

function saveItems(key: string, items: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...items]));
}

function mapEntityTypeToCategory(entityType: string): Notification["category"] {
  switch (entityType?.toLowerCase()) {
    case "vendor":
      return "vendor";
    case "mou":
    case "mou_vault":
      return "mou";
    case "issue":
      return "issue";
    case "payment":
    case "vendor_payment":
      return "payment";
    case "project":
    case "project_task":
      return "project";
    case "performance_review":
    case "appraisal_review":
    case "appraisal":
      return "appraisal";
    case "time_log":
    case "attendance_log":
      return "attendance";
    case "leave_request":
      return "leave";
    default:
      return "system";
  }
}

export function useNotifications() {
  const { user, isStaff, isAdmin, isHR, isManager } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: preferences } = useNotificationPreferences();
  const { preferences: uiPrefs } = useNotificationUIPreferences();
  const { data: commDelivery } = useUserCommunicationDeliveryPrefs();
  const { data: mutedChannelSet } = useChannelMuteSet();
  const [readItems, setReadItems] = useState<Set<string>>(() => loadItems(READ_STORAGE_KEY));
  const [deletedItems, setDeletedItems] = useState<Set<string>>(() => loadItems(DELETE_STORAGE_KEY));
  
  // Debounce state for sound playback
  const soundDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Sync mutations
  const handleMarkAsRead = useCallback((id: string) => {
    setReadItems((prev) => {
      const next = new Set(prev).add(id);
      saveItems(READ_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleMarkAllAsRead = useCallback((ids: string[]) => {
    setReadItems((prev) => {
      const next = new Set([...prev, ...ids]);
      saveItems(READ_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeletedItems((prev) => {
      const next = new Set(prev).add(id);
      saveItems(DELETE_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const handleDeleteAll = useCallback((ids: string[], notificationsToArchive?: Notification[]) => {
    // Archive notifications to database before deleting
    if (notificationsToArchive && notificationsToArchive.length > 0) {
      const toArchive = notificationsToArchive.filter(n => ids.includes(n.id));
      if (toArchive.length > 0 && user) {
        // Archive to database
        const records = toArchive.map(n => ({
          user_id: user.id,
          notification_id: n.id,
          notification_type: n.type,
          category: n.category,
          title: n.title,
          message: n.message,
          entity_type: n.entity_type,
          entity_id: n.entity_id,
          action_url: n.action_url,
          metadata: n.metadata || {},
          original_created_at: n.created_at,
        }));

        supabase
          .from("archived_notifications")
          .insert(records)
          .then(({ error }) => {
            if (error) console.error("Failed to archive notifications:", error);
          });
      }
    }

    setDeletedItems((prev) => {
      const next = new Set([...prev, ...ids]);
      saveItems(DELETE_STORAGE_KEY, next);
      return next;
    });
  }, [user]);

  const handleMarkCategoryAsRead = useCallback((category: string, notifications: Notification[]) => {
    const categoryIds = notifications
      .filter(n => n.category === category)
      .map(n => n.id);
    handleMarkAllAsRead(categoryIds);
  }, [handleMarkAllAsRead]);

  const handleArchiveCategory = useCallback((category: string, notifications: Notification[]) => {
    const categoryIds = notifications
      .filter(n => n.category === category)
      .map(n => n.id);
    handleDeleteAll(categoryIds, notifications);
  }, [handleDeleteAll]);

  const handleExportCategory = useCallback((category: string, notifications: Notification[]) => {
    const categoryNotifications = notifications.filter(n => n.category === category);
    const dataStr = JSON.stringify(categoryNotifications, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notifications-${category}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportAll = useCallback((notifications: Notification[]) => {
    const dataStr = JSON.stringify(notifications, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-notifications-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleArchiveOld = useCallback((notificationsToCheck: Notification[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldIds = notificationsToCheck
      .filter(n => new Date(n.created_at) < thirtyDaysAgo)
      .map(n => n.id);
    
    if (oldIds.length > 0) {
      handleDeleteAll(oldIds, notificationsToCheck);
      toast.success(`Archived ${oldIds.length} old notifications`);
    } else {
      toast.info("No old notifications to archive");
    }
  }, [handleDeleteAll]);

  // Fetch logic
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["unified-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const allNotifications: Notification[] = [];
      const now = new Date();

      // 1. Expiring MOUs (Staff/HR/Admin only)
      if (preferences?.mou_expiration_reminders && (isStaff || isAdmin)) {
        const { data: mous } = await supabase
          .from("mous")
          .select("*, vendors(name)")
          .in("status", ["approved", "signed"]);

        (mous || []).forEach((mou: any) => {
          if (!mou.end_date) return;
          const daysUntil = differenceInDays(new Date(mou.end_date), now);
          if (preferences.mou_expiration_days.includes(daysUntil) || (daysUntil <= 7 && daysUntil >= 0)) {
            allNotifications.push({
              id: `mou-expiring-${mou.id}-${daysUntil}`,
              type: daysUntil <= 3 ? "error" : "warning",
              category: "mou",
              title: "MOU Expiring",
              message: `${mou.title} expires in ${daysUntil} days`,
              read: readItems.has(`mou-expiring-${mou.id}-${daysUntil}`),
              entity_type: "mou",
              entity_id: mou.id,
              action_url: "/mous",
              created_at: new Date().toISOString(),
            });
          }
        });
      }

      // 2. Assigned Issues (Everyone can see their own)
      if (preferences?.issue_assignments) {
        const { data: issues } = await supabase
          .from("issues")
          .select(`
            *,
            vendors(name)
          `)
          .eq("assigned_to", user.id)
          .in("status", ["open", "in_progress"]);

        (issues || []).forEach((issue: any) => {
          const assignerName = "Operations Team";
          allNotifications.push({
            id: `issue-assigned-${issue.id}`,
            type: issue.priority === "critical" ? "error" : "info",
            category: "issue",
            title: `${assignerName} assigned an Issue`,
            message: issue.title,
            read: readItems.has(`issue-assigned-${issue.id}`),
            entity_type: "issue",
            entity_id: issue.id,
            action_url: "/issues",
            created_at: issue.created_at,
            metadata: {}
          });
        });
      }

      const { data: projectTasks } = await (supabase
        .from("project_tasks" as any) as any)
        .select(`
          *,
          projects(name)
        `)
        .eq("assigned_to", user.id)
        .in("status", ["todo", "in_progress"])
        .limit(10);

      (projectTasks || []).forEach((task: any) => {
        const assignerName = "Project Manager";
        allNotifications.push({
          id: `task-${task.id}`,
          type: "info",
          category: "project",
          title: `${assignerName} assigned a Task`,
          message: `${task.title} in project ${task.projects?.name || "Unknown"}`,
          read: readItems.has(`task-${task.id}`),
          entity_type: "project_task",
          entity_id: task.id,
          action_url: "/projects",
          created_at: task.created_at,
          metadata: {}
        });
      });

      // 4. Audit Logs (System Activity) - Staff/Admin Only
      if (isStaff || isAdmin) {
        const { data: logs } = await supabase
          .from("audit_logs")
          .select(`
            *,
            profiles(full_name, avatar_url)
          `)
          .order("created_at", { ascending: false })
          .limit(20);

        (logs || []).forEach((log: any) => {
            // Skip logging the user's own actions
            if (log.user_id === user.id) return;
            
            const category = mapEntityTypeToCategory(log.entity_type);
            const userName = log.profiles?.full_name || log.user_email || "System";
            const actionWord = log.action === "created" ? "added a new" 
                             : log.action === "deleted" ? "removed a" 
                             : log.action === "status_changed" ? "changed status of" 
                             : "updated";
            const cleanEntityType = (log.entity_type || "record").replace("_", " ");
            const formattedEntityType = cleanEntityType.charAt(0).toUpperCase() + cleanEntityType.slice(1);

            allNotifications.push({
              id: log.id,
              type: log.action === "deleted" ? "warning" : log.action === "created" ? "success" : "info",
              category: category,
              title: `${userName} ${actionWord} ${formattedEntityType}`,
              message: `Review the changes made to the ${formattedEntityType.toLowerCase()} record.`,
              read: readItems.has(log.id),
              entity_type: log.entity_type,
              entity_id: log.entity_id,
              created_at: log.created_at,
              metadata: {
                avatar_url: log.profiles?.avatar_url
              }
            });
        });
      }

      return allNotifications;
    },
    enabled: !!user && !!preferences,
    refetchInterval: 60000,
  });

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

  // Real-time subscriptions - Listen to notifications table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      // Listen for new notifications for this user
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log('New notification received:', payload);
        queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
        
        const newNotif = payload.new as Record<string, unknown> & {
          title?: string;
          message?: string;
          action_url?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
        };

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
      // Listen for updates (mark as read, archive)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      })
      // Also listen to audit logs for system activity
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        if (payload.new.user_id !== user.id) {
            queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
        }
      })
      // Issues - Real-time sync for assignments and updates
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, (payload) => {
          const issue = payload.new as any;
          if (issue && (issue.assigned_to === user.id || isStaff || isAdmin)) {
              queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
          }
      })
      // Project Tasks - Updates for assignments
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, (payload) => {
          const task = payload.new as any;
          if (task && (task.assigned_to === user.id || isStaff || isAdmin)) {
              queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
          }
      })
      // MOUs & Payments - Critical for management staff
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mous' }, () => {
          if (isStaff || isAdmin) queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_payments' }, () => {
          if (isStaff || isAdmin) queryClient.invalidateQueries({ queryKey: ["unified-notifications"] });
      })
      .subscribe();

    return () => {
      // Clear debounce timer on cleanup
      if (soundDebounceTimerRef.current) {
        clearTimeout(soundDebounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, isStaff, isAdmin, uiPrefs, navigate, commDelivery, mutedChannelSet]);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => !deletedItems.has(n.id))
      .filter((n) => {
        const cid = notificationChannelId({
          entity_id: n.entity_id,
          entity_type: n.entity_type,
          metadata: n.metadata,
        });
        if (cid && mutedChannelSet?.has(cid) && !isLikelyMentionNotification(n)) return false;
        return true;
      })
      .map(n => ({
        ...n,
        read: readItems.has(n.id)
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications, deletedItems, readItems, mutedChannelSet]);

  const unreadNotifications = useMemo(() => 
    filteredNotifications.filter(n => !readItems.has(n.id)),
  [filteredNotifications, readItems]);

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
    readItems,
    deletedItems
  };
}
