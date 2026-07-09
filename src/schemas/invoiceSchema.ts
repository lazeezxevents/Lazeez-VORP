import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  quantity: z.number().positive("Quantity must be positive").max(1000000, "Quantity too large"),
  unit_price: z.number().positive("Unit price must be positive").max(1000000, "Unit price too large"),
  amount: z.number().positive("Amount must be positive").max(1000000000, "Amount too large"),
  tax_rate: z.number().min(0, "Tax rate cannot be negative").max(1, "Tax rate cannot exceed 100%").optional(),
});

export const createInvoiceSchema = z.object({
  vendor_id: z.string().uuid("Invalid vendor ID"),
  invoice_number: z
    .string()
    .min(1, "Invoice number is required")
    .max(50, "Invoice number must be less than 50 characters")
    .regex(/^[A-Z0-9-]+$/, "Invoice number must contain only uppercase letters, numbers, and hyphens"),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date must be in YYYY-MM-DD format"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format"),
  subtotal: z.number().positive("Subtotal must be positive").max(1000000000, "Subtotal too large"),
  tax_amount: z.number().min(0, "Tax amount cannot be negative").max(1000000000, "Tax amount too large"),
  total_amount: z.number().positive("Total amount must be positive").max(1000000000, "Total amount too large"),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
  line_items: z
    .array(invoiceLineItemSchema)
    .min(1, "At least one line item is required")
    .max(100, "Maximum 100 line items allowed"),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z.number().positive("Payment amount must be positive").max(1000000000, "Amount too large"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format"),
  paymentMethod: z.enum(["cash", "bank_transfer", "check", "credit_card", "other"], {
    errorMap: () => ({ message: "Invalid payment method" }),
  }),
  reference: z.string().max(100, "Reference must be less than 100 characters").optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
