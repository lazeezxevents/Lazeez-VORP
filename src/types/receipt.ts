import { z } from "zod";

// Receipt categories
export type ReceiptCategory = "riders" | "vendors" | "general";

// Receipt status
export type ReceiptStatus = "pending" | "processed" | "manual_review" | "archived";

// Asset tag types
export type AssetType = "tangible" | "intangible";
export type AssetClassification = "fixed" | "current";

// Extracted data from receipt
export interface ExtractedData {
  merchant_name?: string;
  merchant_address?: string;
  transaction_date?: string;
  total_amount?: number;
  tax_amount?: number;
  currency?: string;
  line_items?: LineItem[];
  payment_method?: string;
  invoice_number?: string;
  confidence_score: number;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
}

// Asset tags for receipts
export interface AssetTags {
  asset_type?: AssetType;
  asset_classification?: AssetClassification;
  depreciation_period?: number;
  custom_tags?: string[];
}

// Main receipt interface
export interface Receipt {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: ReceiptCategory;
  subcategory?: string;
  status: ReceiptStatus;
  extracted_data?: ExtractedData;
  asset_tags?: AssetTags;
  linked_entity_type?: string;
  linked_entity_id?: string;
  uploaded_by: string;
  uploaded_at: string;
  processed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Zod schemas for validation
export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().positive().optional(),
  unit_price: z.number().nonnegative().optional(),
  amount: z.number().nonnegative("Amount must be non-negative"),
});

export const extractedDataSchema = z.object({
  merchant_name: z.string().optional(),
  merchant_address: z.string().optional(),
  transaction_date: z.string().optional(),
  total_amount: z.number().nonnegative().optional(),
  tax_amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  line_items: z.array(lineItemSchema).optional(),
  payment_method: z.string().optional(),
  invoice_number: z.string().optional(),
  confidence_score: z.number().min(0).max(100, "Confidence score must be between 0 and 100"),
});

export const assetTagsSchema = z.object({
  asset_type: z.enum(["tangible", "intangible"]).optional(),
  asset_classification: z.enum(["fixed", "current"]).optional(),
  depreciation_period: z.number().positive().optional(),
  custom_tags: z.array(z.string()).optional(),
});

export const receiptSchema = z.object({
  id: z.string().uuid(),
  file_name: z.string().min(1, "File name is required"),
  file_path: z.string().min(1, "File path is required"),
  file_size: z.number().positive("File size must be positive"),
  file_type: z.string().min(1, "File type is required"),
  category: z.enum(["riders", "vendors", "general"]),
  subcategory: z.string().optional(),
  status: z.enum(["pending", "processed", "manual_review", "archived"]),
  extracted_data: extractedDataSchema.optional(),
  asset_tags: assetTagsSchema.optional(),
  linked_entity_type: z.string().optional(),
  linked_entity_id: z.string().uuid().optional(),
  uploaded_by: z.string().uuid(),
  uploaded_at: z.string().datetime(),
  processed_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Create receipt input schema
export const createReceiptSchema = receiptSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  uploaded_at: true,
});

// Update receipt input schema
export const updateReceiptSchema = receiptSchema.partial().required({ id: true });

// Receipt search filters
export interface ReceiptFilters {
  category?: ReceiptCategory;
  status?: ReceiptStatus;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  linked_entity_type?: string;
  linked_entity_id?: string;
  search_query?: string;
}

export const receiptFiltersSchema = z.object({
  category: z.enum(["riders", "vendors", "general"]).optional(),
  status: z.enum(["pending", "processed", "manual_review", "archived"]).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  min_amount: z.number().nonnegative().optional(),
  max_amount: z.number().nonnegative().optional(),
  linked_entity_type: z.string().optional(),
  linked_entity_id: z.string().uuid().optional(),
  search_query: z.string().optional(),
});

// Export types from schemas
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>;
export type ReceiptFiltersInput = z.infer<typeof receiptFiltersSchema>;
