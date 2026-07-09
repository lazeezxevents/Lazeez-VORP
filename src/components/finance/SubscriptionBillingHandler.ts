import { supabase } from "@/integrations/supabase/client";
import { subscriptionManagerService } from "./SubscriptionManagerService";
import { auditLogService } from "./AuditLogService";

/**
 * Subscription Billing Event Handler
 * 
 * Handles subscription billing events including:
 * - Listening for threshold reached events
 * - Triggering invoice generation
 * - Recording subscription revenue in general ledger
 * - Processing cycle-based billing
 * - Sending invoice notifications to vendors
 * - Sending payment reminders for overdue invoices
 * 
 * Requirements: 5.3, 5.8, 5.9, 30.1
 * Task: 14.1 Create subscription billing event handler
 * Task: 14.3 Integrate with notification system
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface SubscriptionBillingEvent {
  id: string;
  event_type: 'subscription_threshold_reached' | 'subscription_cycle_due';
  vendor_id: string;
  event_data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
}

export interface BillingResult {
  success: boolean;
  invoice_id?: string;
  invoice_number?: string;
  amount?: number;
  error?: string;
}

// =====================================================
// Subscription Billing Handler Service
// =====================================================

export class SubscriptionBillingHandlerService {
  private isProcessing: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;

  /**
   * Start listening for subscription billing events
   * 
   * Requirement 5.3: Listen for threshold reached events
   */
  startEventListener(intervalMs: number = 30000): void {
    if (this.pollingInterval) {
      console.warn("Event listener already running");
      return;
    }

    console.log("Starting subscription billing event listener");

    // Process immediately on start
    this.processPendingEvents();

    // Then poll at intervals
    this.pollingInterval = setInterval(() => {
      this.processPendingEvents();
    }, intervalMs);
  }

  /**
   * Stop listening for subscription billing events
   */
  stopEventListener(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log("Stopped subscription billing event listener");
    }
  }

  /**
   * Process all pending subscription billing events
   * 
   * Requirement 5.3: Trigger invoice generation when threshold reached
   * Requirement 5.9: Record subscription revenue in general ledger
   */
  async processPendingEvents(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    this.isProcessing = true;

    try {
      // Fetch pending subscription billing events
      const { data: events, error } = await supabase
        .from("finance_revenue_events")
        .select("*")
        .in("event_type", ["subscription_threshold_reached", "subscription_cycle_due"])
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) {
        console.error("Error fetching subscription billing events:", error);
        return;
      }

      if (!events || events.length === 0) {
        return; // No pending events
      }

      console.log(`Processing ${events.length} subscription billing events`);

      // Process each event
      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      console.error("Unexpected error processing subscription billing events:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single subscription billing event
   * 
   * @private
   */
  private async processEvent(event: any): Promise<void> {
    try {
      // Mark event as processing
      await this.markEventProcessing(event.id);

      // Get vendor financial profile
      const { data: profile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("*")
        .eq("vendor_id", event.vendor_id)
        .single();

      if (profileError || !profile) {
        throw new Error(`Vendor financial profile not found for vendor ${event.vendor_id}`);
      }

      // Determine subscription amount
      const subscriptionAmount = profile.subscription_amount || 5000; // Default PKR 5000

      // Generate invoice using SubscriptionManagerService
      const invoiceResult = await subscriptionManagerService.generateInvoice(
        event.vendor_id,
        subscriptionAmount
      );

      if (!invoiceResult.success || !invoiceResult.invoice) {
        throw new Error(invoiceResult.error || "Failed to generate invoice");
      }

      // Mark event as completed
      await this.markEventCompleted(event.id, {
        invoice_id: invoiceResult.invoice.id,
        invoice_number: invoiceResult.invoice.invoiceNumber,
        amount: invoiceResult.invoice.totalAmount,
      });

      // Send invoice notification to vendor
      await this.sendInvoiceNotification(
        event.vendor_id,
        invoiceResult.invoice.invoiceNumber,
        invoiceResult.invoice.totalAmount,
        invoiceResult.invoice.dueDate
      );

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: "subscription_billing",
        entityId: event.id,
        action: "process",
        oldValues: { status: "pending" },
        newValues: {
          status: "completed",
          invoice_id: invoiceResult.invoice.id,
          invoice_number: invoiceResult.invoice.invoiceNumber,
          amount: invoiceResult.invoice.totalAmount,
          notification_sent: true,
        },
      });

      console.log(
        `Successfully processed subscription billing event ${event.id} for vendor ${event.vendor_id}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed to process subscription billing event ${event.id}:`, errorMessage);

      // Mark event as failed
      await this.markEventFailed(event.id, errorMessage);

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: "subscription_billing",
        entityId: event.id,
        action: "process_failed",
        oldValues: { status: "pending" },
        newValues: {
          status: "failed",
          error: errorMessage,
        },
      });
    }
  }

  /**
   * Mark event as processing
   * 
   * @private
   */
  private async markEventProcessing(eventId: string): Promise<void> {
    const { error } = await supabase
      .from("finance_revenue_events")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (error) {
      throw new Error(`Failed to mark event as processing: ${error.message}`);
    }
  }

  /**
   * Mark event as completed
   * 
   * @private
   */
  private async markEventCompleted(eventId: string, result: any): Promise<void> {
    const { error } = await supabase
      .from("finance_revenue_events")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        event_data: result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (error) {
      throw new Error(`Failed to mark event as completed: ${error.message}`);
    }
  }

  /**
   * Mark event as failed
   * 
   * @private
   */
  private async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    const { error } = await supabase
      .from("finance_revenue_events")
      .update({
        status: "failed",
        error_message: errorMessage,
        retry_count: supabase.rpc("increment", { x: 1 }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (error) {
      console.error(`Failed to mark event as failed: ${error.message}`);
    }
  }

  /**
   * Manually trigger billing for a vendor
   * 
   * Useful for testing or manual billing operations
   */
  async triggerManualBilling(vendorId: string, amount: number): Promise<BillingResult> {
    try {
      // Generate invoice
      const invoiceResult = await subscriptionManagerService.generateInvoice(vendorId, amount);

      if (!invoiceResult.success || !invoiceResult.invoice) {
        return {
          success: false,
          error: invoiceResult.error || "Failed to generate invoice",
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: "subscription_billing",
        entityId: vendorId,
        action: "manual_trigger",
        oldValues: null,
        newValues: {
          invoice_id: invoiceResult.invoice.id,
          invoice_number: invoiceResult.invoice.invoiceNumber,
          amount: invoiceResult.invoice.totalAmount,
        },
      });

      return {
        success: true,
        invoice_id: invoiceResult.invoice.id,
        invoice_number: invoiceResult.invoice.invoiceNumber,
        amount: invoiceResult.invoice.totalAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get billing event status
   */
  async getEventStatus(eventId: string): Promise<SubscriptionBillingEvent | null> {
    const { data, error } = await supabase
      .from("finance_revenue_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      event_type: data.event_type,
      vendor_id: data.vendor_id,
      event_data: data.event_data || {},
      status: data.status,
      created_at: new Date(data.created_at),
    };
  }

  /**
   * Get pending events count
   */
  async getPendingEventsCount(): Promise<number> {
    const { count, error } = await supabase
      .from("finance_revenue_events")
      .select("*", { count: "exact", head: true })
      .in("event_type", ["subscription_threshold_reached", "subscription_cycle_due"])
      .eq("status", "pending");

    if (error) {
      console.error("Error getting pending events count:", error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Send invoice notification to vendor
   * 
   * Requirement 5.8: Send invoice notification to vendor
   * Requirement 30.1: Integrate with notification system
   * 
   * @private
   */
  private async sendInvoiceNotification(
    vendorId: string,
    invoiceNumber: string,
    amount: number,
    dueDate: Date
  ): Promise<void> {
    try {
      // Get vendor details
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .select("name, email, contact_person")
        .eq("id", vendorId)
        .single();

      if (vendorError || !vendor) {
        console.error("Failed to fetch vendor details:", vendorError);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        return;
      }

      // Create notification
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id, // System notification
          type: "invoice_generated",
          title: "Subscription invoice generated",
          message: `Invoice ${invoiceNumber} for ₨${amount.toLocaleString()} has been generated for ${vendor.name}. Due date: ${new Date(dueDate).toLocaleDateString()}`,
          metadata: {
            vendor_id: vendorId,
            vendor_name: vendor.name,
            invoice_number: invoiceNumber,
            amount: amount,
            due_date: dueDate,
            category: "finance",
          },
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
        return;
      }

      // TODO: Send email notification to vendor
      // This would integrate with an email service (e.g., SendGrid, AWS SES)
      // For now, we just log the intent
      console.log(`Email notification would be sent to ${vendor.email || vendor.contact_person}`);
      console.log(`Subject: Subscription Invoice ${invoiceNumber}`);
      console.log(`Amount: ₨${amount.toLocaleString()}`);
      console.log(`Due Date: ${new Date(dueDate).toLocaleDateString()}`);
    } catch (error) {
      console.error("Unexpected error sending invoice notification:", error);
    }
  }

  /**
   * Send payment reminder for overdue invoices
   * 
   * Requirement 5.8: Send payment reminders for overdue invoices
   * Requirement 30.1: Integrate with notification system
   */
  async sendPaymentReminders(): Promise<void> {
    try {
      // Get overdue invoices
      const { data: overdueInvoices, error } = await supabase
        .from("finance_invoices")
        .select(`
          id,
          invoice_number,
          vendor_id,
          total_amount,
          amount_due,
          due_date,
          vendor:vendors(id, name, email, contact_person)
        `)
        .eq("status", "overdue")
        .gt("amount_due", 0);

      if (error) {
        console.error("Error fetching overdue invoices:", error);
        return;
      }

      if (!overdueInvoices || overdueInvoices.length === 0) {
        console.log("No overdue invoices found");
        return;
      }

      console.log(`Sending payment reminders for ${overdueInvoices.length} overdue invoices`);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("User not authenticated");
        return;
      }

      // Send reminder for each overdue invoice
      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Create notification
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            user_id: user.id, // System notification
            type: "payment_reminder",
            title: "Payment reminder",
            message: `Invoice ${invoice.invoice_number} for ${invoice.vendor.name} is ${daysOverdue} days overdue. Amount due: ₨${invoice.amount_due.toLocaleString()}`,
            metadata: {
              vendor_id: invoice.vendor_id,
              vendor_name: invoice.vendor.name,
              invoice_id: invoice.id,
              invoice_number: invoice.invoice_number,
              amount_due: invoice.amount_due,
              days_overdue: daysOverdue,
              category: "finance",
            },
            is_read: false,
          });

        if (notificationError) {
          console.error(
            `Failed to create payment reminder for invoice ${invoice.invoice_number}:`,
            notificationError
          );
          continue;
        }

        // TODO: Send email reminder to vendor
        console.log(`Payment reminder would be sent to ${invoice.vendor.email || invoice.vendor.contact_person}`);
        console.log(`Invoice: ${invoice.invoice_number}`);
        console.log(`Days Overdue: ${daysOverdue}`);
        console.log(`Amount Due: ₨${invoice.amount_due.toLocaleString()}`);

        // Log audit entry
        await auditLogService.logAuditEntry({
          entityType: "invoice",
          entityId: invoice.id,
          action: "payment_reminder_sent",
          oldValues: null,
          newValues: {
            invoice_number: invoice.invoice_number,
            vendor_id: invoice.vendor_id,
            days_overdue: daysOverdue,
            amount_due: invoice.amount_due,
          },
        });
      }

      console.log(`Payment reminders sent for ${overdueInvoices.length} invoices`);
    } catch (error) {
      console.error("Unexpected error sending payment reminders:", error);
    }
  }

  /**
   * Start payment reminder scheduler
   * 
   * Sends payment reminders daily for overdue invoices
   */
  startPaymentReminderScheduler(intervalMs: number = 86400000): void {
    // 86400000ms = 24 hours
    console.log("Starting payment reminder scheduler");

    // Send reminders immediately on start
    this.sendPaymentReminders();

    // Then send daily
    setInterval(() => {
      this.sendPaymentReminders();
    }, intervalMs);
  }
}

// Export singleton instance
export const subscriptionBillingHandler = new SubscriptionBillingHandlerService();
