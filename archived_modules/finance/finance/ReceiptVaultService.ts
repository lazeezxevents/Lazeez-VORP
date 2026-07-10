/**
 * Receipt Vault Service
 * Task 21.1: Create ReceiptVault service class
 * Requirements: 10.1, 10.2, 10.4, 10.9, 10.11
 * 
 * Provides centralized storage and management for financial receipts
 * with AI-powered data extraction and categorization.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  Receipt,
  ReceiptMetadata,
  ReceiptCategory,
  ReceiptQuery,
  ExtractedData,
  LinkedEntityType,
  ReceiptCategoryBreakdown,
} from "./types";

export class ReceiptVaultService {
  /**
   * Upload a receipt file to storage and create database record
   * Requirements: 10.1
   */
  async uploadReceipt(
    file: File,
    metadata: ReceiptMetadata
  ): Promise<Receipt> {
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.');
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('File size exceeds 10MB limit.');
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Generate unique file name
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${user.id}/${timestamp}_${sanitizedFileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Create database record
      const { data: receipt, error: dbError } = await supabase
        .from('finance_receipt_vault')
        .insert({
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
          category: metadata.category,
          subcategory: metadata.subcategory || null,
          status: 'pending',
          metadata: {
            originalMetadata: metadata,
          },
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('receipts').remove([fileName]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      return receipt as Receipt;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      throw error;
    }
  }

  /**
   * Extract receipt data using OCR and AI
   * Requirements: 10.4
   * Note: This method triggers the extraction process.
   * Actual OCR/AI processing is handled by ReceiptOCRService and ReceiptAIParser
   */
  async extractReceiptData(receiptId: string): Promise<ExtractedData | null> {
    try {
      // Fetch receipt record
      const { data: receipt, error } = await supabase
        .from('finance_receipt_vault')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error || !receipt) {
        throw new Error('Receipt not found');
      }

      // Return existing extracted data if already processed
      if (receipt.extracted_data && receipt.status === 'processed') {
        return receipt.extracted_data as ExtractedData;
      }

      // If pending, return null (extraction in progress)
      return null;
    } catch (error) {
      console.error('Error extracting receipt data:', error);
      throw error;
    }
  }

  /**
   * Categorize a receipt
   * Requirements: 10.2
   */
  async categorizeReceipt(
    receiptId: string,
    category: ReceiptCategory,
    subcategory?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('finance_receipt_vault')
        .update({
          category,
          subcategory: subcategory || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId);

      if (error) {
        throw new Error(`Failed to categorize receipt: ${error.message}`);
      }
    } catch (error) {
      console.error('Error categorizing receipt:', error);
      throw error;
    }
  }

  /**
   * Add tags to a receipt
   * Requirements: 10.9
   */
  async tagReceipt(receiptId: string, tags: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('finance_receipt_vault')
        .update({
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId);

      if (error) {
        throw new Error(`Failed to tag receipt: ${error.message}`);
      }
    } catch (error) {
      console.error('Error tagging receipt:', error);
      throw error;
    }
  }

  /**
   * Link receipt to a transaction, expense, delivery, or order
   * Requirements: 10.10
   */
  async linkToTransaction(
    receiptId: string,
    entityType: LinkedEntityType,
    entityId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('finance_receipt_vault')
        .update({
          linked_entityType: entityType,
          linked_entityId: entityId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId);

      if (error) {
        throw new Error(`Failed to link receipt: ${error.message}`);
      }
    } catch (error) {
      console.error('Error linking receipt:', error);
      throw error;
    }
  }

  /**
   * Search receipts with filters
   * Requirements: 10.11
   */
  async searchReceipts(query: ReceiptQuery): Promise<Receipt[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Use the database function for efficient searching
      const { data, error } = await supabase.rpc('search_receipts', {
        p_user_id: user.id,
        p_category: query.category || null,
        p_tags: query.tags || null,
        p_start_date: query.startDate || null,
        p_end_date: query.endDate || null,
        p_status: query.status || null,
        p_search_text: query.searchText || null,
      });

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return (data || []) as Receipt[];
    } catch (error) {
      console.error('Error searching receipts:', error);
      throw error;
    }
  }

  /**
   * Get receipts by category with breakdown
   * Requirements: 10.11
   */
  async getReceiptsByCategory(
    startDate?: string,
    endDate?: string
  ): Promise<ReceiptCategoryBreakdown[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('get_receipts_by_category', {
        p_user_id: user.id,
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) {
        throw new Error(`Failed to get category breakdown: ${error.message}`);
      }

      return (data || []) as ReceiptCategoryBreakdown[];
    } catch (error) {
      console.error('Error getting receipts by category:', error);
      throw error;
    }
  }

  /**
   * Get a single receipt by ID
   */
  async getReceipt(receiptId: string): Promise<Receipt | null> {
    try {
      const { data, error } = await supabase
        .from('finance_receipt_vault')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to get receipt: ${error.message}`);
      }

      return data as Receipt;
    } catch (error) {
      console.error('Error getting receipt:', error);
      throw error;
    }
  }

  /**
   * Delete a receipt (only if pending status)
   */
  async deleteReceipt(receiptId: string): Promise<void> {
    try {
      // Get receipt to check status and file path
      const receipt = await this.getReceipt(receiptId);
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      if (receipt.status !== 'pending') {
        throw new Error('Only pending receipts can be deleted');
      }

      // Extract file path from URL
      const urlParts = receipt.file_url.split('/receipts/');
      if (urlParts.length < 2) {
        throw new Error('Invalid file URL');
      }
      const filePath = urlParts[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('receipts')
        .remove([filePath]);

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('finance_receipt_vault')
        .delete()
        .eq('id', receiptId);

      if (dbError) {
        throw new Error(`Failed to delete receipt: ${dbError.message}`);
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
      throw error;
    }
  }

  /**
   * Update receipt processing status
   * Used by OCR/AI services to update extraction results
   */
  async updateProcessingStatus(
    receiptId: string,
    status: 'pending' | 'processed' | 'verified' | 'failed',
    extractedData?: ExtractedData,
    confidenceScore?: number,
    error?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (extractedData) {
        updateData.extracted_data = extractedData;
      }

      if (confidenceScore !== undefined) {
        updateData.confidence_score = confidenceScore;
      }

      if (error) {
        updateData.processing_error = error;
      }

      const { error: dbError } = await supabase
        .from('finance_receipt_vault')
        .update(updateData)
        .eq('id', receiptId);

      if (dbError) {
        throw new Error(`Failed to update processing status: ${dbError.message}`);
      }
    } catch (error) {
      console.error('Error updating processing status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const receiptVaultService = new ReceiptVaultService();
