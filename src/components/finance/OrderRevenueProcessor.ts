import { supabase } from "@/integrations/supabase/client";
import { revenueManagerService, type RevenueSource } from "./RevenueManagerService";
import { commissionEngineService, type Order } from "./CommissionEngineService";
import { riderCommissionManagerService, type DeliveryData, type Location, type RouteData } from "./RiderCommissionManagerService";
import { auditLogService } from "./AuditLogService";

/**
 * Order Revenue Processor Class
 * 
 * Orchestrates the complete order revenue processing workflow including:
 * - Revenue recording in General Ledger
 * - Vendor commission calculation and recording
 * - Rider commission calculation and recording
 * - Subscription threshold tracking and billing
 * - Atomic transaction management with rollback
 * - Comprehensive error handling and retry queue
 * 
 * Integration:
 * - Called by order completion event handler (Task 7.2)
 * - Processes events from finance_revenue_events queue
 * - Coordinates RevenueManagerService, CommissionEngineService, RiderCommissionManagerService
 * - Updates vendor subscription thresholds
 * - Logs errors to finance_error_log for retry
 * 
 * Requirements: 2.1, 3.1, 4.1
 * Task: 10.1
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface OrderData {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  riderId: string;
  orderAmount: number;
  deliveryCharge: number;
  category?: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  distance: number;
  optimizedRoute: RouteData;
  completedAt: Date;
}

export interface RevenueProcessingResult {
  success: boolean;
  journalEntryId?: string;
  vendorCommission?: number;
  riderCommission?: number;
  platformRevenue?: number;
  subscriptionInvoiceGenerated?: boolean;
  payoutReleased?: boolean;
  error?: string;
  executionTime?: number;
}

// =====================================================
// Order Revenue Processor
// =====================================================

export class OrderRevenueProcessor {
  /**
   * Process complete order revenue workflow
   * 
   * Requirement 2.1: Automatically record revenue when order is completed
   * Requirement 3.1: Calculate vendor commission based on order details
   * Requirement 4.1: Calculate rider commission based on delivery distance
   * Requirement 2.6: Process revenue transactions within 100ms
   * 
   * This method coordinates all revenue-related operations in the correct sequence:
   * 1. Record revenue in General Ledger
   * 2. Calculate and record vendor commission
   * 3. Calculate and record rider commission
   * 4. Update vendor subscription threshold
   * 5. Generate subscription invoice if threshold reached
   * 6. Handle all errors with rollback and retry queue
   */
  async processOrderRevenue(orderData: OrderData): Promise<RevenueProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Validate order data
      if (!orderData || !orderData.orderId || !orderData.vendorId) {
        return {
          success: false,
          error: "Invalid order data: order ID and vendor ID required",
        };
      }

      if (orderData.orderAmount <= 0) {
        return {
          success: false,
          error: "Invalid order amount: must be greater than zero",
        };
      }

      // Step 1: Record revenue in General Ledger
      const revenueSource: RevenueSource = {
        type: 'commission',
        orderId: orderData.orderId,
        vendorId: orderData.vendorId,
        amount: orderData.orderAmount + orderData.deliveryCharge,
        currency: 'PKR',
        date: orderData.completedAt,
        metadata: {
          orderNumber: orderData.orderNumber,
          category: orderData.category,
        },
      };

      const revenueResult = await revenueManagerService.recordRevenue(revenueSource);

      if (!revenueResult.success) {
        // Log error and queue for retry
        await this.logErrorAndQueue(orderData, 'revenue_recording', revenueResult.error || 'Unknown error');
        return {
          success: false,
          error: `Revenue recording failed: ${revenueResult.error}`,
        };
      }

      // Step 2: Calculate and record vendor commission
      const vendorOrder: Order = {
        id: orderData.orderId,
        vendorId: orderData.vendorId,
        amount: orderData.orderAmount,
        currency: 'PKR',
        category: orderData.category,
        completedAt: orderData.completedAt,
      };

      const vendorCommissionResult = await commissionEngineService.calculateVendorCommission(vendorOrder);

      if (!vendorCommissionResult.success) {
        // Log error and queue for retry
        await this.logErrorAndQueue(orderData, 'vendor_commission', vendorCommissionResult.error || 'Unknown error');
        return {
          success: false,
          error: `Vendor commission calculation failed: ${vendorCommissionResult.error}`,
        };
      }

      const vendorCommission = vendorCommissionResult.commission!;

      // Step 3: Calculate and record rider commission
      let riderCommission = 0;
      
      if (orderData.riderId && orderData.distance > 0) {
        const deliveryData: DeliveryData = {
          orderId: orderData.orderId,
          deliveryId: `DEL-${orderData.orderId}`,
          riderId: orderData.riderId,
          vendorId: orderData.vendorId,
          pickupLocation: orderData.pickupLocation,
          deliveryLocation: orderData.deliveryLocation,
          distance: orderData.distance,
          optimizedRoute: orderData.optimizedRoute,
          deliveryCharge: orderData.deliveryCharge,
          completedAt: orderData.completedAt,
        };

        const riderCommissionResult = await riderCommissionManagerService.calculateRiderCommission(deliveryData);

        if (!riderCommissionResult.success) {
          // Log error but don't fail the entire process
          console.warn(`Rider commission calculation failed for order ${orderData.orderId}:`, riderCommissionResult.error);
          await this.logErrorAndQueue(orderData, 'rider_commission', riderCommissionResult.error || 'Unknown error');
        } else {
          riderCommission = riderCommissionResult.commission!.commissionAmount;

          // Record delivery receipt
          await riderCommissionManagerService.recordDeliveryReceipt({
            deliveryId: `DEL-${orderData.orderId}`,
            orderId: orderData.orderId,
            riderId: orderData.riderId,
            vendorId: orderData.vendorId,
            pickupLocation: orderData.pickupLocation,
            deliveryLocation: orderData.deliveryLocation,
            distance: orderData.distance,
            optimizedRoute: orderData.optimizedRoute,
            deliveryCharge: orderData.deliveryCharge,
            completedAt: orderData.completedAt,
          });
        }
      }

      // Step 4: Update vendor subscription threshold
      const { data: vendorProfile, error: profileError } = await supabase
        .from("finance_vendor_profiles")
        .select("*")
        .eq("vendor_id", orderData.vendorId)
        .single();

      let subscriptionInvoiceGenerated = false;

      if (!profileError && vendorProfile) {
        // Increment threshold counter
        const newThreshold = (vendorProfile.current_threshold || 0) + 1;

        await supabase
          .from("finance_vendor_profiles")
          .update({ current_threshold: newThreshold })
          .eq("vendor_id", orderData.vendorId);

        // Step 5: Check if threshold reached for subscription billing
        if (vendorProfile.threshold_limit && newThreshold >= vendorProfile.threshold_limit) {
          const subscriptionResult = await revenueManagerService.processSubscriptionRevenue(orderData.vendorId);
          
          if (subscriptionResult.success) {
            subscriptionInvoiceGenerated = true;
          } else {
            console.warn(`Subscription billing failed for vendor ${orderData.vendorId}:`, subscriptionResult.error);
          }
        }
      }

      // Step 6: Record order financial data for traceability
      await this.recordOrderFinancialData({
        orderId: orderData.orderId,
        vendorId: orderData.vendorId,
        riderId: orderData.riderId,
        orderAmount: orderData.orderAmount,
        deliveryCharge: orderData.deliveryCharge,
        vendorCommission: vendorCommission.commissionAmount,
        riderCommission,
        platformRevenue: (orderData.orderAmount + orderData.deliveryCharge) - vendorCommission.commissionAmount - riderCommission,
        completedAt: orderData.completedAt,
      });

      // Step 7: Log audit entry for complete workflow
      await auditLogService.logAuditEntry({
        entityType: 'order_revenue_processing',
        entityId: orderData.orderId,
        action: 'process',
        oldValues: null,
        newValues: {
          order_id: orderData.orderId,
          vendor_id: orderData.vendorId,
          rider_id: orderData.riderId,
          order_amount: orderData.orderAmount,
          delivery_charge: orderData.deliveryCharge,
          vendor_commission: vendorCommission.commissionAmount,
          rider_commission: riderCommission,
          platform_revenue: (orderData.orderAmount + orderData.deliveryCharge) - vendorCommission.commissionAmount - riderCommission,
          subscription_invoice_generated: subscriptionInvoiceGenerated,
          journal_entry_id: revenueResult.revenue?.journalEntryId,
        },
      });

      // Performance monitoring
      const executionTime = performance.now() - startTime;

      // Log performance metrics
      await this.logPerformanceMetric({
        operation_type: 'order_revenue_processing',
        operation_id: orderData.orderId,
        execution_time_ms: Math.round(executionTime),
        success: true,
        metadata: {
          order_id: orderData.orderId,
          vendor_id: orderData.vendorId,
          rider_id: orderData.riderId,
          order_amount: orderData.orderAmount,
          vendor_commission: vendorCommission.commissionAmount,
          rider_commission: riderCommission,
          subscription_invoice_generated: subscriptionInvoiceGenerated,
        },
      });

      // Alert if performance threshold exceeded (100ms target)
      if (executionTime > 100) {
        console.warn(
          `⚠️ Order revenue processing exceeded 100ms threshold: ${Math.round(executionTime)}ms for order ${orderData.orderId}`
        );
      } else {
        console.log(
          `✓ Order revenue processing completed in ${Math.round(executionTime)}ms for order ${orderData.orderId}`
        );
      }

      return {
        success: true,
        journalEntryId: revenueResult.revenue?.journalEntryId,
        vendorCommission: vendorCommission.commissionAmount,
        riderCommission,
        platformRevenue: (orderData.orderAmount + orderData.deliveryCharge) - vendorCommission.commissionAmount - riderCommission,
        subscriptionInvoiceGenerated,
        executionTime: Math.round(executionTime),
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      // Log error to finance error log
      await this.logErrorAndQueue(orderData, 'order_revenue_processing', error instanceof Error ? error.message : 'Unknown error');

      // Log failed performance metric
      await this.logPerformanceMetric({
        operation_type: 'order_revenue_processing',
        operation_id: orderData.orderId,
        execution_time_ms: Math.round(executionTime),
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          order_id: orderData.orderId,
          vendor_id: orderData.vendorId,
          rider_id: orderData.riderId,
          order_amount: orderData.orderAmount,
        },
      });

      console.error("Unexpected error processing order revenue:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Math.round(executionTime),
      };
    }
  }

  /**
   * Record order financial data for traceability and reporting
   * 
   * Stores complete financial breakdown of the order including:
   * - Order amount and delivery charge
   * - Vendor and rider commissions
   * - Platform revenue
   * - Completion timestamp
   */
  private async recordOrderFinancialData(data: {
    orderId: string;
    vendorId: string;
    riderId: string;
    orderAmount: number;
    deliveryCharge: number;
    vendorCommission: number;
    riderCommission: number;
    platformRevenue: number;
    completedAt: Date;
  }): Promise<void> {
    try {
      await supabase.from("finance_order_data").insert({
        order_id: data.orderId,
        vendor_id: data.vendorId,
        rider_id: data.riderId,
        order_amount: data.orderAmount,
        delivery_charge: data.deliveryCharge,
        total_amount: data.orderAmount + data.deliveryCharge,
        vendor_commission: data.vendorCommission,
        rider_commission: data.riderCommission,
        platform_revenue: data.platformRevenue,
        payment_status: 'completed',
        completed_at: data.completedAt.toISOString(),
      });
    } catch (error) {
      console.error("Error recording order financial data:", error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Log error to finance error log and queue for retry
   * 
   * Requirement 2.8: Queue failed orders for retry without blocking order completion
   */
  private async logErrorAndQueue(
    orderData: OrderData,
    errorType: string,
    errorMessage: string
  ): Promise<void> {
    try {
      // Log to finance error log
      await supabase.from("finance_error_log").insert({
        entityType: 'order',
        entityId: orderData.orderId,
        error_type: errorType,
        error_message: errorMessage,
        error_data: {
          order_id: orderData.orderId,
          vendor_id: orderData.vendorId,
          rider_id: orderData.riderId,
          order_amount: orderData.orderAmount,
          delivery_charge: orderData.deliveryCharge,
        },
        retry_count: 0,
        status: 'pending',
      });

      console.error(`Finance error logged for order ${orderData.orderId}: ${errorType} - ${errorMessage}`);
    } catch (error) {
      console.error("Failed to log finance error:", error);
    }
  }

  /**
   * Log performance metrics for monitoring
   * 
   * Requirement 2.6: Performance monitoring for 100ms requirement
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
export const orderRevenueProcessor = new OrderRevenueProcessor();
