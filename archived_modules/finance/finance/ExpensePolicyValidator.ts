import { supabase } from "@/integrations/supabase/client";
import type { ExpenseSubmission } from "./ExpenseManagerService";

/**
 * Expense Policy Validator
 * 
 * Validates expense submissions against company policies including:
 * - Policy limits per category
 * - Required receipt attachments
 * - Duplicate submission detection
 * - Policy violation flagging
 * 
 * Requirements: 9.7, 22.1, 22.2, 22.6
 * Task: 18.4 Implement expense policy validation
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface PolicyLimits {
  category: string;
  maxAmount: number;
  requiresReceipt: boolean;
  receiptThreshold: number;
  allowedRoles?: string[];
}

export interface PolicyViolation {
  type: 'amount_exceeded' | 'receipt_required' | 'duplicate_detected' | 'category_not_allowed' | 'future_date';
  severity: 'warning' | 'error';
  message: string;
  details?: any;
}

export interface ValidationResult {
  isValid: boolean;
  violations: PolicyViolation[];
  requiresSpecialApproval: boolean;
}

// =====================================================
// Default Policy Configuration
// =====================================================

const DEFAULT_POLICY_LIMITS: PolicyLimits[] = [
  {
    category: 'Travel',
    maxAmount: 50000,
    requiresReceipt: true,
    receiptThreshold: 5000,
  },
  {
    category: 'Meals',
    maxAmount: 10000,
    requiresReceipt: true,
    receiptThreshold: 2000,
  },
  {
    category: 'Supplies',
    maxAmount: 25000,
    requiresReceipt: true,
    receiptThreshold: 5000,
  },
  {
    category: 'Technology',
    maxAmount: 100000,
    requiresReceipt: true,
    receiptThreshold: 10000,
  },
  {
    category: 'Marketing',
    maxAmount: 75000,
    requiresReceipt: true,
    receiptThreshold: 10000,
  },
  {
    category: 'Training',
    maxAmount: 50000,
    requiresReceipt: true,
    receiptThreshold: 5000,
  },
  {
    category: 'Entertainment',
    maxAmount: 15000,
    requiresReceipt: true,
    receiptThreshold: 3000,
  },
  {
    category: 'Other',
    maxAmount: 20000,
    requiresReceipt: true,
    receiptThreshold: 5000,
  },
];

const RECEIPT_REQUIRED_THRESHOLD = 5000; // PKR

// =====================================================
// Expense Policy Validator Service
// =====================================================

export class ExpensePolicyValidator {
  /**
   * Validate expense against all policies
   * 
   * Requirement 22.1: Validate expense amounts against configured policy limits
   * Requirement 22.2: Flag expenses that exceed policy limit for special approval
   * Requirement 22.6: Check for duplicate expense submissions
   */
  async validateExpense(expense: ExpenseSubmission): Promise<ValidationResult> {
    const violations: PolicyViolation[] = [];
    let requiresSpecialApproval = false;

    // Validate amount against policy limits (Requirement 22.1)
    const amountViolation = this.validateAmount(expense.category, expense.amount);
    if (amountViolation) {
      violations.push(amountViolation);
      if (amountViolation.severity === 'error') {
        requiresSpecialApproval = true;
      }
    }

    // Validate receipt attachment (Requirement 22.4)
    const receiptViolation = this.validateReceipt(
      expense.category,
      expense.amount,
      expense.receiptUrl
    );
    if (receiptViolation) {
      violations.push(receiptViolation);
    }

    // Validate expense date (Requirement 22.5)
    const dateViolation = this.validateDate(expense.date);
    if (dateViolation) {
      violations.push(dateViolation);
    }

    // Check for duplicate submissions (Requirement 22.6)
    const duplicateViolation = await this.checkDuplicates(
      expense.employeeId,
      expense.amount,
      expense.date,
      expense.category
    );
    if (duplicateViolation) {
      violations.push(duplicateViolation);
    }

    // Validate category is allowed (Requirement 22.3)
    const categoryViolation = this.validateCategory(expense.category);
    if (categoryViolation) {
      violations.push(categoryViolation);
    }

    const isValid = violations.filter(v => v.severity === 'error').length === 0;

    return {
      isValid,
      violations,
      requiresSpecialApproval,
    };
  }

  /**
   * Validate expense amount against policy limits
   * 
   * Requirement 22.1: Validate expense amounts against configured policy limits
   * Requirement 22.2: Flag for special approval when exceeds limit
   */
  private validateAmount(category: string, amount: number): PolicyViolation | null {
    const policyLimit = DEFAULT_POLICY_LIMITS.find(
      p => p.category.toLowerCase() === category.toLowerCase()
    );

    if (!policyLimit) {
      // Use default limit for unknown categories
      const defaultLimit = DEFAULT_POLICY_LIMITS.find(p => p.category === 'Other');
      if (defaultLimit && amount > defaultLimit.maxAmount) {
        return {
          type: 'amount_exceeded',
          severity: 'error',
          message: `Expense amount ₨${amount.toLocaleString()} exceeds policy limit of ₨${defaultLimit.maxAmount.toLocaleString()} for category "${category}"`,
          details: {
            amount,
            limit: defaultLimit.maxAmount,
            category,
          },
        };
      }
      return null;
    }

    if (amount > policyLimit.maxAmount) {
      return {
        type: 'amount_exceeded',
        severity: 'error',
        message: `Expense amount ₨${amount.toLocaleString()} exceeds policy limit of ₨${policyLimit.maxAmount.toLocaleString()} for ${category}`,
        details: {
          amount,
          limit: policyLimit.maxAmount,
          category,
        },
      };
    }

    return null;
  }

  /**
   * Validate receipt attachment requirement
   * 
   * Requirement 22.4: Require receipt attachment for expenses above threshold
   */
  private validateReceipt(
    category: string,
    amount: number,
    receiptUrl?: string
  ): PolicyViolation | null {
    const policyLimit = DEFAULT_POLICY_LIMITS.find(
      p => p.category.toLowerCase() === category.toLowerCase()
    );

    const threshold = policyLimit?.receiptThreshold || RECEIPT_REQUIRED_THRESHOLD;

    if (amount >= threshold && !receiptUrl) {
      return {
        type: 'receipt_required',
        severity: 'error',
        message: `Receipt is required for expenses of ₨${threshold.toLocaleString()} or more`,
        details: {
          amount,
          threshold,
          category,
        },
      };
    }

    return null;
  }

  /**
   * Validate expense date is not in the future
   * 
   * Requirement 22.5: Validate expense dates to ensure they are not future dates
   */
  private validateDate(expenseDate: Date): PolicyViolation | null {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expDate = new Date(expenseDate);
    expDate.setHours(0, 0, 0, 0);

    if (expDate > today) {
      return {
        type: 'future_date',
        severity: 'error',
        message: 'Expense date cannot be in the future',
        details: {
          expenseDate: expenseDate.toISOString().split('T')[0],
          today: today.toISOString().split('T')[0],
        },
      };
    }

    return null;
  }

  /**
   * Check for duplicate expense submissions
   * 
   * Requirement 22.6: Check for duplicate expense submissions based on amount, date, and merchant
   */
  private async checkDuplicates(
    employeeId: string,
    amount: number,
    date: Date,
    category: string
  ): Promise<PolicyViolation | null> {
    try {
      const dateStr = date.toISOString().split('T')[0];

      // Check for expenses with same employee, amount, date, and category
      const { data: duplicates, error } = await supabase
        .from('finance_expenses')
        .select('id, status, submitted_at')
        .eq('employee_id', employeeId)
        .eq('amount', amount)
        .eq('expense_date', dateStr)
        .eq('category', category)
        .in('status', ['submitted', 'pending_approval', 'approved'])
        .limit(1);

      if (error) {
        console.error('Error checking for duplicates:', error);
        return null;
      }

      if (duplicates && duplicates.length > 0) {
        return {
          type: 'duplicate_detected',
          severity: 'warning',
          message: `A similar expense for ₨${amount.toLocaleString()} on ${dateStr} already exists`,
          details: {
            duplicateId: duplicates[0].id,
            duplicateStatus: duplicates[0].status,
            duplicateSubmittedAt: duplicates[0].submitted_at,
          },
        };
      }

      return null;
    } catch (error) {
      console.error('Unexpected error checking duplicates:', error);
      return null;
    }
  }

  /**
   * Validate category is allowed
   * 
   * Requirement 22.3: Validate expense categories against allowed categories
   */
  private validateCategory(category: string): PolicyViolation | null {
    const allowedCategories = DEFAULT_POLICY_LIMITS.map(p => p.category.toLowerCase());
    
    if (!allowedCategories.includes(category.toLowerCase())) {
      return {
        type: 'category_not_allowed',
        severity: 'warning',
        message: `Category "${category}" is not in the standard list. It will be reviewed as "Other"`,
        details: {
          category,
          allowedCategories: DEFAULT_POLICY_LIMITS.map(p => p.category),
        },
      };
    }

    return null;
  }

  /**
   * Get policy limits for a category
   */
  getPolicyLimit(category: string): PolicyLimits | null {
    return DEFAULT_POLICY_LIMITS.find(
      p => p.category.toLowerCase() === category.toLowerCase()
    ) || null;
  }

  /**
   * Get all policy limits
   */
  getAllPolicyLimits(): PolicyLimits[] {
    return DEFAULT_POLICY_LIMITS;
  }
}

// Export singleton instance
export const expensePolicyValidator = new ExpensePolicyValidator();
