/**
 * Expense Management Module Exports
 * 
 * Centralized exports for all expense management components, services, and hooks
 */

// Services
export { ExpenseManagerService, expenseManagerService } from "../ExpenseManagerService";
export { ExpensePolicyValidator, expensePolicyValidator } from "../ExpensePolicyValidator";
export { ExpenseApprovalWorkflow, expenseApprovalWorkflow } from "../ExpenseApprovalWorkflow";

// Hooks
export {
  useExpenses,
  useMyExpenses,
  usePendingApprovals,
  useExpense,
  useSubmitExpense,
  useApproveExpense,
  useRejectExpense,
  useProcessReimbursement,
  expenseKeys,
} from "../useExpenses";

// UI Components
export { ExpenseSubmissionForm } from "../ExpenseSubmissionForm";
export { ExpenseApprovalInterface } from "../ExpenseApprovalInterface";

// Types
export type {
  ExpenseSubmission,
  Expense,
  ExpenseStatus,
  Approval,
  ReimbursementResult,
  ExpenseSubmissionResult,
  ApprovalResult,
  RejectionResult,
} from "../ExpenseManagerService";

export type {
  PolicyLimits,
  PolicyViolation,
  ValidationResult,
} from "../ExpensePolicyValidator";

export type {
  ApprovalChainConfig,
  ApprovalRoute,
  NotificationResult,
} from "../ExpenseApprovalWorkflow";
