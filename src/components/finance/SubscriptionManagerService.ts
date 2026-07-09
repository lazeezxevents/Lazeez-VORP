import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput } from "./types";

/**
 * Subscription Manager Service Class
 * 
 * Provides subscription management functionality including:
 * - Creating and managing vendor subscriptions
 * - Tracking order thresholds for threshold-based billing
 * - Automatic invoice generation when threshold reached
 * - Proration for mid-cycle plan changes
 * - Integration with invoice and revenue systems
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10
 */

// =====================================================
// Types and Interfaces
// =====================================================

export type BillingCycle = 'monthly' | 'quarterly' | 'annual';
export type SubscriptionStatus = 'active' | 'suspended' | 'cancelled' | 'pending';

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

export interface SubscriptionResult {
  success: boolean;
  subscription?: Subscription;
  error?: string;
}

export interface ThresholdCheckResult {
  success: boolean;
  thresholdStatus?: ThresholdStatus;
  error?: string;
}

export interface InvoiceResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

export interface ProrationResult {
  success: boolean;
  proratedAmount?: ProratedAmount;
  error?: string;
}

// =====================================================
// Subscription Manager Service
// =====================================================

export class SubscriptionManagerService {
  /**
   * Create a new subscription for a vendor
   * 
   * Requirement 5.1: Create and manage subscription plans
   * Requirement 5.5: Calculate next billing date based on subscription plan cycle
   * Requirement 5.6: Support monthly, quarterly, and annual billing cycles
   */
  async createSubscription(
    vendorId: string,
    plan: SubscriptionPlan
  ): Promise<SubscriptionResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Check if vendor exists
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("id")
        .eq("id", vendorId)
        .single();

      if (vendorError || !vendor) {
        return { success: false, error: "Vendor not found" };
      }

      // Calculate period dates based on billing cycle
      const startDate = new Date();
      const currentPeriodStart = new Date(startDate);
      const currentPeriodEnd = this.calculatePeriodEnd(startDate, plan.billingCycle);
      const nextBillingDate = new Date(currentPeriodEnd);
      nextBillingDate.setDate(nextBillingDate.getDate() + 1);

