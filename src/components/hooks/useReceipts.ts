import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptVault } from "@/services/ReceiptVault";
import { Receipt } from "@/types/receipt";
import { toast } from "sonner";

/**
 * Fetch all receipts
 */
export function useReceipts(filters?: {
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["receipts", filters],
    queryFn: async () => {
      let query = supabase
        .from("finance_receipt_vault")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }

      if (filters?.status) {
        query = query.eq("processing_status", filters.status);
      }

      if (filters?.startDate) {
        query = query.gte("uploaded_at", filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte("uploaded_at", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Receipt[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch a single receipt
 */
export function useReceipt(receiptId: string) {
  return useQuery({
    queryKey: ["receipts", receiptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_receipt_vault")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (error) throw error;
      return data as Receipt;
    },
    enabled: !!receiptId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Upload a receipt
 */
export function useUploadReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      category,
      tags,
    }: {
      file: File;
      category: "riders" | "vendors" | "general";
      tags?: string[];
    }) => {
      return await ReceiptVault.uploadReceipt(file, category, tags);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload receipt: ${error.message}`);
    },
  });
}

/**
 * Update receipt data
 */
export function useUpdateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      updates,
    }: {
      receiptId: string;
      updates: Partial<Receipt>;
    }) => {
      const { data, error } = await supabase
        .from("finance_receipt_vault")
        .update(updates)
        .eq("id", receiptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipts", data.id] });
      toast.success("Receipt updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update receipt: ${error.message}`);
    },
  });
}

/**
 * Link receipt to entity
 */
export function useLinkReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      entityType,
      entityId,
    }: {
      receiptId: string;
      entityType: string;
      entityId: string;
    }) => {
      return await ReceiptVault.linkToEntity(receiptId, entityType, entityId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["receipts", variables.receiptId] });
      toast.success("Receipt linked successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link receipt: ${error.message}`);
    },
  });
}

/**
 * Delete a receipt
 */
export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      // Get receipt to find file path
      const { data: receipt } = await supabase
        .from("finance_receipt_vault")
        .select("file_path")
        .eq("id", receiptId)
        .single();

      if (receipt?.file_path) {
        // Delete file from storage
        await supabase.storage.from("receipts").remove([receipt.file_path]);
      }

      // Delete database record
      const { error } = await supabase.from("finance_receipt_vault").delete().eq("id", receiptId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete receipt: ${error.message}`);
    },
  });
}

/**
 * Search receipts
 */
export function useSearchReceipts(searchTerm: string) {
  return useQuery({
    queryKey: ["receipts", "search", searchTerm],
    queryFn: async () => {
      return await ReceiptVault.searchReceipts(searchTerm);
    },
    enabled: searchTerm.length >= 3,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Get receipts by category
 */
export function useReceiptsByCategory(category: "riders" | "vendors" | "general") {
  return useQuery({
    queryKey: ["receipts", "category", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_receipt_vault")
        .select("*")
        .eq("category", category)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data as Receipt[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get receipts needing manual review
 */
export function useReceiptsNeedingReview() {
  return useQuery({
    queryKey: ["receipts", "needs-review"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_receipt_vault")
        .select("*")
        .eq("processing_status", "needs_review")
        .order("uploaded_at", { ascending: true });

      if (error) throw error;
      return data as Receipt[];
    },
    staleTime: 1 * 60 * 1000,
  });
}
