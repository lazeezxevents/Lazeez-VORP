import { z } from "zod";

// =====================================================
// Chart of Accounts Types
// =====================================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  sub_type: string | null;
  currency: 'PKR'; // PKR only - Pakistani Rupee
  balance: number;
  parent_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccounts {
  accounts: Account[];
  totalAccounts: number;
  accountsByType: Record<AccountType, Account[]>;
}

// =====================================================
// Journal Entry Types
// =====================================================

export type JournalEntryStatus = 'draft' | 'posted' | 'void';

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  reference: string | null;
  status: JournalEntryStatus;
  created_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  currency: 'PKR'; // PKR only - Pakistani Rupee
  description: string | null;
  created_at: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  ledger_entries: LedgerEntry[];
}

// =====================================================
// Transaction Types
// =====================================================

export type TransactionType = 'revenue' | 'expense' | 'transfer' | 'adjustment';
export type TransactionStatus = 'pending' | 'posted' | 'void';

export interface Transaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  type: TransactionType;
  description: string | null;
  amount: number;
  currency: 'PKR'; // PKR only - Pakistani Rupee
  status: TransactionStatus;
  source_module: string | null;
  source_id: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Balance and Trial Balance Types
// =====================================================

export interface Balance {
  account_id: string;
  account_code: string;
  account_name: string;
  balance: number;
  currency: 'PKR'; // PKR only - Pakistani Rupee
  as_of_date: string;
}

export interface TrialBalance {
  start_date: string;
  end_date: string;
  accounts: Array<{
    account_id: string;
    account_code: string;
    account_name: string;
    account_type: AccountType;
    debit: number;
    credit: number;
  }>;
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

// =====================================================
// Service Result Types
// =====================================================

export interface JournalEntryResult {
  success: boolean;
  journal_entry?: JournalEntryWithLines;
  error?: string;
}

export interface TransactionResult {
  success: boolean;
  transaction?: Transaction;
  journal_entry?: JournalEntry;
  error?: string;
}

export interface PostingResult {
  success: boolean;
  journal_entry_id?: string;
  accounts_updated?: number;
  error?: string;
}

// =====================================================
// Zod Schemas for Validation
// =====================================================

export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);

export const accountSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  type: accountTypeSchema,
  sub_type: z.string().max(50).nullable(),
  currency: z.literal('PKR').default('PKR'), // PKR only
  balance: z.number().default(0),
  parent_account_id: z.string().uuid().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createAccountSchema = z.object({
  code: z.string()
    .min(1, "Account code is required")
    .max(20, "Account code must be 20 characters or less")
    .regex(/^[0-9A-Z-]+$/, "Account code must contain only numbers, uppercase letters, and hyphens"),
  name: z.string()
    .min(1, "Account name is required")
    .max(255, "Account name must be 255 characters or less"),
  type: accountTypeSchema,
  sub_type: z.string().max(50).optional(),
  currency: z.literal('PKR').default('PKR'), // PKR only
  parent_account_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sub_type: z.string().max(50).optional(),
  parent_account_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const ledgerEntrySchema = z.object({
  account_id: z.string().uuid("Invalid account ID"),
  debit: z.number().min(0, "Debit must be non-negative").default(0),
  credit: z.number().min(0, "Credit must be non-negative").default(0),
  currency: z.literal('PKR').default('PKR'), // PKR only
  description: z.string().max(500).optional(),
}).refine(
  (data) => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0),
  { message: "Entry must have either debit or credit, not both" }
);

export const createJournalEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  description: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
  ledger_entries: z.array(ledgerEntrySchema).min(2, "At least 2 ledger entries required"),
}).refine(
  (data) => {
    const totalDebits = data.ledger_entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = data.ledger_entries.reduce((sum, entry) => sum + entry.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow small rounding differences
  },
  { message: "Total debits must equal total credits" }
);

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;

// =====================================================
// Account Tree Node (for hierarchical display)
// =====================================================

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
  hasChildren: boolean;
}

// =====================================================
// Vendor Financial Profile Types
// =====================================================

