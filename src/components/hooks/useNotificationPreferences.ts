import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  mou_status_changes: boolean;
  mou_expiration_reminders: boolean;
  mou_expiration_days: number[];
  issue_assignments: boolean;
  issue_updates: boolean;
  weekly_digest: boolean;
  delivery_updates: boolean;
  created_at: string;
  updated_at: string;
}

export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as NotificationPreferences | null;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      preferences: Partial<Omit<NotificationPreferences, "id" | "user_id" | "created_at" | "updated_at">>
    ) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if preferences exist
      const { data: existing } = await supabase
        .from("notification_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("notification_preferences")
          .update(preferences)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_preferences").insert({
          user_id: user.id,
          ...preferences,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Notification preferences saved");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save preferences: ${error.message}`);
    },
  });
}
