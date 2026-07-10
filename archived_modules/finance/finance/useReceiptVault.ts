/**
 * Receipt Vault React Hook
 * TanStack Query hook for receipt vault operations
 * Requirements: 10.1, 10.2, 10.4, 10.9, 10.10, 10.11
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { receiptVaultService } from "./ReceiptVaultService";
import { receiptOCRService } from "./ReceiptOCRService";
import { receiptAIParser } from "./ReceiptAIParser";
import type {
  Receipt,
  ReceiptMetadata,
  ReceiptCategory,
  ReceiptQuery,
  LinkedEntityType,
  ReceiptCategoryBreakdown,
} from "./types";

const QUERY_KEYS = {
  receipts: ['receipts'] as const,
  receipt: (id: string) => ['receipts', id] as const,
  search: (query: ReceiptQuery) => ['receipts', 'search', query] as const,
  categoryBreakdown: (startDate?: string, endDate?: string) => 
    ['receipts', 'category-breakdown', startDate, endDate] as const,
};

/**
 * Hook to fetch all receipts with optional search
 */
export function useReceiptVault(query?: ReceiptQuery) {
  return useQuery({
    queryKey: query ? QUERY_KEYS.search(query) : QUERY_KEYS.receipts,
    queryFn: async () => {
      if (query) {
        return await receiptVaultService.searchReceipts(query);
      }
      // Fetch all receipts
      return await receiptVaultService.searchReceipts({});
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single receipt by ID
 */
export function useReceipt(receiptId: string | undefined) {
  return useQuery({
    queryKey: receiptId ? QUERY_KEYS.receipt(receiptId) : ['receipts', 'none'],
    queryFn: async () => {
      if (!receiptId) return null;
      return await receiptVaultService.getReceipt(receiptId);
    },
    enabled: !!receiptId,
  });
}

/**
 * Hook to fetch category breakdown
 */
export function useReceiptCategoryBreakdown(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.categoryBreakdown(startDate, endDate),
    queryFn: async () => {
      return await receiptVaultService.getReceiptsByCategory(startDate, endDate);
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to upload receipt with OCR and AI extraction
 */
export function useUploadReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      metadata,
    }: {
      file: File;
      metadata: ReceiptMetadata;
    }) => {
      // Step 1: Upload receipt
      const receipt = await receiptVaultService.uploadReceipt(file, metadata);

      // Step 2: Perform OCR extraction (async, don't block)
      processReceiptExtraction(receipt.id, file).catch((error) => {
        console.error('Background OCR processing failed:', error);
      });

      return receipt;
    },
    onSuccess: (receipt) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.categoryBreakdown() 
      });

      toast.success('Receipt uploaded successfully', {
        description: 'Processing receipt data in background...',
      });
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      toast.error('Failed to upload receipt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Background processing function for OCR and AI extraction
 */
async function processReceiptExtraction(receiptId: string, file: File) {
  try {
    // Only process images (skip PDFs for now)
    if (!file.type.startsWith('image/')) {
      await receiptVaultService.updateProcessingStatus(
        receiptId,
        'processed',
        { confidence: 0 },
        0
      );
      return;
    }

    // Step 1: OCR extraction
    const ocrResult = await receiptOCRService.extractTextFromFile(file);

    if (!ocrResult.success || !ocrResult.text) {
      await receiptVaultService.updateProcessingStatus(
        receiptId,
        'failed',
        undefined,
        undefined,
        ocrResult.error || 'OCR extraction failed'
      );
      return;
    }

    // Step 2: AI parsing
    const extractedData = await receiptAIParser.parseReceiptData(
      ocrResult.text,
      ocrResult.confidence
    );

    // Step 3: Determine status based on confidence
    const status = receiptAIParser.getProcessingStatus(extractedData.confidence);

    // Step 4: Update receipt with extracted data
    await receiptVaultService.updateProcessingStatus(
      receiptId,
      status,
      extractedData,
      extractedData.confidence
    );

    console.log(`Receipt ${receiptId} processed with confidence: ${extractedData.confidence}%`);
  } catch (error) {
    console.error('Receipt extraction failed:', error);
    await receiptVaultService.updateProcessingStatus(
      receiptId,
      'failed',
      undefined,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

/**
 * Hook to categorize receipt
 */
export function useCategorizeReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      category,
      subcategory,
    }: {
      receiptId: string;
      category: ReceiptCategory;
      subcategory?: string;
    }) => {
      await receiptVaultService.categorizeReceipt(receiptId, category, subcategory);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.receipt(variables.receiptId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.categoryBreakdown() 
      });

      toast.success('Receipt categorized successfully');
    },
    onError: (error) => {
      toast.error('Failed to categorize receipt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook to tag receipt
 */
export function useTagReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      receiptId,
      tags,
    }: {
      receiptId: string;
      tags: string[];
    }) => {
      await receiptVaultService.tagReceipt(receiptId, tags);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.receipt(variables.receiptId) 
      });

      toast.success('Receipt tagged successfully');
    },
    onError: (error) => {
      toast.error('Failed to tag receipt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook to link receipt to entity
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
      entityType: LinkedEntityType;
      entityId: string;
    }) => {
      await receiptVaultService.linkToTransaction(receiptId, entityType, entityId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.receipt(variables.receiptId) 
      });

      toast.success('Receipt linked successfully');
    },
    onError: (error) => {
      toast.error('Failed to link receipt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}

/**
 * Hook to delete receipt
 */
export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptId: string) => {
      await receiptVaultService.deleteReceipt(receiptId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.receipts });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.categoryBreakdown() 
      });

      toast.success('Receipt deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete receipt', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
}
