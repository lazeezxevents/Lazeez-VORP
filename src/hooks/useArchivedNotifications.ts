import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Notification } from "./useNotifications";

export interface ArchivedNotification {
  id: string;
  user_id: string;
  notification_id: string;
  notification_type: "info" | "success" | "warning" | "error";
  category: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  metadata: Record<string, any>;
  original_created_at: string;
  archived_at: string;
}

export function useArchivedNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch archived notifications
  const { data: archivedNotifications = [], isLoading } = useQuery({
    queryKey: ["archived-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("archived_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      return data as ArchivedNotification[];
    },
    enabled: !!user,
  });

  // Archive notification mutation
  const archiveMutation = useMutation({
    mutationFn: async (notification: Notification) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("archived_notifications")
        .insert({
          user_id: user.id,
          notification_id: notification.id,
          notification_type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          entity_type: notification.entity_type,
          entity_id: notification.entity_id,
          action_url: notification.action_url,
          metadata: notification.metadata || {},
          original_created_at: notification.created_at,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notifications"] });
    },
    onError: (error) => {
      console.error("Failed to archive notification:", error);
      toast.error("Failed to archive notification");
    },
  });

  // Archive multiple notifications
  const archiveMultipleMutation = useMutation({
    mutationFn: async (notifications: Notification[]) => {
      if (!user) throw new Error("User not authenticated");

      const records = notifications.map(n => ({
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

      const { error } = await supabase
        .from("archived_notifications")
        .insert(records);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notifications"] });
    },
    onError: (error) => {
      console.error("Failed to archive notifications:", error);
      toast.error("Failed to archive notifications");
    },
  });

  // Restore notification (delete from archive)
  const restoreMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("archived_notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("notification_id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notifications"] });
      toast.success("Notification restored");
    },
    onError: (error) => {
      console.error("Failed to restore notification:", error);
      toast.error("Failed to restore notification");
    },
  });

  // Permanently delete archived notification
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("archived_notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notifications"] });
      toast.success("Notification permanently deleted");
    },
    onError: (error) => {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    },
  });

  // Clear all archived notifications
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("archived_notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-notifications"] });
      toast.success("Archive cleared");
    },
    onError: (error) => {
      console.error("Failed to clear archive:", error);
      toast.error("Failed to clear archive");
    },
  });

  return {
    archivedNotifications,
    isLoading,
    archiveNotification: archiveMutation.mutate,
    archiveMultiple: archiveMultipleMutation.mutate,
    restoreNotification: restoreMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    clearAll: clearAllMutation.mutate,
    isArchiving: archiveMutation.isPending || archiveMultipleMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
