import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ============================================================================
// TYPES - Combining all notification preference sources
// ============================================================================

// Content preferences (notification_preferences table)
export interface ContentPreferences {
  mou_status_changes: boolean;
  mou_expiration_reminders: boolean;
  mou_expiration_days: number[];
  issue_assignments: boolean;
  issue_updates: boolean;
  weekly_digest: boolean;
  delivery_updates: boolean;
  finance_alerts: boolean;
}

// Communication preferences (user_notification_preferences table)
export interface CommunicationPreferences {
  push_notifications: boolean;
  email_digests: boolean;
  digest_frequency: 'immediate' | 'hourly' | 'daily' | 'never';
  notification_sounds: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sound_volume_percent: number;
}

// UI preferences (localStorage)
export interface UIPreferences {
  enable_popup_alerts: boolean;
  enable_sound: boolean;
  sound_volume: number;
  enable_hover_sounds: boolean;
  enable_click_sounds: boolean;
  enable_system_sounds: boolean;
  notification_sound_type: 'notification' | 'bell_ring' | 'success';
}

// Unified preferences
export interface UnifiedNotificationPreferences {
  content: ContentPreferences;
  communication: CommunicationPreferences;
  ui: UIPreferences;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_CONTENT: ContentPreferences = {
  mou_status_changes: true,
  mou_expiration_reminders: true,
  mou_expiration_days: [7, 14, 30],
  issue_assignments: true,
  issue_updates: true,
  weekly_digest: false,
  delivery_updates: true,
  finance_alerts: true,
};

const DEFAULT_COMMUNICATION: CommunicationPreferences = {
  push_notifications: true,
  email_digests: true,
  digest_frequency: 'daily',
  notification_sounds: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  sound_volume_percent: 50,
};

const DEFAULT_UI: UIPreferences = {
  enable_popup_alerts: true,
  enable_sound: true,
  sound_volume: 0.5,
  enable_hover_sounds: false,
  enable_click_sounds: true,
  enable_system_sounds: true,
  notification_sound_type: 'notification',
};

const UI_STORAGE_KEY = "lazeez-notification-ui-prefs";

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useUnifiedNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch content preferences from notification_preferences table
  const { data: contentPrefs, isLoading: contentLoading } = useQuery({
    queryKey: ["notification-preferences-content", user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_CONTENT;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      if (!data) return DEFAULT_CONTENT;

      return {
        mou_status_changes: data.mou_status_changes ?? DEFAULT_CONTENT.mou_status_changes,
        mou_expiration_reminders: data.mou_expiration_reminders ?? DEFAULT_CONTENT.mou_expiration_reminders,
        mou_expiration_days: data.mou_expiration_days ?? DEFAULT_CONTENT.mou_expiration_days,
        issue_assignments: data.issue_assignments ?? DEFAULT_CONTENT.issue_assignments,
        issue_updates: data.issue_updates ?? DEFAULT_CONTENT.issue_updates,
        weekly_digest: data.weekly_digest ?? DEFAULT_CONTENT.weekly_digest,
        delivery_updates: (data as any).delivery_updates ?? DEFAULT_CONTENT.delivery_updates,
        finance_alerts: (data as any).finance_alerts ?? DEFAULT_CONTENT.finance_alerts,
      } as ContentPreferences;
    },
    enabled: !!user?.id,
  });

  // Fetch communication preferences from user_notification_preferences table
  const { data: commPrefs, isLoading: commLoading } = useQuery({
    queryKey: ["notification-preferences-communication", user?.id],
    queryFn: async () => {
      if (!user?.id) return DEFAULT_COMMUNICATION;

      const { data, error } = await (supabase
        .from("user_notification_preferences" as any) as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) return DEFAULT_COMMUNICATION;

      return {
        push_notifications: data.push_notifications ?? DEFAULT_COMMUNICATION.push_notifications,
        email_digests: data.email_digests ?? DEFAULT_COMMUNICATION.email_digests,
        digest_frequency: data.digest_frequency ?? DEFAULT_COMMUNICATION.digest_frequency,
        notification_sounds: data.notification_sounds ?? DEFAULT_COMMUNICATION.notification_sounds,
        quiet_hours_enabled: data.quiet_hours_enabled ?? DEFAULT_COMMUNICATION.quiet_hours_enabled,
        quiet_hours_start: data.quiet_hours_start ?? DEFAULT_COMMUNICATION.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end ?? DEFAULT_COMMUNICATION.quiet_hours_end,
        sound_volume_percent: data.sound_volume_percent ?? DEFAULT_COMMUNICATION.sound_volume_percent,
      } as CommunicationPreferences;
    },
    enabled: !!user?.id,
  });

  // Load UI preferences from localStorage
  const { data: uiPrefs } = useQuery({
    queryKey: ["notification-preferences-ui"],
    queryFn: () => {
      try {
        const stored = localStorage.getItem(UI_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_UI, ...parsed } as UIPreferences;
        }
      } catch (e) {
        console.error("Failed to load UI preferences:", e);
      }
      return DEFAULT_UI;
    },
  });

  // Update content preferences
  const updateContent = useMutation({
    mutationFn: async (updates: Partial<ContentPreferences>) => {
      if (!user?.id) throw new Error("Not authenticated");

      // A write that affects zero rows has no Supabase error. Upsert plus a
      // returned row makes a missing preference record or an RLS problem visible
      // instead of showing a false "saved" state in the UI.
      const { data, error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
        .select("user_id")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Preferences were not saved");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences-content"] });
      toast.success("Content preferences updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Update communication preferences
  const updateCommunication = useMutation({
    mutationFn: async (updates: Partial<CommunicationPreferences>) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await (supabase
        .from("user_notification_preferences" as any) as any)
        .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
        .select("user_id")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Communication preferences were not saved");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences-communication"] });
      toast.success("Communication preferences updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Update UI preferences (localStorage)
  const updateUI = useMutation({
    mutationFn: async (updates: Partial<UIPreferences>) => {
      const current = uiPrefs || DEFAULT_UI;
      const updated = { ...current, ...updates };
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences-ui"] });
      toast.success("Display preferences updated");
    },
    onError: () => {
      toast.error("Failed to update display preferences");
    },
  });

  return {
    preferences: {
      content: contentPrefs || DEFAULT_CONTENT,
      communication: commPrefs || DEFAULT_COMMUNICATION,
      ui: uiPrefs || DEFAULT_UI,
    },
    isLoading: contentLoading || commLoading,
    updateContent: updateContent.mutateAsync,
    updateCommunication: updateCommunication.mutateAsync,
    updateUI: updateUI.mutateAsync,
    isUpdating: updateContent.isPending || updateCommunication.isPending || updateUI.isPending,
  };
}
