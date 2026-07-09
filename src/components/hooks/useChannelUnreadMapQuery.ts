import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useChannelUnreadMapQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["channel-unread-map", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_channel_unread_map");
      if (error) throw error;
      const map = new Map<string, number>();
      let total = 0;
      for (const row of data || []) {
        const id = (row as { channel_id: string }).channel_id;
        const c = Number((row as { unread_count: number }).unread_count);
        map.set(id, c);
        total += c;
      }
      return { map, total };
    },
    enabled: !!user,
    staleTime: 12_000,
  });
}