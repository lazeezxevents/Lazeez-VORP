import { supabase } from "@/integrations/supabase/client";

export interface VendorPerformanceMetrics {
  vendor_id: string;
  vendor_name: string;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  current_commission_rate: number;
  current_commission_amount: number;
  profit_margin: number;
  order_frequency: number; // orders per month
  customer_satisfaction?: number;
  retention_rate?: number;
}

export interface OptimizationRecommendation {
  vendor_id: string;
  vendor_name: string;
  current_rate: number;
  recommended_rate: number;
  rate_change_percent: number;
  reasoning: string[];
  confidence_score: number;
  projected_impact: ProjectedImpact;
  risk_level: "low" | "medium" | "high";
}

export interface ProjectedImpact {
  revenue_change: number;
  revenue_change_percent: number;
  profit_change: number;
  profit_change_percent: number;
  volume_change: number;
  volume_change_percent: number;
  net_benefit: number;
}

export interface OptimizationResult {
  analysis_date: string;
  total_vendors_analyzed: number;
  recommendations: OptimizationRecommendation[];
  aggregate_impact: {
    total_revenue_impact: number;
    total_profit_impact: number;
    total_volume_impact: number;
  };
}

export class OptimizationEngine {
  // Optimization parameters
  private static readonly MIN_COMMISSION_RATE = 0.05; // 5%
  private static readonly MAX_COMMISSION_RATE = 0.30; // 30%
  private static readonly TARGET_PROFIT_MARGIN = 0.25; // 25%
  private static readonly PRICE_ELASTICITY = -0.5; // Volume sensitivity to rate changes

  /**
   * Optimize commission rates for all vendors
   */
  static async optimizeCommissionRates(
    startDate?: string,
    endDate?: string
  ): Promise<OptimizationResult> {
    // Validate inputs
    if (startDate && endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        throw new Error("Dates must be in YYYY-MM-DD format");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Invalid date values");
      }

      if (start > end) {
        throw new Error("Start date must be before or equal to end date");
      }
    }

