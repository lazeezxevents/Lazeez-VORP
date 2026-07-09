import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput } from "./types";

/**
 * Revenue Manager Service Class
 * 
 * Provides revenue management functionality including:
 * - Recording revenue from multiple sources (subscription, commission, transaction_fee, service_charge)
 * - Calculating vendor and rider commissions
 * - Processing subscription revenue per vendor
 * - Getting revenue reports by period, vendor, category
 * - Applying revenue recognition rules
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

// =====================================================
// Types and Interfaces
// =====================================================

export type RevenueSourceType = 'subscription' | 'commission' | 'transaction_fee' | 'service_charge';

export interface RevenueSource {
  type: RevenueSourceType;
  orderId?: string;
  vendorId: string;
  amount: number;
  currency: 'PKR'; // PKR only
  date: Date;
  metadata?: Record<string, any>;
}

export interface Commission {
  vendorCommission: number;
  riderCommission: number;
  platformRevenue: number;
  commissionRate: number;
  calculationMethod: 'flat' | 'tiered' | 'percentage';
}

export interface RevenueRecord {
  id: string;
  transactionId: string;
  journalEntryId: string;
  source: RevenueSourceType;
  amount: number;
  platformRevenue: number;
  recordedAt: Date;
}

export interface SubscriptionRevenue {
  vendorId: string;
  subscriptionAmount: number;
  journalEntryId: string;
  recordedAt: Date;
}

export interface RevenueResult {
  success: boolean;
  revenue?: RevenueRecord;
  error?: string;
}

export interface CommissionResult {
  success: boolean;
  commission?: Commission;
  error?: string;
}

export interface SubscriptionRevenueResult {
  success: boolean;
  subscriptionRevenue?: SubscriptionRevenue;
  error?: string;
}

// =====================================================
// Revenue Manager Service
// =====================================================

export class RevenueManagerService {
  /**
   * Record revenue from a completed order
   * 
   * Requirement 2.1: Automatically record revenue in the General_Ledger when order is completed
   * Requirement 2.2: Create journal entries debiting Cash and crediting Revenue accounts
   * Requirement 2.3: Calculate and record platform revenue after commission deductions
   * Requirement 2.6: Process revenue transactions within 100ms of order completion
   * 
   * Task 7.3: Optimized for 100ms performance requirement with monitoring
   */
  async recordRevenue(source: RevenueSource): Promise<RevenueResult> {
    const startTime = performance.now();
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Calculate commission if this is an order-based revenue
      let platformRevenue = source.amount;
      let vendorCommission = 0;

      if (source.orderId && source.type === 'commission') {
        const commissionResult = await this.calculateCommission(source.orderId, source.vendorId);
        if (commissionResult.success && commissionResult.commission) {
          platformRevenue = commissionResult.commission.platformRevenue;
          vendorCommission = commissionResult.commission.vendorCommission;
        }
      }

      // Get account IDs for Cash and Revenue accounts (optimized with indexes)
      const { data: cashAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("code", "1010") // Cash account
        .eq("is_active", true)
        .single();

      const { data: revenueAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("type", "revenue")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!cashAccount || !revenueAccount) {
        return { 
          success: false, 
          error: "Required accounts (Cash or Revenue) not found. Please set up chart of accounts first." 
        };
      }

      // Create journal entry: Debit Cash, Credit Revenue
      // Requirement 2.2: Create debit Cash, credit Revenue entries
      // Requirement 2.5: Link to source order for traceability
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: source.date.toISOString().split('T')[0],
        description: `Revenue from ${source.type} - Vendor: ${source.vendorId}${source.orderId ? ` - Order: ${source.orderId}` : ''}`,
        reference: source.orderId || `${source.type}-${Date.now()}`, // Order traceability
        ledger_entries: [
          {
            account_id: cashAccount.id,
            debit: source.amount,
            credit: 0,
            currency: 'PKR',
            description: `Cash received from ${source.type}`,
          },
          {
            account_id: revenueAccount.id,
            debit: 0,
            credit: source.amount,
            currency: 'PKR',
            description: `Revenue from ${source.type}`,
          },
        ],
      };

      // Create journal entry using GeneralLedgerService
      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (!journalResult.success || !journalResult.journal_entry) {
        return { 
          success: false, 
          error: journalResult.error || "Failed to create journal entry" 
        };
      }

      // Post the journal entry
      const postResult = await generalLedgerService.postTransaction(
        journalResult.journal_entry.id,
        user.id
      );

      if (!postResult.success) {
        return { 
          success: false, 
          error: postResult.error || "Failed to post journal entry" 
        };
      }

      // Create transaction record with source order link for traceability
      const { data: transaction, error: transactionError } = await supabase
        .from("finance_transactions")
        .insert({
          transaction_number: `REV-${Date.now()}`,
          transaction_date: source.date.toISOString().split('T')[0],
          type: 'revenue',
          description: `Revenue from ${source.type}`,
          amount: source.amount,
          currency: 'PKR',
          status: 'posted',
          source_module: 'delivery',
          source_id: source.orderId || null, // Order traceability link
          journal_entry_id: journalResult.journal_entry.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (transactionError) {
        console.error("Error creating transaction record:", transactionError);
        return { success: false, error: transactionError.message };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'revenue',
        entityId: transaction.id,
        action: 'record',
        oldValues: null,
        newValues: {
          source: source.type,
          amount: source.amount,
          platform_revenue: platformRevenue,
          vendor_commission: vendorCommission,
          vendor_id: source.vendorId,
          order_id: source.orderId,
        },
      });

      const revenueRecord: RevenueRecord = {
        id: transaction.id,
        transactionId: transaction.transaction_number,
        journalEntryId: journalResult.journal_entry.id,
        source: source.type,
        amount: source.amount,
        platformRevenue,
        recordedAt: new Date(transaction.created_at),
      };

      // Performance monitoring (Requirement 2.6: Process within 100ms)
      const executionTime = performance.now() - startTime;
      
      // Log performance metrics
      await this.logPerformanceMetric({
        operation_type: 'revenue_journal_entry',
        operation_id: journalResult.journal_entry.id,
        execution_time_ms: Math.round(executionTime),
        success: true,
        metadata: {
          order_id: source.orderId,
          vendor_id: source.vendorId,
          order_amount: source.amount,
          reference: journalEntryInput.reference,
        },
      });

      // Alert if performance threshold exceeded
      if (executionTime > 100) {
        console.warn(
          `⚠️ Revenue journal entry exceeded 100ms threshold: ${Math.round(executionTime)}ms for order ${source.orderId}`
        );
      } else {
        console.log(
          `✓ Revenue journal entry completed in ${Math.round(executionTime)}ms for order ${source.orderId}`
        );
      }

      return { success: true, revenue: revenueRecord };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Log failed performance metric
      await this.logPerformanceMetric({
        operation_type: 'revenue_journal_entry',
        operation_id: null,
        execution_time_ms: Math.round(executionTime),
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          order_id: source.orderId,
          vendor_id: source.vendorId,
          order_amount: source.amount,
        },
      });
      
      console.error("Unexpected error recording revenue:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Log performance metrics for monitoring
   * Task 7.3: Performance monitoring for 100ms requirement
   */
  private async logPerformanceMetric(metric: {
    operation_type: string;
    operation_id: string | null;
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

  /**
   * Calculate vendor commission based on order details
   * 
   * Requirement 2.3: Calculate platform revenue after commission deductions
   */
  async calculateCommission(orderId: string, vendorId: string): Promise<CommissionResult> {
    try {
      // Fetch vendor financial profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("commission_model, commission_rate, commission_rules")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        // Use default commission rate if profile not found
        console.warn(`Vendor financial profile not found for vendor ${vendorId}, using default rate`);
        return {
          success: true,
          commission: {
            vendorCommission: 0,
            riderCommission: 0,
            platformRevenue: 0,
            commissionRate: 0,
            calculationMethod: 'percentage',
          },
        };
      }

      // For now, return a basic commission structure
      // This will be expanded when order data structure is available
      const commissionRate = profile.commission_rate || 0;
      
      const commission: Commission = {
        vendorCommission: 0,
        riderCommission: 0,
        platformRevenue: 0,
        commissionRate,
        calculationMethod: profile.commission_model as 'flat' | 'tiered' | 'percentage',
      };

      return { success: true, commission };
    } catch (error) {
      console.error("Unexpected error calculating commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process subscription revenue for a vendor
   * 
   * Records subscription billing as revenue when threshold is reached
   */
  async processSubscriptionRevenue(vendorId: string): Promise<SubscriptionRevenueResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Fetch vendor financial profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("*")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        return { 
          success: false, 
          error: "Vendor financial profile not found" 
        };
      }

      // Check if threshold is reached
      if (!profile.threshold_limit || profile.current_threshold < profile.threshold_limit) {
        return {
          success: false,
          error: "Subscription threshold not reached",
        };
      }

      // Get subscription plan details (placeholder - will be implemented with subscription tables)
      const subscriptionAmount = 1000; // Default subscription amount in PKR

      // Get account IDs
      const { data: cashAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("code", "1010") // Cash account
        .eq("is_active", true)
        .single();

      const { data: subscriptionRevenueAccount } = await supabase
        .from("finance_accounts")
        .select("id")
        .eq("type", "revenue")
        .eq("sub_type", "subscription")
        .eq("is_active", true)
        .single();

      if (!cashAccount || !subscriptionRevenueAccount) {
        return { 
          success: false, 
          error: "Required accounts not found" 
        };
      }

      // Create journal entry for subscription revenue
      const journalEntryInput: CreateJournalEntryInput = {
        entry_date: new Date().toISOString().split('T')[0],
        description: `Subscription revenue - Vendor: ${vendorId}`,
        reference: `SUB-${vendorId}-${Date.now()}`,
        ledger_entries: [
          {
            account_id: cashAccount.id,
            debit: subscriptionAmount,
            credit: 0,
            currency: 'PKR',
            description: "Cash from subscription",
          },
          {
            account_id: subscriptionRevenueAccount.id,
            debit: 0,
            credit: subscriptionAmount,
            currency: 'PKR',
            description: "Subscription revenue",
          },
        ],
      };

      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (!journalResult.success || !journalResult.journal_entry) {
        return { 
          success: false, 
          error: journalResult.error || "Failed to create journal entry" 
        };
      }

      // Post the journal entry
      const postResult = await generalLedgerService.postTransaction(
        journalResult.journal_entry.id,
        user.id
      );

      if (!postResult.success) {
        return { 
          success: false, 
          error: postResult.error || "Failed to post journal entry" 
        };
      }

      // Reset vendor threshold counter
      await supabase
        .from("finance_vendor_profiles")
        .update({ current_threshold: 0 })
        .eq("vendor_id", vendorId);

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'subscription_revenue',
        entityId: vendorId,
        action: 'process',
        oldValues: { current_threshold: profile.current_threshold },
        newValues: {
          subscription_amount: subscriptionAmount,
          journal_entry_id: journalResult.journal_entry.id,
          threshold_reset: true,
        },
      });

      const subscriptionRevenue: SubscriptionRevenue = {
        vendorId,
        subscriptionAmount,
        journalEntryId: journalResult.journal_entry.id,
        recordedAt: new Date(),
      };

      return { success: true, subscriptionRevenue };
    } catch (error) {
      console.error("Unexpected error processing subscription revenue:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const revenueManagerService = new RevenueManagerService();
