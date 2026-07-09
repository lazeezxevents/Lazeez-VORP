import { z } from "zod";

export const submitExpenseSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  category: z
    .string()
    .min(1, "Category is required")
    .max(100, "Category must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s-_]+$/, "Category contains invalid characters"),
  amount: z.number().positive("Amount must be positive").max(1000000, "Amount too large"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  receiptUrl: z.string().url("Invalid receipt URL").optional(),
});

export const approveExpenseSchema = z.object({
  expenseId: z.string().uuid("Invalid expense ID"),
  approverId: z.string().uuid("Invalid approver ID"),
});

export const rejectExpenseSchema = z.object({
  expenseId: z.string().uuid("Invalid expense ID"),
  rejectorId: z.string().uuid("Invalid rejector ID"),
  reason: z.string().min(10, "Rejection reason must be at least 10 characters").max(500, "Reason must be less than 500 characters"),
});

export type SubmitExpenseInput = z.infer<typeof submitExpenseSchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
