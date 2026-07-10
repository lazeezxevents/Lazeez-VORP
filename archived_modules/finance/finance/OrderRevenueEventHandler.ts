import { supabase } from "@/integrations/supabase/client";
import { orderRevenueProcessor, type OrderData } from "./OrderRevenueProcessor";
import { auditLogService } from "./AuditLogService";
import type { Location, RouteData } from "./types";

/**
 * Order Revenue Event Handler Service
 * 
 * Processes revenue events from the finance_revenue_events queue table.
 * This service integrates with the Delivery Module by:
 * - Polling for pending events
 * - Processing events through OrderRevenueProcessor
 * - Updating event status (completed/failed)
 * - Logging performance metrics
 * - Handling errors with retry queue
 * 
 * Requirements: 2.1, 2.6
 * Task: 10.2 Integrate with Delivery Module
 */

// =====================================================
// Types and Interfaces
// =====================================================

export type EventType = 'order_completed' | 'subscription_threshold_reached' | 'manual_adjustment';
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RevenueEvent {
  id: string;
  event_type: EventType;
  order_id: string | null;
  vendor_id: string;
  order_amount: number;
  currency: 'PKR';
  event_data: {
    order_number?: string;
    order_date?: string;
    completed_at?: string;
    rider_id?: string;
    delivery_distance?: number;
    delivery_charge?: number;
    pickup_location?: Location;
    delivery_location?: Location;
    optimized_route?: RouteData;
    category?: string;
  };
  status: EventStatus;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  processingTime: number;
  error?: string;
}

// =====================================================
// Order Revenue Event Handler Service
// =====================================================

export class OrderRevenueEventHandler {
  private isProcessing: boolean = false;
  private pollingInterval: number = 5000; // 5 seconds
  private maxRetries: number = 3;