export type CommissionModel = 'flat' | 'percentage' | 'tiered' | 'category_based';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'pending';

export interface CommissionTier {
  min_amount: number;
  max_amount: number;
  rate: number;
}

export interface CommissionRules {
  model: CommissionModel;
  flat_rate?: number;
  percentage_rate?: number;
  tiers?: CommissionTier[];
  category_rates?: Record<string, number>;
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  account_title: string;
  routing_number?: string;
  swift_code?: string;
}

export interface VendorFinancialProfile {
  id: string;
  vendor_id: string;
  commission_model: CommissionModel;
  commission_rate: number | null;
  commission_rules: CommissionRules;
  subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  current_threshold: number;
  threshold_limit: number | null;
  total_revenue: number;
  total_commission_paid: number;
  total_payouts: number;
  outstanding_balance: number;
  payment_terms: string | null;
  preferred_payment_method: string | null;
  bank_details: BankDetails | null;
  tax_id: string | null;
  last_payout_date: string | null;
  next_billing_date: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Vendor Financial Profile Zod Schemas
// =====================================================

export const commissionModelSchema = z.enum(['flat', 'percentage', 'tiered', 'category_based']);
export const subscriptionStatusSchema = z.enum(['active', 'suspended', 'cancelled', 'pending']);

export const commissionTierSchema = z.object({
  min_amount: z.number().min(0, "Minimum amount must be non-negative"),
  max_amount: z.number().min(0, "Maximum amount must be non-negative"),
  rate: z.number().min(0, "Rate must be non-negative").max(100, "Rate cannot exceed 100%"),
}).refine(
  (data) => data.max_amount > data.min_amount,
  { message: "Maximum amount must be greater than minimum amount" }
);

export const commissionRulesSchema = z.object({
  model: commissionModelSchema,
  flat_rate: z.number().min(0).optional(),
  percentage_rate: z.number().min(0).max(100).optional(),
  tiers: z.array(commissionTierSchema).optional(),
  category_rates: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

export const bankDetailsSchema = z.object({
  bank_name: z.string().min(1, "Bank name is required"),
  account_number: z.string().min(1, "Account number is required"),
  account_title: z.string().min(1, "Account title is required"),
  routing_number: z.string().optional(),
  swift_code: z.string().optional(),
});

export const createVendorFinancialProfileSchema = z.object({
  vendor_id: z.string().uuid("Invalid vendor ID"),
  commission_model: commissionModelSchema.default('percentage'),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  commission_rules: commissionRulesSchema.optional(),
  subscription_status: subscriptionStatusSchema.default('active'),
  threshold_limit: z.number().int().min(1).nullable().optional(),
  payment_terms: z.string().max(50).optional(),
  preferred_payment_method: z.string().max(50).optional(),
  bank_details: bankDetailsSchema.nullable().optional(),
  tax_id: z.string().max(50).optional(),
});

export const updateVendorFinancialProfileSchema = z.object({
  commission_model: commissionModelSchema.optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  commission_rules: commissionRulesSchema.optional(),
  subscription_status: subscriptionStatusSchema.optional(),
  threshold_limit: z.number().int().min(1).nullable().optional(),
  payment_terms: z.string().max(50).optional(),
  preferred_payment_method: z.string().max(50).optional(),
  bank_details: bankDetailsSchema.nullable().optional(),
  tax_id: z.string().max(50).optional(),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateVendorFinancialProfileInput = z.infer<typeof createVendorFinancialProfileSchema>;
export type UpdateVendorFinancialProfileInput = z.infer<typeof updateVendorFinancialProfileSchema>;

// =====================================================
// Rider Commission Types
// =====================================================

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface RouteData {
  distance: number;
  duration?: number;
  waypoints?: Location[];
  optimized: boolean;
}

export interface DeliveryData {
  orderId: string;
  deliveryId: string;
  riderId: string;
  vendorId: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  distance: number;
  optimizedRoute: RouteData;
  deliveryCharge: number;
  completedAt: Date;
}

export interface RiderCommission {
  orderId: string;
  riderId: string;
  distance: number;
  deliveryCharge: number;
  commissionRate: number;
  commissionAmount: number;
  tierApplied: string;
  calculatedAt: Date;
}

export interface DeliveryReceipt {
  deliveryId: string;
  orderId: string;
  riderId: string;
  vendorId: string;
  pickupLocation: any;
  deliveryLocation: any;
  distance: number;
  optimizedRoute: any;
  deliveryCharge: number;
  completedAt: Date;
}

export interface RiderEarnings {
  riderId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalDeliveries: number;
  totalDistance: number;
  totalCommission: number;
  averageCommissionPerDelivery: number;
  deliveries: Array<{
    orderId: string;
    date: Date;
    distance: number;
    commission: number;
    tierApplied: string;
  }>;
}

// =====================================================
// Subscription Management Types
// =====================================================

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionPlan {
  id: string;
  name: string;
  billingCycle: BillingCycle;
  basePrice: number;
  currency: 'PKR';
  features: string[];
  customThreshold?: number;
  autoRenew: boolean;
}

export interface Subscription {
  id: string;
  vendorId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  thresholdReached: boolean;
  orderCount: number;
}

export interface ThresholdStatus {
  vendorId: string;
  currentOrderCount: number;
  thresholdLimit: number;
  thresholdReached: boolean;
  nextBillingDate: Date | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  currency: 'PKR';
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface ProratedAmount {
  originalAmount: number;
  proratedAmount: number;
  daysUsed: number;
  totalDays: number;
  effectiveDate: Date;
}

// =====================================================
// Invoice Management Types (Task 13.2)
// =====================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: InvoiceStatus;
  currency: 'PKR';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
  created_at: string;
}

export interface InvoiceWithLineItems extends Invoice {
  line_items: InvoiceLineItem[];
  vendor?: {
    id: string;
    name: string;
  };
}

export interface InvoicePayment {
  invoice_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method?: string;
  reference?: string;
  notes?: string;
}

// =====================================================
// Invoice Zod Schemas (Task 13.2)
// =====================================================

export const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue', 'void']);

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Unit price must be non-negative"),
  tax_rate: z.number().min(0).max(100, "Tax rate must be between 0 and 100").default(0),
  amount: z.number().min(0, "Amount must be non-negative"),
});

export const createInvoiceSchema = z.object({
  vendor_id: z.string().uuid("Invalid vendor ID"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  line_items: z.array(invoiceLineItemSchema).min(1, "At least one line item is required"),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    const issueDate = new Date(data.issue_date);
    const dueDate = new Date(data.due_date);
    return dueDate >= issueDate;
  },
  { message: "Due date must be on or after issue date" }
);

export const updateInvoiceSchema = z.object({
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: invoiceStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const recordPaymentSchema = z.object({
  invoice_id: z.string().uuid("Invalid invoice ID"),
  payment_amount: z.number().min(0.01, "Payment amount must be greater than 0"),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  payment_method: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// =====================================================
// Receipt Vault Types (Task 20.3)
// =====================================================

export type ReceiptCategory = 'riders' | 'vendors' | 'general';
export type ReceiptStatus = 'pending' | 'processed' | 'verified' | 'failed';
export type LinkedEntityType = 'transaction' | 'expense' | 'delivery' | 'order';
export type AssetType = 'tangible' | 'intangible';
export type AssetClass = 'fixed' | 'current';
export type AccountingCategory = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface ExtractedReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ExtractedData {
  merchantName?: string;
  date?: string;
  totalAmount?: number;
  currency?: string;
  lineItems?: ExtractedReceiptLineItem[];
  taxAmount?: number;
  paymentMethod?: string;
  confidence: number;
}

export interface AssetTags {
  assetType: AssetType | null;
  assetClass: AssetClass | null;
  accountingCategory: AccountingCategory | null;
  depreciable: boolean;
  usefulLife?: number;
}

export interface ReceiptMetadata {
  uploadedBy: string;
  category: ReceiptCategory;
  subcategory?: string;
  date?: string;
  amount?: number;
  vendorId?: string;
  riderId?: string;
  orderId?: string;
}

export interface Receipt {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  category: ReceiptCategory;
  subcategory: string | null;
  tags: string[];
  extracted_data: ExtractedData | null;
  confidence_score: number | null;
  asset_type: AssetType | null;
  asset_class: AssetClass | null;
  accounting_category: AccountingCategory | null;
  depreciable: boolean;
  useful_life: number | null;
  linked_entityType: LinkedEntityType | null;
  linked_entityId: string | null;
  status: ReceiptStatus;
  processing_error: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ReceiptQuery {
  category?: ReceiptCategory;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  status?: ReceiptStatus;
  searchText?: string;
  linkedEntityType?: LinkedEntityType;
}

export interface ReceiptFilters {
  category?: ReceiptCategory;
  status?: ReceiptStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ReceiptReport {
  period: {
    startDate: string;
    endDate: string;
  };
  totalReceipts: number;
  receiptsByCategory: Record<ReceiptCategory, number>;
  totalAmount: number;
  amountByCategory: Record<ReceiptCategory, number>;
  receipts: Receipt[];
}

export interface ReceiptCategoryBreakdown {
  category: ReceiptCategory;
  receiptCount: number;
  totalAmount: number;
}

// =====================================================
// Receipt Vault Zod Schemas (Task 20.3)
// =====================================================

export const receiptCategorySchema = z.enum(['riders', 'vendors', 'general']);
export const receiptStatusSchema = z.enum(['pending', 'processed', 'verified', 'failed']);
export const linkedEntityTypeSchema = z.enum(['transaction', 'expense', 'delivery', 'order']);
export const assetTypeSchema = z.enum(['tangible', 'intangible']);
export const assetClassSchema = z.enum(['fixed', 'current']);
export const accountingCategorySchema = z.enum(['asset', 'liability', 'equity', 'income', 'expense']);

export const extractedReceiptLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  amount: z.number().min(0),
});

export const extractedDataSchema = z.object({
  merchantName: z.string().optional(),
  date: z.string().optional(),
  totalAmount: z.number().optional(),
  currency: z.string().optional(),
  lineItems: z.array(extractedReceiptLineItemSchema).optional(),
  taxAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  confidence: z.number().min(0).max(100),
});

export const assetTagsSchema = z.object({
  assetType: assetTypeSchema.nullable(),
  assetClass: assetClassSchema.nullable(),
  accountingCategory: accountingCategorySchema.nullable(),
  depreciable: z.boolean(),
  usefulLife: z.number().int().min(1).optional(),
});

export const receiptMetadataSchema = z.object({
  uploadedBy: z.string().uuid(),
  category: receiptCategorySchema,
  subcategory: z.string().max(100).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().min(0).optional(),
  vendorId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

export const uploadReceiptSchema = z.object({
  file: z.instanceof(File),
  metadata: receiptMetadataSchema,
});

export const categorizeReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  category: receiptCategorySchema,
  subcategory: z.string().max(100).optional(),
});

export const tagReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  tags: z.array(z.string().max(50)).min(1),
});

export const linkReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  entityType: linkedEntityTypeSchema,
  entityId: z.string().uuid(),
});

export const receiptQuerySchema = z.object({
  category: receiptCategorySchema.optional(),
  tags: z.array(z.string()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: receiptStatusSchema.optional(),
  searchText: z.string().optional(),
  linkedEntityType: linkedEntityTypeSchema.optional(),
});

export const updateAssetTagsSchema = z.object({
  receiptId: z.string().uuid(),
  assetTags: assetTagsSchema,
});

export type UploadReceiptInput = z.infer<typeof uploadReceiptSchema>;
export type CategorizeReceiptInput = z.infer<typeof categorizeReceiptSchema>;
export type TagReceiptInput = z.infer<typeof tagReceiptSchema>;
export type LinkReceiptInput = z.infer<typeof linkReceiptSchema>;
export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>;
export type UpdateAssetTagsInput = z.infer<typeof updateAssetTagsSchema>;
