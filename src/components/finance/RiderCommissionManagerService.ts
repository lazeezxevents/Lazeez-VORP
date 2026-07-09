import { supabase } from "@/integrations/supabase/client";
import { generalLedgerService } from "./GeneralLedgerService";
import { auditLogService } from "./AuditLogService";
import type { CreateJournalEntryInput } from "./types";

/**
 * Rider Commission Manager Service Class
 * 
 * Provides rider commission calculation functionality including:
 * - Calculating rider commissions based on distance tiers
 * - Applying distance-based tier rates
 * - Recording delivery receipts with full details
 * - Tracking rider earnings and payouts
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8
 */

// =====================================================
// Types and Interfaces
// =====================================================

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface RouteData {
  distance: number;
  duration?: number;
  waypoints?: Location[];
  optimized: boolean;
}

export interface DeliveryData {
  orderId: string;
  deliveryId: string;
  riderId: string;
  vendorId: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  distance: number;
  optimizedRoute: RouteData;
  deliveryCharge: number;
  completedAt: Date;
}

export interface RiderCommission {
  orderId: string;
  riderId: string;
  distance: number;
  deliveryCharge: number;
  commissionRate: number;
  commissionAmount: number;
  tierApplied: string;
  calculatedAt: Date;
}

export interface DeliveryReceipt {
  deliveryId: string;
  orderId: string;
  riderId: string;
  vendorId: string;
  pickupLocation: any;
  deliveryLocation: any;
  distance: number;
  optimizedRoute: any;
  deliveryCharge: number;
  completedAt: Date;
}

export interface RiderEarnings {
  riderId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalDeliveries: number;
  totalDistance: number;
  totalCommission: number;
  averageCommissionPerDelivery: number;
  deliveries: Array<{
    orderId: string;
    date: Date;
    distance: number;
    commission: number;
    tierApplied: string;
  }>;
}

export interface CommissionResult {
  success: boolean;
  commission?: RiderCommission;
  error?: string;
}

export interface TierRate {
  minDistance: number;
  maxDistance: number;
  rate: number;
  tierName: string;
}

export interface TierResult {
  success: boolean;
  tier?: TierRate;
  error?: string;
}

// =====================================================
// Distance Tier Configuration
// =====================================================

/**
 * Distance-based commission tiers
 * Requirements 4.1, 4.2: Distance-based tier rates
 * 
 * 0-5 km: 15% commission rate
 * 5-10 km: 20% commission rate
 * 10-15 km: 25% commission rate
 * 15+ km: 30% commission rate
 */
const DISTANCE_TIERS: TierRate[] = [
  { minDistance: 0, maxDistance: 5, rate: 15.0, tierName: '0-5km' },
  { minDistance: 5, maxDistance: 10, rate: 20.0, tierName: '5-10km' },
  { minDistance: 10, maxDistance: 15, rate: 25.0, tierName: '10-15km' },
  { minDistance: 15, maxDistance: Infinity, rate: 30.0, tierName: '15+km' },
];

// =====================================================
// Rider Commission Manager Service
// =====================================================

