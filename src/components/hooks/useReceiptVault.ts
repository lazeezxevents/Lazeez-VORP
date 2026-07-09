import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceiptVault } from "@/services/ReceiptVault";
import type { Receipt, ReceiptFilters, ReceiptCategory } from "@/types/receipt";
import { toast } from "sonner";

export const useReceiptVault = () => {
  const queryClient = useQueryClient();

  // Fetch receipts with filters
  const useReceipts = (filters?: ReceiptFilters) => {
    return useQuery({
      queryKey: ["receipts", filters],
      queryFn: () => ReceiptVault.searchReceipts(filters || {}),
      staleTime: 30000, // 30 seconds
    });
  };

  // Fetch single receipt
  const useReceipt = (receiptId: string) => {
    return useQuery({
      queryKey: ["receipt", receiptId],
      queryFn: () => ReceiptVault.getReceipt(receiptId),
      enabled: !!receiptId,
    });
  };

  // Upload receipt mutation
  const uploadReceipt = useMutation({
    mutationFn: async ({
      file,
      category,
      uploadedBy,
      metadata,
    }: {
      file: File;
      category: ReceiptCategory;
      uploadedBy: string;
      metadata?: {
        subcategory?: string;
        notes?: string;
        linked_entity_type?: string;
        linked_entity_id?: string;
      };
    }) => {
      return ReceiptVault.uploadReceipt(file, category, uploadedBy, metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload receipt: ${error.message}`);
    },
  });

  // Extract receipt data mutation
  const extractReceiptData = useMutation({
    mutationFn: (receiptId: string) => ReceiptVault.extractReceiptData(receiptId),
    onSuccess: (_, receiptId) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt data extracted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to extract receipt data: ${error.message}`);
    },
  });

  // Update receipt mutation
  const updateReceipt = useMutation({
    mutationFn: ({ receiptId, updates }: { receiptId: string; updates: Partial<Receipt> }) => {
      return ReceiptVault.updateReceipt(receiptId, updates);
    },
    onSuccess: (_, { receiptId }) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update receipt: ${error.message}`);
    },
  });

  // Delete receipt mutation
  const deleteReceipt = useMutation({
    mutationFn: (receiptId: string) => ReceiptVault.deleteReceipt(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt archived successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive receipt: ${error.message}`);
    },
  });

  // Link receipt mutation
  const linkReceipt = useMutation({
    mutationFn: ({
      receiptId,
      entityType,
      entityId,
    }: {
      receiptId: string;
      entityType: string;
      entityId: string;
    }) => {
      return ReceiptVault.linkReceipt(receiptId, entityType, entityId);
    },
    onSuccess: (_, { receiptId }) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Receipt linked successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to link receipt: ${error.message}`);
    },
  });

  // Get linked receipts
  const useLinkedReceipts = (entityType: string, entityId: string) => {
    return useQuery({
      queryKey: ["linked-receipts", entityType, entityId],
      queryFn: () => ReceiptVault.getLinkedReceipts(entityType, entityId),
      enabled: !!entityType && !!entityId,
    });
  };

  // Add asset tags mutation
  const addAssetTags = useMutation({
    mutationFn: ({
      receiptId,
      assetTags,
    }: {
      receiptId: string;
      assetTags: {
        asset_type?: "tangible" | "intangible";
        asset_classification?: "fixed" | "current";
        depreciation_period?: number;
        custom_tags?: string[];
      };
    }) => {
      return ReceiptVault.addAssetTags(receiptId, assetTags);
    },
    onSuccess: (_, { receiptId }) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Asset tags added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add asset tags: ${error.message}`);
    },
  });

  // Auto-tag asset mutation
  const autoTagAsset = useMutation({
    mutationFn: (receiptId: string) => ReceiptVault.autoTagAsset(receiptId),
    onSuccess: (_, receiptId) => {
      queryClient.invalidateQueries({ queryKey: ["receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success("Asset auto-tagged successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to auto-tag asset: ${error.message}`);
    },
  });

  return {
    useReceipts,
    useReceipt,
    uploadReceipt,
    extractReceiptData,
    updateReceipt,
    deleteReceipt,
    linkReceipt,
    useLinkedReceipts,
    addAssetTags,
    autoTagAsset,
  };
};