      // Update or create vendor financial profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("id")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        return { success: false, error: profileError.message };
      }

      if (profile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("finance_vendor_profiles")
          .update({
            subscription_id: plan.id,
            subscription_status: 'active',
            threshold_limit: plan.customThreshold || 100,
            current_threshold: 0,
            next_billing_date: nextBillingDate.toISOString().split('T')[0],
          })
          .eq("vendor_id", vendorId);

        if (updateError) {
          return { success: false, error: updateError.message };
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from("finance_vendor_profiles")
          .insert({
            vendor_id: vendorId,
            subscription_id: plan.id,
            subscription_status: 'active',
            threshold_limit: plan.customThreshold || 100,
            current_threshold: 0,
            next_billing_date: nextBillingDate.toISOString().split('T')[0],
          });

        if (insertError) {
          return { success: false, error: insertError.message };
        }
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'subscription',
        entityId: vendorId,
        action: 'create',
        oldValues: null,
        newValues: {
          vendor_id: vendorId,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle: plan.billingCycle,
          base_price: plan.basePrice,
          threshold_limit: plan.customThreshold || 100,
          next_billing_date: nextBillingDate.toISOString(),
        },
      });

      const subscription: Subscription = {
        id: plan.id,
        vendorId,
        planId: plan.id,
        status: 'active',
        startDate,
        currentPeriodStart,
        currentPeriodEnd,
        thresholdReached: false,
        orderCount: 0,
      };

      return { success: true, subscription };
    } catch (error) {
      console.error("Unexpected error creating subscription:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check vendor threshold status
   * 
   * Requirement 5.1: Track order count per vendor against configured threshold limit
   * Requirement 5.2: Increment threshold counter on each order completion
   */
  async checkThreshold(vendorId: string): Promise<ThresholdCheckResult> {
    try {
      // Fetch vendor financial profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("current_threshold, threshold_limit, next_billing_date, subscription_status")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        return {
          success: false,
          error: "Vendor financial profile not found",
        };
      }

      const thresholdReached = profile.current_threshold >= (profile.threshold_limit || 100);

      const thresholdStatus: ThresholdStatus = {
        vendorId,
        currentOrderCount: profile.current_threshold,
        thresholdLimit: profile.threshold_limit || 100,
        thresholdReached,
        nextBillingDate: profile.next_billing_date ? new Date(profile.next_billing_date) : null,
      };

      return { success: true, thresholdStatus };
    } catch (error) {
      console.error("Unexpected error checking threshold:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate invoice when threshold reached
   * 
   * Requirement 5.3: Generate subscription invoice automatically when threshold reached
   * Requirement 5.4: Reset vendor threshold counter to zero after invoice generation
   * Requirement 5.5: Calculate next billing date based on subscription plan cycle
   */
  async generateInvoice(vendorId: string, subscriptionAmount: number): Promise<InvoiceResult> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

      // Fetch vendor profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("*")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        return {
          success: false,
          error: "Vendor financial profile not found",
        };
      }

      // Check if threshold reached
      if (profile.current_threshold < (profile.threshold_limit || 100)) {
        return {
          success: false,
          error: "Subscription threshold not reached",
        };
      }

      // Generate invoice number
      const invoiceNumber = `INV-SUB-${Date.now()}`;
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

      // Create invoice line item
      const lineItem: InvoiceLineItem = {
        description: `Subscription fee for ${profile.threshold_limit} orders`,
        quantity: 1,
        unitPrice: subscriptionAmount,
        taxRate: 0, // No tax for now
        amount: subscriptionAmount,
      };

      const subtotal = subscriptionAmount;
      const taxAmount = 0;
      const totalAmount = subtotal + taxAmount;

      // Record subscription revenue in general ledger
      const revenueResult = await this.recordSubscriptionRevenue(
        vendorId,
        subscriptionAmount
      );

      if (!revenueResult.success) {
        return {
          success: false,
          error: revenueResult.error || "Failed to record subscription revenue",
        };
      }

      // Reset threshold counter and update next billing date
      const { error: updateError } = await supabase
        .from("finance_vendor_profiles")
        .update({
          current_threshold: 0,
          next_billing_date: this.calculateNextBillingDate(profile.next_billing_date),
        })
        .eq("vendor_id", vendorId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'invoice',
        entityId: invoiceNumber,
        action: 'generate',
        oldValues: { current_threshold: profile.current_threshold },
        newValues: {
          invoice_number: invoiceNumber,
          vendor_id: vendorId,
          subscription_amount: subscriptionAmount,
          threshold_reset: true,
          journal_entry_id: revenueResult.journalEntryId,
        },
      });

      const invoice: Invoice = {
        id: invoiceNumber,
        invoiceNumber,
        vendorId,
        issueDate,
        dueDate,
        lineItems: [lineItem],
        subtotal,
        taxAmount,
        totalAmount,
        amountPaid: 0,
        amountDue: totalAmount,
        status: 'sent',
        currency: 'PKR',
      };

      return { success: true, invoice };
    } catch (error) {
      console.error("Unexpected error generating invoice:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate prorated billing amount for mid-cycle changes
   * 
   * Requirement 5.7: Prorate billing amount for mid-cycle plan changes
   */
  async prorateBilling(
    vendorId: string,
    newAmount: number,
    changeDate: Date
  ): Promise<ProrationResult> {
    try {
      // Fetch vendor profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("next_billing_date")
        .eq("vendor_id", vendorId)
        .single();

      if (profileError || !profile) {
        return {
          success: false,
          error: "Vendor financial profile not found",
        };
      }

      if (!profile.next_billing_date) {
        return {
          success: false,
          error: "No billing date found for vendor",
        };
      }

      // Calculate proration
      const nextBillingDate = new Date(profile.next_billing_date);
      const currentDate = new Date(changeDate);
      
      // Calculate days remaining in current period
      const daysRemaining = Math.ceil(
        (nextBillingDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Assume 30 days per billing period (can be adjusted based on actual cycle)
      const totalDays = 30;
      const daysUsed = totalDays - daysRemaining;

      // Calculate prorated amount
      const proratedAmount = (newAmount / totalDays) * daysRemaining;

      const prorationResult: ProratedAmount = {
        originalAmount: newAmount,
        proratedAmount: Math.round(proratedAmount * 100) / 100, // Round to 2 decimals
        daysUsed,
        totalDays,
        effectiveDate: changeDate,
      };

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'subscription',
        entityId: vendorId,
        action: 'prorate',
        oldValues: null,
        newValues: {
          vendor_id: vendorId,
          original_amount: newAmount,
          prorated_amount: prorationResult.proratedAmount,
          days_remaining: daysRemaining,
          change_date: changeDate.toISOString(),
        },
      });

      return { success: true, proratedAmount: prorationResult };
    } catch (error) {
      console.error("Unexpected error calculating proration:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record subscription revenue in general ledger
   * 
   * Requirement 5.9: Record subscription revenue in General_Ledger
   * 
   * @private
   */
  private async recordSubscriptionRevenue(
    vendorId: string,
    amount: number
  ): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: "User not authenticated" };
      }

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
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!cashAccount || !subscriptionRevenueAccount) {
        return {
          success: false,
          error: "Required accounts not found",
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
            debit: amount,
            credit: 0,
            currency: 'PKR',
            description: "Cash from subscription",
          },
          {
            account_id: subscriptionRevenueAccount.id,
            debit: 0,
            credit: amount,
            currency: 'PKR',
            description: "Subscription revenue",
          },
        ],
      };

      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (!journalResult.success || !journalResult.journal_entry) {
        return {
          success: false,
          error: journalResult.error || "Failed to create journal entry",
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
          error: postResult.error || "Failed to post journal entry",
        };
      }

      return { success: true, journalEntryId: journalResult.journal_entry.id };
    } catch (error) {
      console.error("Unexpected error recording subscription revenue:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Calculate period end date based on billing cycle
   * 
   * @private
   */
  private calculatePeriodEnd(startDate: Date, cycle: BillingCycle): Date {
    const endDate = new Date(startDate);

    switch (cycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    endDate.setDate(endDate.getDate() - 1); // Last day of period
    return endDate;
  }

  /**
   * Calculate next billing date
   * 
   * @private
   */
  private calculateNextBillingDate(currentBillingDate: string | null): string {
    const nextDate = currentBillingDate
      ? new Date(currentBillingDate)
      : new Date();

    // Add 30 days for next billing (can be adjusted based on plan)
    nextDate.setDate(nextDate.getDate() + 30);

    return nextDate.toISOString().split('T')[0];
  }
}

// Export singleton instance
export const subscriptionManagerService = new SubscriptionManagerService();
