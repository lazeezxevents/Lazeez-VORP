import { supabase } from '@/integrations/supabase/client';

interface TimeSeriesData {
  date: Date;
  value: number;
}

interface ForecastResult {
  predictions: Record<string, number>;
  confidenceIntervals: Record<string, { lower: number; upper: number }>;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  growthRate: number;
  seasonalityDetected: boolean;
  seasonalityPattern?: any;
  recommendations: string[];
}

export class ForecastingEngine {
  /**
   * Forecast revenue using specified method
   */
  static async forecastRevenue(
    months: number = 6,
    method: 'linear' | 'seasonal' | 'ml' = 'seasonal'
  ): Promise<string> {
    // Validate inputs
    if (months < 1 || months > 24) {
      throw new Error('Forecast months must be between 1 and 24');
    }
    const validMethods = ['linear', 'seasonal', 'ml'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid forecast method: ${method}`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get historical revenue data
    const historicalData = await this.getHistoricalRevenue();

    // Generate forecast based on method
    let forecast: ForecastResult;
    if (method === 'seasonal') {
      forecast = this.seasonalForecast(historicalData, months);
    } else {
      forecast = this.linearForecast(historicalData, months);
    }

    // Store forecast in database
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const { data, error } = await supabase
      .from('finance_forecasts')
      .insert({
        type: 'revenue',
        method,
        baseline_data: historicalData,
        predictions: forecast.predictions,
        confidence_intervals: forecast.confidenceIntervals,
        trend_direction: forecast.trendDirection,
        growth_rate: forecast.growthRate,
        seasonality_detected: forecast.seasonalityDetected,
        seasonality_pattern: forecast.seasonalityPattern,
        recommendations: forecast.recommendations,
        created_by: user.id,
        forecast_period_start: startDate.toISOString().split('T')[0],
        forecast_period_end: endDate.toISOString().split('T')[0]
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id;
  }

  /**
   * Get historical revenue data
   */
  private static async getHistoricalRevenue(): Promise<TimeSeriesData[]> {
    // Get revenue from journal entries for the past 12 months
    const { data, error } = await supabase
      .from('finance_journal_entries')
      .select(`
        entry_date,
        finance_ledger_entries!inner(
          credit,
          finance_accounts!inner(type)
        )
      `)
      .gte('entry_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .eq('finance_ledger_entries.finance_accounts.type', 'revenue')
      .order('entry_date');

    if (error) throw error;

    // Aggregate by month
    const monthlyRevenue = new Map<string, number>();
    
    data?.forEach((entry: any) => {
      const month = entry.entry_date.substring(0, 7); // YYYY-MM
      const revenue = entry.finance_ledger_entries.reduce(
        (sum: number, le: any) => sum + (le.credit || 0),
        0
      );
      monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + revenue);
    });

    return Array.from(monthlyRevenue.entries()).map(([month, value]) => ({
      date: new Date(month + '-01'),
      value
    }));
  }

  /**
   * Linear trend forecasting
   */
  private static linearForecast(
    data: TimeSeriesData[],
    months: number
  ): ForecastResult {
    if (data.length < 2) {
      throw new Error('Insufficient data for forecasting');
    }

    // Calculate linear regression
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard error for confidence intervals
    const predictions: Record<string, number> = {};
    const confidenceIntervals: Record<string, { lower: number; upper: number }> = {};

    const lastDate = data[data.length - 1].date;
    
    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      const dateKey = futureDate.toISOString().split('T')[0];
      
      const predicted = slope * (n + i - 1) + intercept;
      predictions[dateKey] = Math.max(0, predicted);

      // Simple confidence interval (±20%)
      confidenceIntervals[dateKey] = {
        lower: Math.max(0, predicted * 0.8),
        upper: predicted * 1.2
      };
    }

    // Determine trend direction
    const trendDirection = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';
    const growthRate = data.length > 1 
      ? ((data[data.length - 1].value - data[0].value) / data[0].value) / data.length
      : 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(trendDirection, growthRate, false);

    return {
      predictions,
      confidenceIntervals,
      trendDirection,
      growthRate,
      seasonalityDetected: false,
      recommendations
    };
  }

  /**
   * Seasonal forecasting with trend
   */
  private static seasonalForecast(
    data: TimeSeriesData[],
    months: number
  ): ForecastResult {
    if (data.length < 12) {
      // Fall back to linear if insufficient data for seasonality
      return this.linearForecast(data, months);
    }

    // Detect seasonality
    const seasonality = this.detectSeasonality(data);

    // Calculate trend
    const trend = this.calculateTrend(data);

    // Generate predictions
    const predictions: Record<string, number> = {};
    const confidenceIntervals: Record<string, { lower: number; upper: number }> = {};

    const lastDate = data[data.length - 1].date;
    const lastValue = data[data.length - 1].value;

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      const dateKey = futureDate.toISOString().split('T')[0];
      
      const month = futureDate.getMonth();
      const seasonalFactor = seasonality.factors[month] || 1;
      const trendValue = lastValue + trend.slope * i;
      const predicted = trendValue * seasonalFactor;

      predictions[dateKey] = Math.max(0, predicted);

      // Confidence interval based on historical variance
      const variance = seasonality.variance || 0.15;
      confidenceIntervals[dateKey] = {
        lower: Math.max(0, predicted * (1 - variance)),
        upper: predicted * (1 + variance)
      };
    }

    const trendDirection = trend.slope > 0.01 ? 'increasing' : trend.slope < -0.01 ? 'decreasing' : 'stable';
    const growthRate = trend.slope / (data[0]?.value || 1);

    const recommendations = this.generateRecommendations(
      trendDirection,
      growthRate,
      seasonality.detected
    );

    return {
      predictions,
      confidenceIntervals,
      trendDirection,
      growthRate,
      seasonalityDetected: seasonality.detected,
      seasonalityPattern: seasonality.factors,
      recommendations
    };
  }

  /**
   * Detect seasonality in time series data
   */
  static detectSeasonality(data: TimeSeriesData[]): {
    detected: boolean;
    factors: Record<number, number>;
    variance: number;
  } {
    if (data.length < 12) {
      return { detected: false, factors: {}, variance: 0.15 };
    }

    // Calculate average value for each month
    const monthlyAverages = new Map<number, number[]>();
    
    data.forEach(d => {
      const month = d.date.getMonth();
      if (!monthlyAverages.has(month)) {
        monthlyAverages.set(month, []);
      }
      monthlyAverages.get(month)!.push(d.value);
    });

    // Calculate seasonal factors
    const overallAverage = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const factors: Record<number, number> = {};
    
    monthlyAverages.forEach((values, month) => {
      const monthAvg = values.reduce((a, b) => a + b, 0) / values.length;
      factors[month] = monthAvg / overallAverage;
    });

    // Check if seasonality is significant (variance > 10%)
    const factorValues = Object.values(factors);
    const factorVariance = this.calculateVariance(factorValues);
    const detected = factorVariance > 0.01;

    return {
      detected,
      factors,
      variance: Math.sqrt(factorVariance)
    };
  }

  /**
   * Calculate trend from time series data
   */
  private static calculateTrend(data: TimeSeriesData[]): {
    slope: number;
    intercept: number;
  } {
    const n = data.length;
    const x = data.map((_, i) => i);
    const y = data.map(d => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calculate variance
   */
  private static calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Generate recommendations based on forecast
   */
  private static generateRecommendations(
    trend: 'increasing' | 'decreasing' | 'stable',
    growthRate: number,
    hasSeasonality: boolean
  ): string[] {
    const recommendations: string[] = [];

    if (trend === 'increasing') {
      recommendations.push('Revenue is trending upward. Consider scaling operations to meet demand.');
      if (growthRate > 0.1) {
        recommendations.push('Strong growth detected. Evaluate capacity constraints and hiring needs.');
      }
    } else if (trend === 'decreasing') {
      recommendations.push('Revenue is declining. Review pricing strategy and market conditions.');
      recommendations.push('Consider launching promotional campaigns to boost sales.');
    } else {
      recommendations.push('Revenue is stable. Focus on efficiency improvements and cost optimization.');
    }

    if (hasSeasonality) {
      recommendations.push('Seasonal patterns detected. Plan inventory and staffing accordingly.');
      recommendations.push('Consider counter-seasonal marketing initiatives to smooth revenue.');
    }

    return recommendations;
  }

  /**
   * Track forecast accuracy
   */
  static async trackAccuracy(
    forecastId: string,
    periodDate: Date,
    actualValue: number
  ): Promise<void> {
    // Validate inputs
    if (!forecastId || forecastId.trim().length === 0) {
      throw new Error('Forecast ID is required');
    }
    if (!(periodDate instanceof Date) || isNaN(periodDate.getTime())) {
      throw new Error('Invalid period date');
    }
    if (actualValue < 0) {
      throw new Error('Actual value cannot be negative');
    }
    if (actualValue > 1000000000) {
      throw new Error('Actual value too large');
    }

    const { error } = await supabase.rpc('calculate_forecast_accuracy', {
      p_forecast_id: forecastId,
      p_period_date: periodDate.toISOString().split('T')[0],
      p_actual_value: actualValue
    });

    if (error) throw error;
  }

  /**
   * Predict cash flow for future periods
   */
  static async predictCashFlow(
    months: number = 6,
    method: 'linear' | 'seasonal' = 'seasonal'
  ): Promise<string> {
    // Validate inputs
    if (months < 1 || months > 24) {
      throw new Error('Forecast months must be between 1 and 24');
    }
    const validMethods = ['linear', 'seasonal'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid forecast method: ${method}`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get historical cash flow data
    const historicalData = await this.getHistoricalCashFlow();

    // Generate forecast based on method
    let forecast: ForecastResult;
    if (method === 'seasonal' && historicalData.length >= 12) {
      forecast = this.seasonalForecast(historicalData, months);
    } else {
      forecast = this.linearForecast(historicalData, months);
    }

    // Generate cash flow specific recommendations
    const cashFlowRecommendations = this.generateCashFlowRecommendations(
      forecast.trendDirection,
      forecast.predictions,
      historicalData
    );

    // Store forecast in database
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    const { data, error } = await supabase
      .from('finance_forecasts')
      .insert({
        type: 'cash_flow',
        method,
        baseline_data: historicalData,
        predictions: forecast.predictions,
        confidence_intervals: forecast.confidenceIntervals,
        trend_direction: forecast.trendDirection,
        growth_rate: forecast.growthRate,
        seasonality_detected: forecast.seasonalityDetected,
        seasonality_pattern: forecast.seasonalityPattern,
        recommendations: cashFlowRecommendations,
        created_by: user.id,
        forecast_period_start: startDate.toISOString().split('T')[0],
        forecast_period_end: endDate.toISOString().split('T')[0]
      })
      .select('id')
      .single();

    if (error) throw error;

    return data.id;
  }

  /**
   * Get historical cash flow data
   */
  private static async getHistoricalCashFlow(): Promise<TimeSeriesData[]> {
    // Get cash flow entries for the past 12 months
    const { data, error } = await supabase
      .from('finance_cash_flow')
      .select('date, amount, type')
      .gte('date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order('date');

    if (error) throw error;

    // Aggregate by month (net cash flow = inflows - outflows)
    const monthlyCashFlow = new Map<string, number>();
    
    data?.forEach((entry: any) => {
      const month = entry.date.substring(0, 7); // YYYY-MM
      const amount = entry.type === 'inflow' ? entry.amount : -entry.amount;
      monthlyCashFlow.set(month, (monthlyCashFlow.get(month) || 0) + amount);
    });

    return Array.from(monthlyCashFlow.entries()).map(([month, value]) => ({
      date: new Date(month + '-01'),
      value
    }));
  }

  /**
   * Generate cash flow specific recommendations
   */
  private static generateCashFlowRecommendations(
    trend: 'increasing' | 'decreasing' | 'stable',
    predictions: Record<string, number>,
    historicalData: TimeSeriesData[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for negative cash flow predictions
    const negativePredictions = Object.entries(predictions).filter(([_, value]) => value < 0);
    
    if (negativePredictions.length > 0) {
      recommendations.push(
        `WARNING: Negative cash flow predicted for ${negativePredictions.length} month(s). Immediate action required.`
      );
      recommendations.push('Consider securing additional financing or credit line.');
      recommendations.push('Review and reduce discretionary spending.');
      recommendations.push('Accelerate accounts receivable collection.');
    }

    // Check for low cash flow (< 50,000 PKR)
    const lowCashPredictions = Object.entries(predictions).filter(([_, value]) => value > 0 && value < 50000);
    
    if (lowCashPredictions.length > 0) {
      recommendations.push(
        `Low cash position predicted for ${lowCashPredictions.length} month(s). Monitor closely.`
      );
      recommendations.push('Maintain cash reserves for unexpected expenses.');
    }

    // Trend-based recommendations
    if (trend === 'decreasing') {
      recommendations.push('Cash flow is declining. Review expense categories and identify cost savings.');
      recommendations.push('Consider delaying non-essential capital expenditures.');
    } else if (trend === 'increasing') {
      recommendations.push('Cash flow is improving. Consider strategic investments or debt reduction.');
    }

    // Calculate average cash flow
    const avgCashFlow = historicalData.reduce((sum, d) => sum + d.value, 0) / historicalData.length;
    
    if (avgCashFlow < 0) {
      recommendations.push('Historical cash flow is negative. Urgent restructuring needed.');
    }

    return recommendations;
  }

  /**
   * Get cash flow forecast with alerts
   */
  static async getCashFlowForecastWithAlerts(
    forecastId: string
  ): Promise<{
    forecast: any;
    alerts: Array<{
      month: string;
      alert_type: 'negative' | 'low' | 'critical';
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  }> {
    // Validate input
    if (!forecastId || forecastId.trim().length === 0) {
      throw new Error('Forecast ID is required');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(forecastId)) {
      throw new Error('Invalid forecast ID format');
    }

    // Get forecast
    const { data: forecast, error } = await supabase
      .from('finance_forecasts')
      .select('*')
      .eq('id', forecastId)
      .eq('type', 'cash_flow')
      .single();

    if (error) {
      throw new Error(`Failed to fetch forecast: ${error.message}`);
    }

    if (!forecast) {
      throw new Error('Forecast not found');
    }

    // Generate alerts based on predictions
    const alerts: Array<{
      month: string;
      alert_type: 'negative' | 'low' | 'critical';
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }> = [];

    const predictions = forecast.predictions as Record<string, number>;
    const confidenceIntervals = forecast.confidence_intervals as Record<string, { lower: number; upper: number }>;

    Object.entries(predictions).forEach(([month, value]) => {
      const lowerBound = confidenceIntervals[month]?.lower || value * 0.8;

      if (value < 0) {
        alerts.push({
          month,
          alert_type: 'negative',
          message: `Negative cash flow predicted: PKR ${value.toFixed(0)}`,
          severity: 'critical',
        });
      } else if (value < 50000) {
        alerts.push({
          month,
          alert_type: 'critical',
          message: `Critical low cash position: PKR ${value.toFixed(0)}`,
          severity: 'critical',
        });
      } else if (value < 100000) {
        alerts.push({
          month,
          alert_type: 'low',
          message: `Low cash position: PKR ${value.toFixed(0)}`,
          severity: 'high',
        });
      } else if (lowerBound < 50000) {
        alerts.push({
          month,
          alert_type: 'low',
          message: `Potential low cash risk (lower bound: PKR ${lowerBound.toFixed(0)})`,
          severity: 'medium',
        });
      }
    });

    return {
      forecast,
      alerts: alerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    };
  }
}
