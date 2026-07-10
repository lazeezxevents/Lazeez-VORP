import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput, CommissionRules, CommissionTier } from "./types";

/**
 * Commission Engine Service Class
 * 
 * Provides commission calculation functionality including:
 * - Calculating vendor commissions based on multiple models (flat, percentage, tiered, category-based)
 * - Applying commission tiers based on order amounts
 * - Recording commission liabilities in Accounts Payable
 * - Performance monitoring with 50ms threshold
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface Order {
  id: string;
  vendorId: string;
  amount: number;
  currency: 'PKR';
  category?: string;
  completedAt: Date;
}

export interface CommissionResult {
  success: boolean;
  commission?: CommissionCalculation;
  error?: string;
}

export interface CommissionCalculation {
  orderId: string;
  vendorId: string;
  orderAmount: number;
  commissionAmount: number;
  commissionRate: number;
  netPayable: number;
  calculationMethod: 'flat' | 'percentage' | 'tiered' | 'category_based';
  tierApplied?: string;
  calculatedAt: Date;
}

export interface TierResult {
  success: boolean;
  tier?: {
    minAmount: number;
    maxAmount: number;
    rate: number;
    tierName: string;
  };
  error?: string;
}

// =====================================================
// Commission Engine Service
// =====================================================

export class CommissionEngineService {
  /**
   * Calculate vendor commission based on order details
   * 
   * Requirement 3.1: Support flat rate commission model
   * Requirement 3.2: Support percentage-based commission model
   * Requirement 3.3: Support tiered commission model
   * Requirement 3.4: Support category-based commission model
   * Requirement 3.5: Ensure commission amount does not exceed order amount
   * Requirement 3.6: Compute net payable as order amount minus commission
   * Requirement 3.7: Apply vendor-specific commission rules
   * Requirement 3.8: Use system default rates when vendor rules missing
   * Requirement 3.9: Calculate commissions within 50ms per order
   * Requirement 3.10: Record commission as liability in Accounts Payable
   */
  async calculateVendorCommission(order: Order): Promise<CommissionResult> {
    const startTime = performance.now();
    
    try {
      // Validate order data
      if (!order || !order.id || !order.vendorId || order.amount <= 0) {
        return { 
          success: false, 
          error: "Invalid order data: order ID, vendor ID, and positive amount required" 
        };
      }

      // Fetch vendor financial profile with commission rules
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("commission_model, commission_rate, commission_rules")
        .eq("vendor_id", order.vendorId)
        .single();

      // Use default commission rules if profile not found (Requirement 3.8)
      const commissionModel = profile?.commission_model || 'percentage';
      const commissionRules: CommissionRules = profile?.commission_rules || {
        model: commissionModel,
        percentage_rate: profile?.commission_rate || 10.0,
      };

      let commissionAmount = 0;
      let commissionRate = 0;
      let tierApplied: string | undefined;

      // Calculate commission based on model (Requirements 3.1, 3.2, 3.3, 3.4)
      switch (commissionModel) {
        case 'flat':
          // Requirement 3.1: Flat rate commission model
          commissionAmount = commissionRules.flat_rate || 0;
          commissionRate = order.amount > 0 ? (commissionAmount / order.amount) * 100 : 0;
          break;

        case 'percentage':
          // Requirement 3.2: Percentage-based commission model
          commissionRate = commissionRules.percentage_rate || 0;
          commissionAmount = (order.amount * commissionRate) / 100;
          break;

        case 'tiered':
          // Requirement 3.3: Tiered commission model
          const tierResult = await this.applyCommissionTier(order.vendorId, order.amount);
          if (tierResult.success && tierResult.tier) {
            commissionRate = tierResult.tier.rate;
            commissionAmount = (order.amount * commissionRate) / 100;
            tierApplied = tierResult.tier.tierName;
          } else {
            // Use default rate if no tier found
            commissionRate = commissionRules.percentage_rate || 10.0;
            commissionAmount = (order.amount * commissionRate) / 100;
          }
          break;

        case 'category_based':
          // Requirement 3.4: Category-based commission model
          if (order.category && commissionRules.category_rates?.[order.category]) {
            commissionRate = commissionRules.category_rates[order.category];
          } else {
            // Use default rate if category not found
            commissionRate = commissionRules.percentage_rate || 10.0;
          }
          commissionAmount = (order.amount * commissionRate) / 100;
          break;

        default:
          return { 
            success: false, 
            error: `Unsupported commission model: ${commissionModel}` 
          };
      }

      // Requirement 3.5: Ensure commission amount does not exceed order amount
      if (commissionAmount > order.amount) {
        commissionAmount = order.amount;
        commissionRate = 100;
      }

      // Ensure commission is non-negative
      if (commissionAmount < 0) {
        commissionAmount = 0;
        commissionRate = 0;
      }

      // Requirement 3.6: Compute net payable as order amount minus commission
      const netPayable = order.amount - commissionAmount;

      // Requirement 3.10: Record commission as liability in Accounts Payable
      await this.recordCommissionLiability(order, commissionAmount);

      const commission: CommissionCalculation = {
        orderId: order.id,
        vendorId: order.vendorId,
        orderAmount: order.amount,
        commissionAmount,
        commissionRate,
        netPayable,
        calculationMethod: commissionModel,
        tierApplied,
        calculatedAt: new Date(),
      };

      // Performance monitoring (Requirement 3.9: Calculate within 50ms)
      const executionTime = performance.now() - startTime;
      
      // Log performance metrics
      await this.logPerformanceMetric({
        operation_type: 'commission_calculation',
        operation_id: order.id,
        execution_time_ms: Math.round(executionTime),
        success: true,
        metadata: {
          order_id: order.id,
          vendor_id: order.vendorId,
          order_amount: order.amount,
          commission_amount: commissionAmount,
          commission_model: commissionModel,
        },
      });

      // Alert if performance threshold exceeded
      if (executionTime > 50) {
        console.warn(
          `⚠️ Commission calculation exceeded 50ms threshold: ${Math.round(executionTime)}ms for order ${order.id}`
        );
      } else {
        console.log(
          `✓ Commission calculation completed in ${Math.round(executionTime)}ms for order ${order.id}`
        );
      }

      return { success: true, commission };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Log failed performance metric
      await this.logPerformanceMetric({
        operation_type: 'commission_calculation',
        operation_id: order.id,
        execution_time_ms: Math.round(executionTime),
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          order_id: order.id,
          vendor_id: order.vendorId,
          order_amount: order.amount,
        },
      });
      
      console.error("Unexpected error calculating commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Apply commission tier based on order amount
   * 
   * Requirement 3.3: Support tiered commission model with multiple rate brackets
   * Finds the applicable tier for the given order amount and returns the tier details
   */
  async applyCommissionTier(vendorId: string, amount: number): Promise<TierResult> {
    try {
      // Fetch vendor commission rules
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("commission_rules")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        return { 
          success: false, 
          error: "Vendor financial profile not found" 
        };
      }

      const commissionRules: CommissionRules = profile.commission_rules;

      // Check if tiers are defined
      if (!commissionRules.tiers || commissionRules.tiers.length === 0) {
        return { 
          success: false, 
          error: "No commission tiers defined for vendor" 
        };
      }

      // Find applicable tier based on order amount
      // Tiers should be sorted by minAmount (ascending)
      let applicableTier: CommissionTier | null = null;
      
      for (const tier of commissionRules.tiers) {
        if (amount >= tier.min_amount && amount <= tier.max_amount) {
          applicableTier = tier;
          break;
        }
      }

      // If no exact match, use the highest tier if amount exceeds all tiers
      if (!applicableTier && commissionRules.tiers.length > 0) {
        const highestTier = commissionRules.tiers[commissionRules.tiers.length - 1];
        if (amount > highestTier.max_amount) {
          applicableTier = highestTier;
        }
      }

      if (!applicableTier) {
        return { 
          success: false, 
          error: `No applicable tier found for amount: ${amount}` 
        };
      }

      return {
        success: true,
        tier: {
          minAmount: applicableTier.min_amount,
          maxAmount: applicableTier.max_amount,
          rate: applicableTier.rate,
          tierName: `Tier ${applicableTier.min_amount}-${applicableTier.max_amount}`,
        },
      };
    } catch (error) {
      console.error("Error applying commission tier:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record commission as liability in Accounts Payable
   * 
   * Requirement 3.10: Record commission as liability in Accounts Payable
   * Creates journal entry debiting Commission Expense and crediting Accounts Payable - Vendors
   */
  private async recordCommissionLiability(order: Order, commissionAmount: number): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Get account IDs for Commission Expense and Accounts Payable
      const { data: commissionExpenseAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("type", "expense")
        .eq("sub_type", "commission")
        .eq("is_active", true)
        .limit(1)
        .single();

      const { data: accountsPayableAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("type", "liability")
        .eq("sub_type", "accounts_payable")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!commissionExpenseAccount || !accountsPayableAccount) {
        console.warn("Commission accounts not found, skipping liability recording");
        return;
      }

      // Create journal entry: Debit Commission Expense, Credit Accounts Payable
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Vendor commission for order ${order.id}`,
        reference: `COMM-${order.id}`,
        ledger_entries: [
          {
            account_id: commissionExpenseAccount.id,
            debit: commissionAmount,
            credit: 0,
            currency: 'PKR',
            description: `Commission expense for vendor ${order.vendorId}`,
          },
          {
            account_id: accountsPayableAccount.id,
            debit: 0,
            credit: commissionAmount,
            currency: 'PKR',
            description: `Commission liability to vendor ${order.vendorId}`,
          },
        ],
      };

      // Create and post journal entry
      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (journalResult.success && journalResult.journal_entry) {
        await generalLedgerService.postTransaction(journalResult.journal_entry.id, user.id);

        // Log audit entry
        await auditLogService.logAuditEntry({
          entityType: 'commission',
          entityId: order.id,
          action: 'record_liability',
          oldValues: null,
          newValues: {
            order_id: order.id,
            vendor_id: order.vendorId,
            commission_amount: commissionAmount,
            journal_entry_id: journalResult.journal_entry.id,
          },
        });
      }
    } catch (error) {
      console.error("Error recording commission liability:", error);
      // Don't throw - commission calculation should succeed even if liability recording fails
    }
  }

  /**
   * Log performance metrics for monitoring
   * Requirement 3.9: Performance monitoring for 50ms requirement
   */
  private async logPerformanceMetric(metric: {
    operation_type: string;
    operation_id: string;
    execution_time_ms: number;
    success: boolean;
    error_message?: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    try {
      await supabase.from("finance_performance_metrics").insert({
        operation_type: metric.operation_type,
        operation_id: metric.operation_id,
        execution_time_ms: metric.execution_time_ms,
        success: metric.success,
        error_message: metric.error_message || null,
        metadata: metric.metadata,
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error("Failed to log performance metric:", error);
    }
  }
}

// Export singleton instance
export const commissionEngineService = new CommissionEngineService();