    // Default to last 90 days if not specified
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 90);

    const analysisStart = startDate || defaultStartDate.toISOString().split("T")[0];
    const analysisEnd = endDate || defaultEndDate.toISOString().split("T")[0];

    // Get vendor performance metrics
    const vendorMetrics = await this.analyzeVendorProfitability(analysisStart, analysisEnd);

    // Generate recommendations for each vendor
    const recommendations: OptimizationRecommendation[] = [];

    for (const metrics of vendorMetrics) {
      const recommendation = await this.calculateOptimalRate(metrics);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Calculate aggregate impact
    const aggregate_impact = {
      total_revenue_impact: recommendations.reduce((sum, r) => sum + r.projected_impact.revenue_change, 0),
      total_profit_impact: recommendations.reduce((sum, r) => sum + r.projected_impact.profit_change, 0),
      total_volume_impact: recommendations.reduce((sum, r) => sum + r.projected_impact.volume_change, 0),
    };

    return {
      analysis_date: new Date().toISOString().split("T")[0],
      total_vendors_analyzed: vendorMetrics.length,
      recommendations: recommendations.sort((a, b) => b.projected_impact.net_benefit - a.projected_impact.net_benefit),
      aggregate_impact,
    };
  }

  /**
   * Analyze vendor profitability and performance
   */
  static async analyzeVendorProfitability(
    startDate: string,
    endDate: string
  ): Promise<VendorPerformanceMetrics[]> {
    // Validate inputs
    if (!startDate || !endDate) {
      throw new Error("Start date and end date are required");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Dates must be in YYYY-MM-DD format");
    }

    // Get vendor order data
    const { data: orderData, error } = await supabase
      .from("finance_order_data")
      .select(
        `
        vendor_id,
        order_amount,
        commission_amount,
        commission_rate,
        created_at,
        vendors!inner(name)
      `
      )
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) {
      throw new Error(`Failed to fetch vendor order data: ${error.message}`);
    }

    if (!orderData || orderData.length === 0) {
      return [];
    }

    // Group by vendor and calculate metrics
    const vendorMap = new Map<string, VendorPerformanceMetrics>();

    orderData.forEach((order: any) => {
      const vendorId = order.vendor_id;

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendor_id: vendorId,
          vendor_name: order.vendors.name,
          total_orders: 0,
          total_revenue: 0,
          avg_order_value: 0,
          current_commission_rate: order.commission_rate || 0,
          current_commission_amount: 0,
          profit_margin: 0,
          order_frequency: 0,
        });
      }

      const metrics = vendorMap.get(vendorId)!;
      metrics.total_orders++;
      metrics.total_revenue += order.order_amount;
      metrics.current_commission_amount += order.commission_amount;
    });

    // Calculate derived metrics
    const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    const months = daysDiff / 30;

    vendorMap.forEach((metrics) => {
      metrics.avg_order_value = metrics.total_revenue / metrics.total_orders;
      metrics.profit_margin =
        metrics.total_revenue > 0
          ? (metrics.total_revenue - metrics.current_commission_amount) / metrics.total_revenue
          : 0;
      metrics.order_frequency = metrics.total_orders / months;
    });

    return Array.from(vendorMap.values());
  }

  /**
   * Calculate optimal commission rate for a vendor
   */
  private static async calculateOptimalRate(
    metrics: VendorPerformanceMetrics
  ): Promise<OptimizationRecommendation | null> {
    // Skip vendors with insufficient data
    if (metrics.total_orders < 10) {
      return null;
    }

    const currentRate = metrics.current_commission_rate;
    let optimalRate = currentRate;
    const reasoning: string[] = [];
    let confidence = 0.7; // Base confidence

    // Factor 1: Profit margin analysis
    if (metrics.profit_margin < this.TARGET_PROFIT_MARGIN) {
      // Profit margin too low - increase commission rate
      const targetIncrease = (this.TARGET_PROFIT_MARGIN - metrics.profit_margin) * 0.5;
      optimalRate = Math.min(currentRate + targetIncrease, this.MAX_COMMISSION_RATE);
      reasoning.push(
        `Profit margin (${(metrics.profit_margin * 100).toFixed(1)}%) below target (${(this.TARGET_PROFIT_MARGIN * 100).toFixed(1)}%)`
      );
      confidence += 0.1;
    } else if (metrics.profit_margin > this.TARGET_PROFIT_MARGIN + 0.1) {
      // Profit margin high - can reduce commission to incentivize volume
      const potentialDecrease = (metrics.profit_margin - this.TARGET_PROFIT_MARGIN) * 0.3;
      optimalRate = Math.max(currentRate - potentialDecrease, this.MIN_COMMISSION_RATE);
      reasoning.push(
        `High profit margin (${(metrics.profit_margin * 100).toFixed(1)}%) allows rate reduction to boost volume`
      );
      confidence += 0.05;
    }

    // Factor 2: Order frequency
    if (metrics.order_frequency < 5) {
      // Low frequency - reduce rate to incentivize more orders
      optimalRate = Math.max(optimalRate - 0.02, this.MIN_COMMISSION_RATE);
      reasoning.push(`Low order frequency (${metrics.order_frequency.toFixed(1)}/month) - reduce rate to incentivize`);
      confidence += 0.05;
    } else if (metrics.order_frequency > 20) {
      // High frequency - can increase rate
      optimalRate = Math.min(optimalRate + 0.01, this.MAX_COMMISSION_RATE);
      reasoning.push(`High order frequency (${metrics.order_frequency.toFixed(1)}/month) supports rate increase`);
      confidence += 0.05;
    }

    // Factor 3: Average order value
    if (metrics.avg_order_value > 5000) {
      // High AOV - can afford slightly higher commission
      optimalRate = Math.min(optimalRate + 0.01, this.MAX_COMMISSION_RATE);
      reasoning.push(`High average order value (PKR ${metrics.avg_order_value.toFixed(0)}) supports rate increase`);
      confidence += 0.05;
    }

    // Round to 2 decimal places
    optimalRate = Math.round(optimalRate * 100) / 100;

    // Skip if no meaningful change
    const rateChange = Math.abs(optimalRate - currentRate);
    if (rateChange < 0.005) {
      // Less than 0.5% change
      return null;
    }

    // Project impact
    const projectedImpact = this.projectImpact(metrics, currentRate, optimalRate);

    // Determine risk level
    const riskLevel = this.assessRisk(metrics, currentRate, optimalRate);

    // Add impact reasoning
    if (projectedImpact.net_benefit > 0) {
      reasoning.push(
        `Projected net benefit: PKR ${projectedImpact.net_benefit.toFixed(0)} (${projectedImpact.profit_change_percent.toFixed(1)}% profit increase)`
      );
    }

    return {
      vendor_id: metrics.vendor_id,
      vendor_name: metrics.vendor_name,
      current_rate: currentRate,
      recommended_rate: optimalRate,
      rate_change_percent: ((optimalRate - currentRate) / currentRate) * 100,
      reasoning,
      confidence_score: Math.min(confidence, 1.0),
      projected_impact: projectedImpact,
      risk_level: riskLevel,
    };
  }

  /**
   * Project impact of commission rate change
   */
  static projectImpact(
    metrics: VendorPerformanceMetrics,
    currentRate: number,
    newRate: number
  ): ProjectedImpact {
    // Validate inputs
    if (currentRate < 0 || currentRate > 1) {
      throw new Error("Current rate must be between 0 and 1");
    }
    if (newRate < 0 || newRate > 1) {
      throw new Error("New rate must be between 0 and 1");
    }

    const rateChange = newRate - currentRate;
    const rateChangePercent = (rateChange / currentRate) * 100;

    // Project volume change using price elasticity
    // Negative elasticity: rate increase -> volume decrease
    const volumeChangePercent = this.PRICE_ELASTICITY * rateChangePercent;
    const volume_change = (metrics.total_orders * volumeChangePercent) / 100;

    // Project revenue change
    const newVolume = metrics.total_orders + volume_change;
    const newRevenue = newVolume * metrics.avg_order_value;
    const revenue_change = newRevenue - metrics.total_revenue;
    const revenue_change_percent = (revenue_change / metrics.total_revenue) * 100;

    // Project profit change
    const currentProfit = metrics.total_revenue - metrics.current_commission_amount;
    const newCommission = newRevenue * newRate;
    const newProfit = newRevenue - newCommission;
    const profit_change = newProfit - currentProfit;
    const profit_change_percent = currentProfit > 0 ? (profit_change / currentProfit) * 100 : 0;

    // Net benefit (profit change is the key metric)
    const net_benefit = profit_change;

    return {
      revenue_change,
      revenue_change_percent,
      profit_change,
      profit_change_percent,
      volume_change,
      volume_change_percent,
      net_benefit,
    };
  }

  /**
   * Assess risk level of rate change
   */
  private static assessRisk(
    metrics: VendorPerformanceMetrics,
    currentRate: number,
    newRate: number
  ): "low" | "medium" | "high" {
    const rateChange = Math.abs(newRate - currentRate);
    const rateChangePercent = (rateChange / currentRate) * 100;

    // High risk if large rate increase on high-volume vendor
    if (rateChangePercent > 20 && metrics.order_frequency > 15) {
      return "high";
    }

    // Medium risk if moderate change or high-volume vendor
    if (rateChangePercent > 10 || metrics.order_frequency > 20) {
      return "medium";
    }

    return "low";
  }

  /**
   * Track optimization results after implementation
   */
  static async trackOptimizationResults(
    vendorId: string,
    oldRate: number,
    newRate: number,
    implementationDate: string
  ): Promise<{
    actual_impact: ProjectedImpact;
    prediction_accuracy: number;
  }> {
    // Validate inputs
    if (!vendorId || vendorId.trim().length === 0) {
      throw new Error("Vendor ID is required");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(vendorId)) {
      throw new Error("Invalid vendor ID format");
    }

    if (oldRate < 0 || oldRate > 1 || newRate < 0 || newRate > 1) {
      throw new Error("Rates must be between 0 and 1");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(implementationDate)) {
      throw new Error("Implementation date must be in YYYY-MM-DD format");
    }

    // Get metrics before implementation (90 days before)
    const beforeStart = new Date(implementationDate);
    beforeStart.setDate(beforeStart.getDate() - 90);
    const beforeEnd = new Date(implementationDate);
    beforeEnd.setDate(beforeEnd.getDate() - 1);

    const beforeMetrics = await this.analyzeVendorProfitability(
      beforeStart.toISOString().split("T")[0],
      beforeEnd.toISOString().split("T")[0]
    );

    const beforeVendor = beforeMetrics.find((m) => m.vendor_id === vendorId);
    if (!beforeVendor) {
      throw new Error("Vendor not found in before period");
    }

    // Get metrics after implementation (90 days after)
    const afterStart = new Date(implementationDate);
    const afterEnd = new Date(implementationDate);
    afterEnd.setDate(afterEnd.getDate() + 90);

    const afterMetrics = await this.analyzeVendorProfitability(
      afterStart.toISOString().split("T")[0],
      afterEnd.toISOString().split("T")[0]
    );

    const afterVendor = afterMetrics.find((m) => m.vendor_id === vendorId);
    if (!afterVendor) {
      throw new Error("Vendor not found in after period");
    }

    // Calculate actual impact
    const actual_impact: ProjectedImpact = {
      revenue_change: afterVendor.total_revenue - beforeVendor.total_revenue,
      revenue_change_percent:
        beforeVendor.total_revenue > 0
          ? ((afterVendor.total_revenue - beforeVendor.total_revenue) / beforeVendor.total_revenue) * 100
          : 0,
      profit_change:
        afterVendor.total_revenue -
        afterVendor.current_commission_amount -
        (beforeVendor.total_revenue - beforeVendor.current_commission_amount),
      profit_change_percent: 0, // Calculated below
      volume_change: afterVendor.total_orders - beforeVendor.total_orders,
      volume_change_percent:
        beforeVendor.total_orders > 0
          ? ((afterVendor.total_orders - beforeVendor.total_orders) / beforeVendor.total_orders) * 100
          : 0,
      net_benefit: 0, // Calculated below
    };

    const beforeProfit = beforeVendor.total_revenue - beforeVendor.current_commission_amount;
    actual_impact.profit_change_percent = beforeProfit > 0 ? (actual_impact.profit_change / beforeProfit) * 100 : 0;
    actual_impact.net_benefit = actual_impact.profit_change;

    // Calculate predicted impact
    const predicted_impact = this.projectImpact(beforeVendor, oldRate, newRate);

    // Calculate prediction accuracy (inverse of error)
    const profitError = Math.abs(actual_impact.profit_change - predicted_impact.profit_change);
    const profitErrorPercent = beforeProfit > 0 ? (profitError / Math.abs(beforeProfit)) * 100 : 100;
    const prediction_accuracy = Math.max(0, 100 - profitErrorPercent);

    return {
      actual_impact,
      prediction_accuracy,
    };
  }
}
