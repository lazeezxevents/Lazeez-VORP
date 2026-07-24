import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type VendorStatus = "onboarded" | "terminated" | "left" | "pending" | "new" | "active" | "inactive" | "blacklisted" | "legacy";
export type VendorCategory = "catering" | "decoration" | "photography" | "entertainment" | "venue" | "logistics" | "other" | "home_chef" | "home_baker" | "bakery" | "restaurant";

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  rating: number | null;
  description: string | null;
  logo_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Owner & Business fields
  owner_name: string | null;
  owner_cnic: string | null;
  commission_percentage: number | null;
  subscription_amount: number | null;
  subscription_after_orders: number | null;
  sticker_status: string | null;
  notes: string | null;
  // Bank details
  bank_title: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
}

export interface CreateVendorInput {
  name: string;
  category: VendorCategory;
  status?: VendorStatus;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  rating?: number;
  description?: string;
  owner_name?: string;
  owner_cnic?: string;
  commission_percentage?: number;
  subscription_amount?: number;
  subscription_after_orders?: number;
  sticker_status?: string;
  notes?: string;
  bank_title?: string;
  bank_account_number?: string;
  bank_name?: string;
}

export function useVendors(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Vendor[];
    },
    enabled: (options?.enabled ?? true) && !!user,
  });
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: ["vendors", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as Vendor | null;
    },
    enabled: !!id,
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateVendorInput) => {
      const { data, error } = await supabase
        .from("vendors")
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create vendor: ${error.message}`);
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Vendor> & { id: string }) => {
      const { data, error } = await supabase
        .from("vendors")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendors", data.id] });
      toast.success("Vendor updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update vendor: ${error.message}`);
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete vendor: ${error.message}`);
    },
  });
}


// Vendor KPI and Stats hooks
export function useVendorStats(vendorId: string) {
  return useQuery({
    queryKey: ["vendor-stats", vendorId],
    queryFn: async () => {
      // Get issues count and stats
      const { data: issues, error: issuesError } = await supabase
        .from("issues")
        .select("id, status, priority, created_at, resolved_at")
        .eq("vendor_id", vendorId);

      if (issuesError) throw issuesError;

      // Get MOU Vault documents count
      const { data: mouVault, error: mouVaultError } = await supabase
        .from("mou_vault")
        .select("id, extraction_status, effective_end_date, created_at")
        .eq("vendor_id", vendorId);

      if (mouVaultError) throw mouVaultError;

      // Get assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from("employee_vendor_assignments")
        .select("id")
        .eq("vendor_id", vendorId);

      if (assignmentsError) throw assignmentsError;

      // Calculate stats
      const totalIssues = issues?.length || 0;
      const openIssues = issues?.filter(i => i.status === "open" || i.status === "in_progress").length || 0;
      const resolvedIssues = issues?.filter(i => i.status === "resolved" || i.status === "closed").length || 0;
      const criticalIssues = issues?.filter(i => i.priority === "critical").length || 0;

      // Calculate average resolution time
      const resolvedWithTime = issues?.filter(i => i.resolved_at) || [];
      const avgResolutionTime = resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((acc, i) => {
          const created = new Date(i.created_at).getTime();
          const resolved = new Date(i.resolved_at!).getTime();
          return acc + (resolved - created);
        }, 0) / resolvedWithTime.length / (1000 * 60 * 60 * 24) // in days
        : 0;


      const resolutionRate = totalIssues > 0 ? (resolvedIssues / totalIssues) : 1;

      // Calculate MOU stats from vault
      const now = new Date();
      const totalMous = mouVault?.length || 0;
      const activeMous = mouVault?.filter(m => {
        if (!m.effective_end_date) return true;
        return new Date(m.effective_end_date) > now;
      }).length || 0;

      return {
        totalIssues,
        openIssues,
        resolvedIssues,
        criticalIssues,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
        totalMous,
        activeMous,
        assignedEmployees: assignments?.length || 0,
        resolutionRate: Math.round(resolutionRate * 100),
      };
    },
    enabled: !!vendorId,
  });
}
