import { supabase } from "@/integrations/supabase/client";
import { ReceiptParser } from "./ReceiptParser";
import type {
  Receipt,
  CreateReceiptInput,
  UpdateReceiptInput,
  ReceiptFilters,
  ExtractedData,
  ReceiptCategory,
  ReceiptStatus,
} from "@/types/receipt";

export class ReceiptVault {
  private static readonly BUCKET_NAME = "receipts";
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];

  /**
   * Upload a receipt file to storage and create database record
   */
  static async uploadReceipt(
    file: File,
    category: ReceiptCategory,
    uploadedBy: string,
    metadata?: {
      subcategory?: string;
      notes?: string;
      linked_entity_type?: string;
      linked_entity_id?: string;
    }
  ): Promise<Receipt> {
    // Input validation
    if (!file) {
      throw new Error("File is required");
    }

    if (!category || !["riders", "vendors", "general"].includes(category)) {
      throw new Error("Valid category is required (riders, vendors, or general)");
    }

    if (!uploadedBy || uploadedBy.trim().length === 0) {
      throw new Error("Uploaded by user ID is required");
    }

    if (metadata?.notes && metadata.notes.length > 1000) {
      throw new Error("Notes cannot exceed 1000 characters");
    }

    if (metadata?.subcategory && metadata.subcategory.length > 100) {
      throw new Error("Subcategory cannot exceed 100 characters");
    }

    // Validate file
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (!this.ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed. Allowed types: ${this.ALLOWED_TYPES.join(", ")}`);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${category}/${uploadedBy}/${timestamp}_${sanitizedFileName}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Create database record
    const receiptData: CreateReceiptInput = {
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      file_type: file.type,
      category,
      subcategory: metadata?.subcategory,
      status: "pending",
      uploaded_by: uploadedBy,
      notes: metadata?.notes,
      linked_entity_type: metadata?.linked_entity_type,
      linked_entity_id: metadata?.linked_entity_id,
    };

    const { data: receipt, error: dbError } = await supabase
      .from("finance_receipt_vault")
      .insert(receiptData)
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file if database insert fails
      await supabase.storage.from(this.BUCKET_NAME).remove([uploadData.path]);
      throw new Error(`Failed to create receipt record: ${dbError.message}`);
    }

    return receipt as Receipt;
  }

  /**
   * Extract data from receipt using OCR and AI
   */
  static async extractReceiptData(receiptId: string): Promise<ExtractedData> {
    // Input validation
    if (!receiptId || receiptId.trim().length === 0) {
      throw new Error("Receipt ID is required");
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(receiptId)) {
      throw new Error("Invalid receipt ID format");
    }

    // Get receipt record
    const { data: receipt, error: fetchError } = await supabase
      .from("finance_receipt_vault")
      .select("*")
      .eq("id", receiptId)
      .single();

    if (fetchError || !receipt) {
      throw new Error(`Failed to fetch receipt: ${fetchError?.message || "Receipt not found"}`);
    }

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(this.BUCKET_NAME)
      .download(receipt.file_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message || "File not found"}`);
    }

    // Convert blob to file
    const file = new File([fileData], receipt.file_name, { type: receipt.file_type });

    // Parse receipt using OCR and AI
    const parsedData = await ReceiptParser.parseReceipt(file);

    // Determine status based on confidence and validation
    const needsReview = ReceiptParser.needsManualReview(parsedData);
    const newStatus: ReceiptStatus = needsReview ? "manual_review" : "processed";

    // Update receipt with extracted data
    await this.updateReceipt(receiptId, {
      extracted_data: parsedData,
      status: newStatus,
      processed_at: new Date().toISOString(),
    });

    return parsedData;
  }

  /**
   * Categorize receipt based on content and metadata
   */
  static async categorizeReceipt(
    receiptId: string,
    category: ReceiptCategory,
    subcategory?: string
  ): Promise<void> {
    // Input validation
    if (!receiptId || receiptId.trim().length === 0) {
      throw new Error("Receipt ID is required");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(receiptId)) {
      throw new Error("Invalid receipt ID format");
    }

    if (!category || !["riders", "vendors", "general"].includes(category)) {
      throw new Error("Valid category is required (riders, vendors, or general)");
    }

    if (subcategory && subcategory.length > 100) {
      throw new Error("Subcategory cannot exceed 100 characters");
    }

    const { error } = await supabase
      .from("finance_receipt_vault")
      .update({
        category,
        subcategory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (error) {
      throw new Error(`Failed to categorize receipt: ${error.message}`);
    }
  }

  /**
   * Search receipts with filters
   */
  static async searchReceipts(filters: ReceiptFilters): Promise<Receipt[]> {
    let query = supabase.from("finance_receipt_vault").select("*");

    // Apply filters
    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.date_from) {
      query = query.gte("uploaded_at", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("uploaded_at", filters.date_to);
    }

    if (filters.linked_entity_type) {
      query = query.eq("linked_entity_type", filters.linked_entity_type);
    }

    if (filters.linked_entity_id) {
      query = query.eq("linked_entity_id", filters.linked_entity_id);
    }

    if (filters.search_query) {
      query = query.or(
        `file_name.ilike.%${filters.search_query}%,notes.ilike.%${filters.search_query}%`
      );
    }

    // Apply amount filters if extracted_data exists
    if (filters.min_amount !== undefined) {
      query = query.gte("extracted_data->total_amount", filters.min_amount);
    }

    if (filters.max_amount !== undefined) {
      query = query.lte("extracted_data->total_amount", filters.max_amount);
    }

    // Order by upload date descending
    query = query.order("uploaded_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search receipts: ${error.message}`);
    }

    return (data as Receipt[]) || [];
  }

  /**
   * Get receipt by ID
   */
  static async getReceipt(receiptId: string): Promise<Receipt> {
    const { data, error } = await supabase
      .from("finance_receipt_vault")
      .select("*")
      .eq("id", receiptId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to fetch receipt: ${error?.message || "Receipt not found"}`);
    }

    return data as Receipt;
  }

  /**
   * Update receipt
   */
  static async updateReceipt(receiptId: string, updates: Partial<UpdateReceiptInput>): Promise<Receipt> {
    const { data, error } = await supabase
      .from("finance_receipt_vault")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update receipt: ${error?.message || "Receipt not found"}`);
    }

    return data as Receipt;
  }

  /**
   * Delete receipt (soft delete by archiving)
   */
  static async deleteReceipt(receiptId: string): Promise<void> {
    const { error } = await supabase
      .from("finance_receipt_vault")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (error) {
      throw new Error(`Failed to delete receipt: ${error.message}`);
    }
  }

  /**
   * Get receipt file URL
   */
  static async getReceiptFileUrl(filePath: string): Promise<string> {
    const { data } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(filePath);

    if (!data) {
      throw new Error("Failed to get file URL");
    }

    return data.publicUrl;
  }

  /**
   * Link receipt to an entity (transaction, expense, order)
   */
  static async linkReceipt(
    receiptId: string,
    entityType: string,
    entityId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("finance_receipt_vault")
      .update({
        linked_entity_type: entityType,
        linked_entity_id: entityId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (error) {
      throw new Error(`Failed to link receipt: ${error.message}`);
    }
  }

  /**
   * Get receipts linked to an entity
   */
  static async getLinkedReceipts(entityType: string, entityId: string): Promise<Receipt[]> {
    const { data, error } = await supabase
      .from("finance_receipt_vault")
      .select("*")
      .eq("linked_entity_type", entityType)
      .eq("linked_entity_id", entityId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch linked receipts: ${error.message}`);
    }

    return (data as Receipt[]) || [];
  }

  /**
   * Add asset tags to receipt
   */
  static async addAssetTags(
    receiptId: string,
    assetTags: {
      asset_type?: "tangible" | "intangible";
      asset_classification?: "fixed" | "current";
      depreciation_period?: number;
      custom_tags?: string[];
    }
  ): Promise<void> {
    const { error } = await supabase
      .from("finance_receipt_vault")
      .update({
        asset_tags: assetTags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    if (error) {
      throw new Error(`Failed to add asset tags: ${error.message}`);
    }
  }

  /**
   * Auto-categorize receipt based on extracted data and amount
   */
  static async autoTagAsset(receiptId: string): Promise<void> {
    const receipt = await this.getReceipt(receiptId);

    if (!receipt.extracted_data?.total_amount) {
      return; // Cannot auto-tag without amount
    }

    const amount = receipt.extracted_data.total_amount;
    const merchantName = receipt.extracted_data.merchant_name?.toLowerCase() || "";

    // Heuristics for asset classification
    let assetType: "tangible" | "intangible" | undefined;
    let assetClassification: "fixed" | "current" | undefined;
    let depreciationPeriod: number | undefined;

    // Tangible asset keywords
    const tangibleKeywords = ["equipment", "furniture", "vehicle", "computer", "laptop", "hardware"];
    // Intangible asset keywords
    const intangibleKeywords = ["software", "license", "subscription", "domain", "patent"];

    // Check for asset type
    if (tangibleKeywords.some((keyword) => merchantName.includes(keyword))) {
      assetType = "tangible";
    } else if (intangibleKeywords.some((keyword) => merchantName.includes(keyword))) {
      assetType = "intangible";
    }

    // Classify based on amount (simplified rule)
    // Fixed assets: typically > 50,000 PKR with useful life > 1 year
    // Current assets: < 50,000 PKR or consumables
    if (amount > 50000) {
      assetClassification = "fixed";
      depreciationPeriod = assetType === "tangible" ? 60 : 36; // 5 years for tangible, 3 years for intangible
    } else {
      assetClassification = "current";
    }

    // Only update if we determined asset type
    if (assetType) {
      await this.addAssetTags(receiptId, {
        asset_type: assetType,
        asset_classification: assetClassification,
        depreciation_period: depreciationPeriod,
      });
    }
  }

  /**
   * Get receipts by asset classification
   */
  static async getReceiptsByAssetType(
    assetType: "tangible" | "intangible",
    assetClassification?: "fixed" | "current"
  ): Promise<Receipt[]> {
    let query = supabase
      .from("finance_receipt_vault")
      .select("*")
      .eq("asset_tags->asset_type", assetType);

    if (assetClassification) {
      query = query.eq("asset_tags->asset_classification", assetClassification);
    }

    query = query.order("uploaded_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch receipts by asset type: ${error.message}`);
    }

    return (data as Receipt[]) || [];
  }
}
