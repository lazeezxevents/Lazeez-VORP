import { z } from "zod";

export const budgetAllocationSchema = z.object({
  category: z.string().min(1, "Category is required").max(100, "Category must be less than 100 characters"),
  allocated_amount: z.number().positive("Amount must be positive").max(1000000000, "Amount too large"),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

export const createBudgetSchema = z.object({
  name: z.string().min(1, "Budget name is required").max(200, "Name must be less than 200 characters"),
  fiscal_year: z
    .number()
    .int("Fiscal year must be an integer")
    .min(2000, "Fiscal year must be 2000 or later")
    .max(2100, "Fiscal year must be before 2100"),
  period: z.enum(["annual", "quarterly", "monthly"], {
    errorMap: () => ({ message: "Period must be annual, quarterly, or monthly" }),
  }),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
  total_amount: z.number().positive("Total amount must be positive").max(1000000000, "Amount too large"),
  department_id: z.string().uuid("Invalid department ID").optional(),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
  allocations: z
    .array(budgetAllocationSchema)
    .min(1, "At least one allocation is required")
    .max(50, "Maximum 50 allocations allowed"),
});

export const reviseBudgetSchema = z.object({
  budgetId: z.string().uuid("Invalid budget ID"),
  newAmount: z.number().positive("New amount must be positive").max(1000000000, "Amount too large"),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason must be less than 500 characters"),
  approvedBy: z.string().uuid("Invalid approver ID"),
  createdBy: z.string().uuid("Invalid creator ID"),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type BudgetAllocationInput = z.infer<typeof budgetAllocationSchema>;
export type ReviseBudgetInput = z.infer<typeof reviseBudgetSchema>;