export class RiderCommissionManagerService {
  /**
   * Calculate rider commission based on delivery details
   * 
   * Requirement 4.1: Calculate rider commission based on delivery distance using configured tier rates
   * Requirement 4.2: Apply corresponding commission rate when delivery distance falls within tier range
   * Requirement 4.3: Ensure rider commission does not exceed delivery charge amount
   * Requirement 4.4: Record the optimized route distance used
   */
  async calculateRiderCommission(delivery: DeliveryData): Promise<CommissionResult> {
    try {
      // Validate delivery data
      if (!delivery || !delivery.orderId || !delivery.riderId || delivery.distance <= 0) {
        return {
          success: false,
          error: "Invalid delivery data: order ID, rider ID, and positive distance required",
        };
      }

      if (delivery.deliveryCharge < 0) {
        return {
          success: false,
          error: "Delivery charge cannot be negative",
        };
      }

      // Requirement 4.2: Find applicable tier based on delivery distance
      const tierResult = await this.applyDistanceTier(delivery.distance);
      
      if (!tierResult.success || !tierResult.tier) {
        return {
          success: false,
          error: tierResult.error || "Failed to determine distance tier",
        };
      }

      const tier = tierResult.tier;
      
      // Calculate commission amount
      let commissionAmount = (delivery.deliveryCharge * tier.rate) / 100;

      // Requirement 4.3: Ensure rider commission does not exceed delivery charge amount
      if (commissionAmount > delivery.deliveryCharge) {
        commissionAmount = delivery.deliveryCharge;
      }

      // Ensure commission is non-negative
      if (commissionAmount < 0) {
        commissionAmount = 0;
      }

      const commission: RiderCommission = {
        orderId: delivery.orderId,
        riderId: delivery.riderId,
        distance: delivery.distance,
        deliveryCharge: delivery.deliveryCharge,
        commissionRate: tier.rate,
        commissionAmount,
        tierApplied: tier.tierName,
        calculatedAt: new Date(),
      };

      // Requirement 4.8: Record rider commission as liability in Accounts Payable
      await this.recordCommissionLiability(delivery, commissionAmount, tier.tierName);

      return { success: true, commission };
    } catch (error) {
      console.error("Unexpected error calculating rider commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Apply distance tier based on delivery distance
   * 
   * Requirement 4.1: Calculate rider commission based on delivery distance using configured tier rates
   * Requirement 4.2: Apply corresponding commission rate when delivery distance falls within tier range
   */
  async applyDistanceTier(distance: number): Promise<TierResult> {
    try {
      // Validate distance
      if (distance < 0) {
        return {
          success: false,
          error: "Distance cannot be negative",
        };
      }

      // Find applicable tier based on distance
      let applicableTier: TierRate | null = null;

      for (const tier of DISTANCE_TIERS) {
        if (distance >= tier.minDistance && distance < tier.maxDistance) {
          applicableTier = tier;
          break;
        }
      }

      // If no exact match, use the highest tier (15+ km)
      if (!applicableTier && distance >= 15) {
        applicableTier = DISTANCE_TIERS[DISTANCE_TIERS.length - 1];
      }

      if (!applicableTier) {
        return {
          success: false,
          error: `No applicable tier found for distance: ${distance} km`,
        };
      }

      return {
        success: true,
        tier: applicableTier,
      };
    } catch (error) {
      console.error("Error applying distance tier:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Record delivery receipt with full details
   * 
   * Requirement 4.5: Store delivery receipt details including distance, route, and commission breakdown
   * Requirement 4.6: Link rider commission to the delivery transaction for audit purposes
   */
  async recordDeliveryReceipt(receipt: DeliveryReceipt): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate receipt data
      if (!receipt.deliveryId || !receipt.orderId || !receipt.riderId) {
        return {
          success: false,
          error: "Invalid receipt data: delivery ID, order ID, and rider ID required",
        };
      }

      // Calculate commission for this delivery
      const tierResult = await this.applyDistanceTier(receipt.distance);
      
      if (!tierResult.success || !tierResult.tier) {
        return {
          success: false,
          error: tierResult.error || "Failed to determine distance tier",
        };
      }

      const tier = tierResult.tier;
      let commissionAmount = (receipt.deliveryCharge * tier.rate) / 100;

      // Ensure commission doesn't exceed delivery charge
      if (commissionAmount > receipt.deliveryCharge) {
        commissionAmount = receipt.deliveryCharge;
      }

      // Insert delivery receipt into finance_delivery_data table
      const { data, error } = await supabase
        .from("finance_delivery_data")
        .insert({
          delivery_id: receipt.deliveryId,
          order_id: receipt.orderId,
          rider_id: receipt.riderId,
          vendor_id: receipt.vendorId,
          pickup_location: receipt.pickupLocation,
          delivery_location: receipt.deliveryLocation,
          distance: receipt.distance,
          optimized_route: receipt.optimizedRoute,
          delivery_charge: receipt.deliveryCharge,
          rider_commission_rate: tier.rate,
          rider_commission_amount: commissionAmount,
          tier_applied: tier.tierName,
          completed_at: receipt.completedAt,
        })
        .select()
        .single();

      if (error) {
        console.error("Error recording delivery receipt:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      // Log audit entry
      await auditLogService.logAuditEntry({
        entityType: 'delivery_receipt',
        entityId: data.id,
        action: 'create',
        oldValues: null,
        newValues: {
          delivery_id: receipt.deliveryId,
          order_id: receipt.orderId,
          rider_id: receipt.riderId,
          distance: receipt.distance,
          commission_amount: commissionAmount,
          tier_applied: tier.tierName,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Unexpected error recording delivery receipt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get rider earnings for a specific period
   * 
   * Retrieves all deliveries and commissions for a rider within the specified date range
   */
  async getRiderEarnings(
    riderId: string,
    period: { startDate: Date; endDate: Date }
  ): Promise<RiderEarnings | null> {
    try {
      const startDateStr = period.startDate.toISOString();
      const endDateStr = period.endDate.toISOString();

      // Fetch delivery data for the rider within the period
      const { data: deliveries, error } = await supabase
        .from("finance_delivery_data")
        .select("*")
        .eq("rider_id", riderId)
        .gte("completed_at", startDateStr)
        .lte("completed_at", endDateStr)
        .order("completed_at", { ascending: false });

      if (error) {
        console.error("Error fetching rider earnings:", error);
        return null;
      }

      if (!deliveries || deliveries.length === 0) {
        return {
          riderId,
          period,
          totalDeliveries: 0,
          totalDistance: 0,
          totalCommission: 0,
          averageCommissionPerDelivery: 0,
          deliveries: [],
        };
      }

      // Calculate totals
      const totalDeliveries = deliveries.length;
      const totalDistance = deliveries.reduce((sum, d) => sum + Number(d.distance), 0);
      const totalCommission = deliveries.reduce((sum, d) => sum + Number(d.rider_commission_amount), 0);
      const averageCommissionPerDelivery = totalCommission / totalDeliveries;

      // Map deliveries
      const deliveryList = deliveries.map(d => ({
        orderId: d.order_id,
        date: new Date(d.completed_at),
        distance: Number(d.distance),
        commission: Number(d.rider_commission_amount),
        tierApplied: d.tier_applied,
      }));

      return {
        riderId,
        period,
        totalDeliveries,
        totalDistance,
        totalCommission,
        averageCommissionPerDelivery,
        deliveries: deliveryList,
      };
    } catch (error) {
      console.error("Unexpected error getting rider earnings:", error);
      return null;
    }
  }

  /**
   * Record rider commission as liability in Accounts Payable
   * 
   * Requirement 4.8: Record rider commission as liability in Accounts Payable
   * Creates journal entry debiting Commission Expense and crediting Accounts Payable - Riders
   */
  private async recordCommissionLiability(
    delivery: DeliveryData,
    commissionAmount: number,
    tierApplied: string
  ): Promise<void> {
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
        description: `Rider commission for delivery ${delivery.deliveryId}`,
        reference: `RIDER-COMM-${delivery.orderId}`,
        ledger_entries: [
          {
            account_id: commissionExpenseAccount.id,
            debit: commissionAmount,
            credit: 0,
            currency: 'PKR',
            description: `Rider commission for ${delivery.riderId} - ${tierApplied}`,
          },
          {
            account_id: accountsPayableAccount.id,
            debit: 0,
            credit: commissionAmount,
            currency: 'PKR',
            description: `Commission liability to rider ${delivery.riderId}`,
          },
        ],
      };

      // Create and post journal entry
      const journalResult = await generalLedgerService.createJournalEntry(journalEntryInput);

      if (journalResult.success && journalResult.journal_entry) {
        await generalLedgerService.postTransaction(journalResult.journal_entry.id, user.id);

        // Log audit entry
        await auditLogService.logAuditEntry({
          entityType: 'rider_commission',
          entityId: delivery.orderId,
          action: 'record_liability',
          oldValues: null,
          newValues: {
            order_id: delivery.orderId,
            delivery_id: delivery.deliveryId,
            rider_id: delivery.riderId,
            commission_amount: commissionAmount,
            tier_applied: tierApplied,
            journal_entry_id: journalResult.journal_entry.id,
          },
        });
      }
    } catch (error) {
      console.error("Error recording rider commission liability:", error);
      // Don't throw - commission calculation should succeed even if liability recording fails
    }
  }
}

// Export singleton instance
export const riderCommissionManagerService = new RiderCommissionManagerService();
