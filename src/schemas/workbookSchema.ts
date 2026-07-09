import { z } from "zod";

export const createWorkbookSchema = z.object({
  name: z.string().min(1, "Workbook name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  isTemplate: z.boolean().optional(),
});

export const createSheetSchema = z.object({
  workbookId: z.string().uuid("Invalid workbook ID"),
  name: z
    .string()
    .min(1, "Sheet name is required")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s-_]+$/, "Sheet name contains invalid characters"),
  rowCount: z.number().int("Row count must be an integer").min(1, "Must have at least 1 row").max(10000, "Maximum 10000 rows").optional(),
  colCount: z.number().int("Column count must be an integer").min(1, "Must have at least 1 column").max(100, "Maximum 100 columns").optional(),
});

export const updateCellSchema = z.object({
  sheetId: z.string().uuid("Invalid sheet ID"),
  row: z.number().int("Row must be an integer").min(0, "Row cannot be negative").max(9999, "Row too large"),
  col: z.number().int("Column must be an integer").min(0, "Column cannot be negative").max(99, "Column too large"),
  value: z.string().max(10000, "Cell value too large"),
  format: z.enum(["general", "currency", "percentage", "number", "date", "text"]).optional(),
});

export const createScenarioSchema = z.object({
  workbookId: z.string().uuid("Invalid workbook ID"),
  name: z.string().min(1, "Scenario name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters"),
  variables: z.record(z.any()),
});

export const shareWorkbookSchema = z.object({
  workbookId: z.string().uuid("Invalid workbook ID"),
  userIds: z.array(z.string().uuid("Invalid user ID")).min(1, "At least one user is required").max(50, "Maximum 50 users"),
});

export type CreateWorkbookInput = z.infer<typeof createWorkbookSchema>;
export type CreateSheetInput = z.infer<typeof createSheetSchema>;
export type UpdateCellInput = z.infer<typeof updateCellSchema>;
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type ShareWorkbookInput = z.infer<typeof shareWorkbookSchema>;
