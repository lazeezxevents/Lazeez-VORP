import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VendorRemark {
  id: string;
  vendor_id: string;
  remark: string;
  remark_type: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export function useVendorRemarks(vendorId: string) {
  return useQuery({
    queryKey: ["vendor-remarks", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_remarks")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const creatorIds = [...new Set(data.map(r => r.created_by).filter(Boolean))];
      let profiles: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", creatorIds);
        
        profileData?.forEach(p => {
          profiles[p.id] = p.full_name || p.email;
        });
      }

      return data.map(remark => ({
        ...remark,
        created_by_name: remark.created_by ? profiles[remark.created_by] || null : null,
      })) as VendorRemark[];
    },
    enabled: !!vendorId,
  });
}

export function useCreateRemark() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      vendor_id: string;
      remark: string;
      remark_type?: string;
    }) => {
      const { data, error } = await supabase
        .from("vendor_remarks")
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-remarks", data.vendor_id] });
      toast.success("Remark added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add remark: ${error.message}`);
    },
  });
}

export function useDeleteRemark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the remark to know the vendor_id
      const { data: remark } = await supabase
        .from("vendor_remarks")
        .select("vendor_id")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("vendor_remarks")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return remark?.vendor_id;
    },
    onSuccess: (vendorId) => {
      if (vendorId) {
        queryClient.invalidateQueries({ queryKey: ["vendor-remarks", vendorId] });
      }
      toast.success("Remark deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete remark: ${error.message}`);
    },
  });
}
