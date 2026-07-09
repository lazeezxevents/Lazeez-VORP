import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MOU {
    id: string;
    vendor_id: string;
    title: string;
    status: "draft" | "pending_review" | "approved" | "signed" | "expired" | "terminated" | "legacy";
    start_date: string | null;
    end_date: string | null;
    terms: string | null;
    document_url: string | null;
    created_at: string;
    vendor?: { name: string } | null;
}

export function useMOUs() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: mous = [], isLoading } = useQuery({
        queryKey: ["mous"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("mous")
                .select("*, vendor:vendors(name)")
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as MOU[];
        },
    });

    const createMOU = useMutation({
        mutationFn: async (input: Partial<MOU>) => {
            const { data, error } = await supabase
                .from("mous")
                .insert({ ...input, created_by: user?.id })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mous"] });
            toast.success("MOU created successfully");
        },
    });

    const updateMOU = useMutation({
        mutationFn: async ({ id, ...input }: Partial<MOU> & { id: string }) => {
            const { data, error } = await supabase
                .from("mous")
                .update(input)
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mous"] });
        },
    });

    const approveMOU = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from("mous")
                .update({ status: "approved", approved_by: user?.id })
                .eq("id", id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mous"] });
            toast.success("MOU approved");
        },
    });

    const signMOU = useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from("mous")
                .update({ status: "signed" })
                .eq("id", id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mous"] });
            toast.success("MOU marked as signed");
        },
    });

    const deleteMOU = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("mous").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["mous"] });
            toast.success("MOU deleted");
        },
    });

    return { mous, isLoading, createMOU, updateMOU, approveMOU, signMOU, deleteMOU };
}
