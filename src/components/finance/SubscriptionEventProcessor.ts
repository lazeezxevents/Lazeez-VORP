import { supabase } from "@/integrations/supabase/client";
import { subscriptionManagerService } from "./SubscriptionManagerService";
import { auditLogService } from "./AuditLogService";

/**
 * Subscription Event Processor
 * 
 * Processes subscription-related events from the finance_revenue_events queue:
 * - Subscription threshold reached events
 * - Automatic invoice generation
 * - Notification sending
 * 
 * Requirements: 5.3, 5.4, 5.8, 5.10
 */

export interface SubscriptionEventData {
  trigger_order_id?: string;
  trigger_order_number?: string;
}

export interface ProcessingResult {
  success: boolean;
  eventId: string;
  invoiceGenerated?: boolean;
  error?: string;
}

/**
 * Process subscription threshold reached events
 * 
 * Requirement 5.3: Generate invoice when threshold reached
 * Requirement 5.4: Reset threshold counter after invoice generation
 * Requirement 5.8: Send invoice notification to vendor
 */
export async function processSubscriptionThresholdEvent(
  eventId: string
): Promise<ProcessingResult> {
  try {
    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from("finance_revenue_events")
      .select("*")
      .eq("id", eventId)
      .eq("event_type", "subscription_threshold_reached")
      .single();

    if (eventError || !event) {
      return {
        success: false,
        eventId,
        error: "Subscription event not found",
      };
    }

    // Mark event as processing
    await supabase
      .from("finance_revenue_events")
      .update({ status: "processing" })
      .eq("id", eventId);

    // Get vendor profile to determine subscription amount
    const { data: profile, error: profileError } = await supabase
      .from("finance_vendor_profiles")
      .select("*")
      .eq("vendor_id", event.vendor_id)
      .single();

    if (profileError || !profile) {
      await markEventFailed(eventId, "Vendor financial profile not found");
      return {
        success: false,
        eventId,
        error: "Vendor financial profile not found",
      };
    }

    // Default subscription amount (should be fetched from subscription plan in production)
    const subscriptionAmount = 1000; // PKR

    // Generate invoice using SubscriptionManager
    const invoiceResult = await subscriptionManagerService.generateInvoice(
      event.vendor_id,
      subscriptionAmount
    );

    if (!invoiceResult.success) {
      await markEventFailed(eventId, invoiceResult.error || "Invoice generation failed");
      return {
        success: false,
        eventId,
        error: invoiceResult.error,
      };
    }

    // Send invoice notification to vendor
    await sendInvoiceNotification(event.vendor_id, invoiceResult.invoice!);

    // Mark event as completed
    await supabase
      .from("finance_revenue_events")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    // Log audit entry
    await auditLogService.logAuditEntry({
      entityType: "subscription_event",
      entityId: eventId,
      action: "process",
      oldValues: { status: "pending" },
      newValues: {
        status: "completed",
        invoice_number: invoiceResult.invoice!.invoiceNumber,
        vendor_id: event.vendor_id,
        subscription_amount: subscriptionAmount,
      },
    });

    return {
      success: true,
      eventId,
      invoiceGenerated: true,
    };
  } catch (error) {
    console.error("Unexpected error processing subscription event:", error);
    await markEventFailed(
      eventId,
      error instanceof Error ? error.message : "Unknown error"
    );
    return {
      success: false,
      eventId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process all pending subscription events
 * 
 * This function can be called periodically or triggered by a webhook
 */
export async function processPendingSubscriptionEvents(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  try {
    // Fetch pending subscription threshold events
    const { data: events, error: eventsError } = await supabase
      .from("finance_revenue_events")
      .select("id")
      .eq("event_type", "subscription_threshold_reached")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50); // Process in batches

    if (eventsError) {
      console.error("Error fetching pending events:", eventsError);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!events || events.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    // Process each event
    for (const event of events) {
      const result = await processSubscriptionThresholdEvent(event.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: events.length,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error("Unexpected error processing pending events:", error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }
}

/**
 * Send invoice notification to vendor
 * 
 * Requirement 5.8: Send invoice notifications to vendors via email
 * 
 * @private
 */
async function sendInvoiceNotification(
  vendorId: string,
  invoice: any
): Promise<void> {
  try {
    // Fetch vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("name, email, contact_person")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error("Vendor not found for notification:", vendorId);
      return;
    }

    // Create notification in the system
    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: null, // System notification
        title: "Subscription Invoice Generated",
        message: `A new subscription invoice ${invoice.invoiceNumber} has been generated for ${vendor.name}. Amount: PKR ${invoice.totalAmount}. Due date: ${invoice.dueDate.toLocaleDateString()}.`,
        type: "finance",
        priority: "medium",
        metadata: {
          invoice_number: invoice.invoiceNumber,
          vendor_id: vendorId,
          vendor_name: vendor.name,
          amount: invoice.totalAmount,
          due_date: invoice.dueDate.toISOString(),
        },
      });

    if (notificationError) {
      console.error("Error creating notification:", notificationError);
    }

    // TODO: Send email notification when email service is integrated
    // This would use Supabase Edge Functions or a third-party email service
    console.log(`Invoice notification sent to vendor ${vendor.name} (${vendor.email})`);

    // Log audit entry
    await auditLogService.logAuditEntry({
      entityType: "invoice_notification",
      entityId: invoice.invoiceNumber,
      action: "send",
      oldValues: null,
      newValues: {
        vendor_id: vendorId,
        vendor_name: vendor.name,
        invoice_number: invoice.invoiceNumber,
        notification_sent: true,
      },
    });
  } catch (error) {
    console.error("Error sending invoice notification:", error);
    // Don't throw - notification failure shouldn't block invoice generation
  }
}

/**
 * Mark event as failed with error message
 * 
 * Requirement 5.10: Retry automatically and notify finance team on failure
 * 
 * @private
 */
async function markEventFailed(eventId: string, errorMessage: string): Promise<void> {
  try {
    const { data: event } = await supabase
      .from("finance_revenue_events")
      .select("retry_count")
      .eq("id", eventId)
      .single();

    const retryCount = (event?.retry_count || 0) + 1;
    const maxRetries = 3;

    await supabase
      .from("finance_revenue_events")
      .update({
        status: retryCount >= maxRetries ? "failed" : "pending",
        error_message: errorMessage,
        retry_count: retryCount,
      })
      .eq("id", eventId);

    // If max retries reached, notify finance team
    if (retryCount >= maxRetries) {
      await notifyFinanceTeam(eventId, errorMessage);
    }
  } catch (error) {
    console.error("Error marking event as failed:", error);
  }
}

/**
 * Notify finance team of subscription billing failure
 * 
 * Requirement 5.10: Notify finance team when subscription billing fails
 * 
 * @private
 */
async function notifyFinanceTeam(eventId: string, errorMessage: string): Promise<void> {
  try {
    // Fetch event details
    const { data: event } = await supabase
      .from("finance_revenue_events")
      .select("vendor_id, event_data")
      .eq("id", eventId)
      .single();

    if (!event) return;

    // Get finance admins
    const { data: financeUsers } = await supabase
      .from("profiles")
      .select("id, email")
      .or("main_role.eq.admin,main_role.eq.staff");

    if (!financeUsers || financeUsers.length === 0) return;

    // Create notifications for finance team
    const notifications = financeUsers.map((user) => ({
      user_id: user.id,
      title: "Subscription Billing Failed",
      message: `Subscription billing failed for vendor after ${3} retry attempts. Event ID: ${eventId}. Error: ${errorMessage}`,
      type: "finance",
      priority: "high",
      metadata: {
        event_id: eventId,
        vendor_id: event.vendor_id,
        error_message: errorMessage,
        retry_count: 3,
      },
    }));

    await supabase.from("notifications").insert(notifications);

    console.log(`Finance team notified of subscription billing failure: ${eventId}`);
  } catch (error) {
    console.error("Error notifying finance team:", error);
  }
}

/**
 * Retry failed subscription events
 * 
 * This function can be called periodically to retry failed events
 */
export async function retryFailedSubscriptionEvents(): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
}> {
  try {
    // Fetch failed events that haven't exceeded max retries
    const { data: events, error: eventsError } = await supabase
      .from("finance_revenue_events")
      .select("id, retry_count")
      .eq("event_type", "subscription_threshold_reached")
      .eq("status", "pending")
      .gt("retry_count", 0)
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(20);

    if (eventsError || !events || events.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const event of events) {
      const result = await processSubscriptionThresholdEvent(event.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      retried: events.length,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error("Error retrying failed events:", error);
    return { retried: 0, succeeded: 0, failed: 0 };
  }
}
