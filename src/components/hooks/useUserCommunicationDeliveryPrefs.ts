import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DigestFrequency = "immediate" | "hourly" | "daily" | "never";

export type UserCommunicationDeliveryPrefs = {
  user_id: string;
  push_notifications: boolean;
  email_digests: boolean;
  digest_frequency: DigestFrequency;
  notification_sounds: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  sound_volume_percent: number;
};

const DEFAULTS: Omit<UserCommunicationDeliveryPrefs, "user_id"> = {
  push_notifications: true,
  email_digests: true,
  digest_frequency: "daily",
  notification_sounds: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  sound_volume_percent: 40,
};

const DIGEST_FREQUENCIES: DigestFrequency[] = ["immediate", "hourly", "daily", "never"];

function normalizeDigestFrequency(v: unknown): DigestFrequency {
  return typeof v === "string" && DIGEST_FREQUENCIES.includes(v as DigestFrequency)
    ? (v as DigestFrequency)
    : DEFAULTS.digest_frequency;
}

function clampPercent(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULTS.sound_volume_percent;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function useUserCommunicationDeliveryPrefs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-communication-delivery-prefs", user?.id],
    queryFn: async (): Promise<UserCommunicationDeliveryPrefs | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return {
          user_id: user.id,
          ...DEFAULTS,
        };
      }

      return {
        user_id: data.user_id,
        push_notifications: data.push_notifications ?? DEFAULTS.push_notifications,
        email_digests: data.email_digests ?? DEFAULTS.email_digests,
        digest_frequency: normalizeDigestFrequency(data.digest_frequency),
        notification_sounds: data.notification_sounds ?? DEFAULTS.notification_sounds,
        quiet_hours_enabled: data.quiet_hours_enabled ?? DEFAULTS.quiet_hours_enabled,
        quiet_hours_start: data.quiet_hours_start || DEFAULTS.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end || DEFAULTS.quiet_hours_end,
        sound_volume_percent: clampPercent(
          (data as { sound_volume_percent?: number }).sound_volume_percent
        ),
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_500 * 2 ** attempt, 10_000),
  });
}

export function useUpsertUserCommunicationDeliveryPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (next: Omit<UserCommunicationDeliveryPrefs, "user_id">) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("user_notification_preferences").upsert(
        {
          user_id: user.id,
          push_notifications: next.push_notifications,
          email_digests: next.email_digests,
          digest_frequency: next.digest_frequency,
          notification_sounds: next.notification_sounds,
          quiet_hours_enabled: next.quiet_hours_enabled,
          quiet_hours_start: next.quiet_hours_start,
          quiet_hours_end: next.quiet_hours_end,
          sound_volume_percent: next.sound_volume_percent,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-communication-delivery-prefs"] });
    },
  });
}