  /**
   * Process a single revenue event
   * 
   * Requirement 2.1: Automatically record revenue when order is completed
   * Requirement 2.6: Process revenue transactions within 100ms
   * 
   * This method:
   * 1. Marks event as processing
   * 2. Extracts order data from event
   * 3. Calls OrderRevenueProcessor.processOrderRevenue()
   * 4. Updates event status (completed/failed)
   * 5. Logs performance metrics
   */
  async processEvent(eventId: string): Promise<EventProcessingResult> {
    const startTime = performance.now();

    try {
      // Fetch event details
      const { data: event, error: fetchError } = await supabase
        .from("finance_revenue_events")
        .select("*")
        .eq("id", eventId)
        .eq("status", "pending")
        .single();

      if (fetchError || !event) {
        return {
          success: false,
          eventId,
          processingTime: Math.round(performance.now() - startTime),
          error: fetchError?.message || "Event not found or already processed",
        };
      }

      // Mark event as processing
      await supabase
        .from("finance_revenue_events")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", eventId);

      // Extract order data from event
      const orderData: OrderData = {
        orderId: event.order_id || eventId,
        orderNumber: event.event_data.order_number || `ORD-${eventId.substring(0, 8)}`,
        vendorId: event.vendor_id,
        riderId: event.event_data.rider_id || "",
        orderAmount: event.order_amount,
        deliveryCharge: event.event_data.delivery_charge || 0,
        category: event.event_data.category,
        pickupLocation: event.event_data.pickup_location || { lat: 0, lng: 0 },
        deliveryLocation: event.event_data.delivery_location || { lat: 0, lng: 0 },
        distance: event.event_data.delivery_distance || 0,
        optimizedRoute: event.event_data.optimized_route || {
          distance: event.event_data.delivery_distance || 0,
          optimized: false,
        },
        completedAt: event.event_data.completed_at
          ? new Date(event.event_data.completed_at)
          : new Date(),
      };

      // Process order revenue through OrderRevenueProcessor
      const processingResult = await orderRevenueProcessor.processOrderRevenue(orderData);

      if (processingResult.success) {
        // Mark event as completed
        await supabase
          .from("finance_revenue_events")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        // Log audit entry
        await auditLogService.logAuditEntry({
          entityType: "revenue_event",
          entityId: eventId,
          action: "process_completed",
          oldValues: { status: "processing" },
          newValues: {
            status: "completed",
            journal_entry_id: processingResult.journalEntryId,
            vendor_commission: processingResult.vendorCommission,
            rider_commission: processingResult.riderCommission,
            platform_revenue: processingResult.platformRevenue,
            execution_time_ms: processingResult.executionTime,
          },
        });

        const processingTime = Math.round(performance.now() - startTime);

        // Alert if total processing time exceeds 100ms
        if (processingTime > 100) {
          console.warn(
            `⚠️ Event processing exceeded 100ms threshold: ${processingTime}ms for event ${eventId}`
          );
        } else {
          console.log(
            `✓ Event processing completed in ${processingTime}ms for event ${eventId}`
          );
        }

        return {
          success: true,
          eventId,
          processingTime,
        };
      } else {
        // Mark event as failed
        await supabase
          .from("finance_revenue_events")
          .update({
            status: "failed",
            error_message: processingResult.error || "Unknown error",
            retry_count: event.retry_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", eventId);

        // Log to error log if max retries not exceeded
        if (event.retry_count < this.maxRetries) {
          await this.logErrorForRetry(event, processingResult.error || "Unknown error");
        }

        return {
          success: false,
          eventId,
          processingTime: Math.round(performance.now() - startTime),
          error: processingResult.error,
        };
      }
    } catch (error) {
      const processingTime = Math.round(performance.now() - startTime);

      // Mark event as failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await supabase
        .from("finance_revenue_events")
        .update({
          status: "failed",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      console.error(`Error processing event ${eventId}:`, error);

      return {
        success: false,
        eventId,
        processingTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Poll for pending events and process them sequentially
   * 
   * This method continuously polls the finance_revenue_events table
   * for pending events and processes them one at a time.
   * 
   * Requirement 2.6: Process within 100ms per event
   */
  async pollEvents(): Promise<void> {
    if (this.isProcessing) {
      console.log("Event polling already in progress, skipping...");
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch pending events (oldest first)
      const { data: events, error: fetchError } = await supabase
        .from("finance_revenue_events")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(10); // Process up to 10 events per poll

      if (fetchError) {
        console.error("Error fetching pending events:", fetchError);
        return;
      }

      if (!events || events.length === 0) {
        console.log("No pending events to process");
        return;
      }

      console.log(`Processing ${events.length} pending event(s)...`);

      // Process events sequentially
      for (const event of events) {
        const result = await this.processEvent(event.id);

        if (result.success) {
          console.log(
            `✓ Event ${event.id} processed successfully in ${result.processingTime}ms`
          );
        } else {
          console.error(
            `✗ Event ${event.id} failed: ${result.error} (${result.processingTime}ms)`
          );
        }
      }
    } catch (error) {
      console.error("Error in event polling:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start continuous event polling
   * 
   * Starts a polling loop that checks for pending events every 5 seconds
   */
  startPolling(): void {
    console.log("Starting revenue event polling...");

    // Initial poll
    this.pollEvents();

    // Set up interval for continuous polling
    setInterval(() => {
      this.pollEvents();
    }, this.pollingInterval);
  }

  /**
   * Process events using real-time subscription
   * 
   * Alternative to polling - subscribes to INSERT events on finance_revenue_events
   * and processes them immediately
   */
  async subscribeToEvents(): Promise<void> {
    console.log("Subscribing to revenue events...");

    const subscription = supabase
      .channel("revenue_events")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "finance_revenue_events",
          filter: "status=eq.pending",
        },
        async (payload) => {
          console.log("New revenue event received:", payload.new);

          const event = payload.new as RevenueEvent;
          const result = await this.processEvent(event.id);

          if (result.success) {
            console.log(
              `✓ Real-time event ${event.id} processed in ${result.processingTime}ms`
            );
          } else {
            console.error(`✗ Real-time event ${event.id} failed: ${result.error}`);
          }
        }
      )
      .subscribe();

    console.log("Subscribed to revenue events");
  }

  /**
   * Log error to finance_error_log for retry
   * 
   * Requirement 2.8: Queue failed orders for retry without blocking order completion
   */
  private async logErrorForRetry(event: RevenueEvent, errorMessage: string): Promise<void> {
    try {
      // Calculate next retry time with exponential backoff
      const backoffMinutes = Math.pow(2, event.retry_count); // 1, 2, 4, 8 minutes
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await supabase.from("finance_error_log").insert({
        error_type: "revenue_event_processing_failed",
        entityType: "revenue_event",
        entityId: event.id,
        error_message: errorMessage,
        error_data: {
          event_type: event.event_type,
          order_id: event.order_id,
          vendor_id: event.vendor_id,
          order_amount: event.order_amount,
          event_data: event.event_data,
        },
        retry_count: event.retry_count,
        max_retries: this.maxRetries,
        next_retry_at: nextRetryAt.toISOString(),
      });

      console.log(
        `Error logged for event ${event.id}, next retry at ${nextRetryAt.toISOString()}`
      );
    } catch (error) {
      console.error("Failed to log error for retry:", error);
    }
  }

  /**
   * Retry failed events from error log
   * 
   * Processes events that are due for retry based on next_retry_at timestamp
   */
  async retryFailedEvents(): Promise<void> {
    try {
      // Fetch events due for retry
      const { data: errorLogs, error: fetchError } = await supabase
        .from("finance_error_log")
        .select("*")
        .eq("error_type", "revenue_event_processing_failed")
        .is("resolved_at", null)
        .lte("next_retry_at", new Date().toISOString())
        .lt("retry_count", this.maxRetries)
        .limit(5);

      if (fetchError || !errorLogs || errorLogs.length === 0) {
        return;
      }

      console.log(`Retrying ${errorLogs.length} failed event(s)...`);

      for (const errorLog of errorLogs) {
        const eventId = errorLog.entity_id;

        // Reset event status to pending for retry
        await supabase
          .from("finance_revenue_events")
          .update({ status: "pending", updated_at: new Date().toISOString() })
          .eq("id", eventId);

        // Process the event
        const result = await this.processEvent(eventId);

        if (result.success) {
          // Mark error as resolved
          await supabase
            .from("finance_error_log")
            .update({
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", errorLog.id);

          console.log(`✓ Retry successful for event ${eventId}`);
        } else {
          // Update retry count and next retry time
          const newRetryCount = errorLog.retry_count + 1;
          const backoffMinutes = Math.pow(2, newRetryCount);
          const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await supabase
            .from("finance_error_log")
            .update({
              retry_count: newRetryCount,
              next_retry_at: nextRetryAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", errorLog.id);

          console.error(`✗ Retry failed for event ${eventId}, next retry at ${nextRetryAt}`);
        }
      }
    } catch (error) {
      console.error("Error retrying failed events:", error);
    }
  }

  /**
   * Get event processing statistics
   * 
   * Returns counts of events by status for monitoring
   */
  async getEventStatistics(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    try {
      const { data: stats, error } = await supabase.rpc("get_revenue_event_stats");

      if (error) {
        console.error("Error fetching event statistics:", error);
        return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
      }

      return stats || { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    } catch (error) {
      console.error("Error fetching event statistics:", error);
      return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    }
  }
}

// Export singleton instance
export const orderRevenueEventHandler = new OrderRevenueEventHandler();
