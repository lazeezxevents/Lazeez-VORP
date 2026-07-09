import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useChannelMuteSet() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["channel-mutes", user?.id],
    queryFn: async (): Promise<Set<string>> => {
      if (!user) return new Set();
      const { data, error } = await supabase.from("channel_mutes").select("channel_id");
      if (error) throw error;
      return new Set((data || []).map((r) => r.channel_id as string));
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useToggleChannelMute() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, mute }: { channelId: string; mute: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (mute) {
        const { error } = await supabase.from("channel_mutes").insert({
          channel_id: channelId,
          user_id: user.id,
        });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase
          .from("channel_mutes")
          .delete()
          .eq("channel_id", channelId)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["channel-mutes"] });
    },
  });
}
