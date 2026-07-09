import { supabase } from "@/integrations/supabase/client";

export type AnomalyType = "spike" | "drop" | "pattern_break" | "outlier" | "duplicate" | "velocity" | "threshold";
export type AnomalySeverity = "low" | "medium" | "high" | "critical";
export type AnomalyStatus = "open" | "investigating" | "resolved" | "false_positive" | "ignored";

export interface Anomaly {
  id: string;
  transaction_id?: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  expected_value?: number;
  actual_value: number;
  deviation_percent?: number;
  confidence_score?: number;
  suggested_actions?: string[];
  status: AnomalyStatus;
  investigated_by?: string;
  investigated_at?: string;
  resolution_notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface AnomalyDetectionResult {
  transaction_id: string;
  anomaly_type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  expected_value?: number;
  actual_value: number;
  deviation_percent?: number;
  confidence_score: number;
}

export class AnomalyDetector {
  /**
   * Detect anomalies in recent transactions
   */
  static async detectAnomalies(): Promise<AnomalyDetectionResult[]> {
    const { data, error } = await supabase.rpc("detect_transaction_anomalies");

    if (error) {
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }

    return (data || []) as AnomalyDetectionResult[];
  }

  /**
   * Auto-detect and record anomalies
   */
  static async autoDetectAndRecord(): Promise<number> {
    const { data, error } = await supabase.rpc("auto_detect_anomalies");

    if (error) {
      throw new Error(`Failed to auto-detect anomalies: ${error.message}`);
    }

    return data as number;
  }

  /**
   * Analyze a specific transaction for anomalies
   */
  static async analyzeTransaction(transactionId: string): Promise<{
    isAnomaly: boolean;
    anomalyType?: AnomalyType;
    severity?: AnomalySeverity;
    description?: string;
    deviation?: number;
    confidence?: number;
  }> {
    // Validate input
    if (!transactionId || transactionId.trim().length === 0) {
      throw new Error("Transaction ID is required");
    }

    // Get transaction details
    const { data: transaction, error: txError } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError) {
      throw new Error(`Failed to fetch transaction: ${txError.message}`);
    }

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Get historical statistics
    const { data: stats } = await supabase
      .from("finance_transactions")
      .select("amount")
      .gte("transaction_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lt("transaction_date", transaction.transaction_date);

    if (!stats || stats.length < 10) {
      return { isAnomaly: false };
    }

    // Calculate mean and standard deviation
    const amounts = stats.map((s) => s.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Calculate z-score
    const zScore = Math.abs((transaction.amount - mean) / stdDev);
    const deviation = ((transaction.amount - mean) / mean) * 100;

    // Determine if anomaly
    if (zScore > 3) {
      const severity: AnomalySeverity = zScore > 5 ? "critical" : zScore > 4 ? "high" : "medium";
      const anomalyType: AnomalyType = transaction.amount > mean ? "spike" : "drop";
      const confidence = 1 - 1 / (1 + zScore);

      return {
        isAnomaly: true,
        anomalyType,
        severity,
        description: `Transaction amount ${anomalyType === "spike" ? "significantly higher" : "significantly lower"} than average`,
        deviation: Math.abs(deviation),
        confidence,
      };
    }

    return { isAnomaly: false };
  }

  /**
   * Calculate deviation from expected value
   */
  static calculateDeviation(actualValue: number, expectedValue: number): number {
    if (expectedValue === 0) return 0;
    return ((actualValue - expectedValue) / expectedValue) * 100;
  }

  /**
   * Get all anomalies with optional filters
   */
  static async getAnomalies(filters?: {
    severity?: AnomalySeverity;
    status?: AnomalyStatus;
    type?: AnomalyType;
    startDate?: string;
    endDate?: string;
  }): Promise<Anomaly[]> {
    let query = supabase.from("finance_anomalies").select("*").order("created_at", { ascending: false });

    if (filters?.severity) {
      query = query.eq("severity", filters.severity);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.type) {
      query = query.eq("anomaly_type", filters.type);
    }

    if (filters?.startDate) {
      query = query.gte("created_at", filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte("created_at", filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch anomalies: ${error.message}`);
    }

    return (data || []) as Anomaly[];
  }

  /**
   * Update anomaly status
   */
  static async updateAnomalyStatus(
    anomalyId: string,
    status: AnomalyStatus,
    investigatedBy?: string,
    resolutionNotes?: string
  ): Promise<Anomaly> {
    // Validate inputs
    if (!anomalyId || anomalyId.trim().length === 0) {
      throw new Error("Anomaly ID is required");
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (investigatedBy) {
      updateData.investigated_by = investigatedBy;
      updateData.investigated_at = new Date().toISOString();
    }

    if (resolutionNotes) {
      updateData.resolution_notes = resolutionNotes;
    }

    const { data, error } = await supabase.from("finance_anomalies").update(updateData).eq("id", anomalyId).select().single();

    if (error) {
      throw new Error(`Failed to update anomaly status: ${error.message}`);
    }

    return data as Anomaly;
  }

  /**
   * Get anomaly statistics
   */
  static async getAnomalyStats(startDate?: string, endDate?: string): Promise<{
    total: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
    byStatus: Record<AnomalyStatus, number>;
    avgConfidence: number;
  }> {
    let query = supabase.from("finance_anomalies").select("*");

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch anomaly stats: ${error.message}`);
    }

    const anomalies = (data || []) as Anomaly[];

    const bySeverity: Record<AnomalySeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<AnomalyType, number> = {
      spike: 0,
      drop: 0,
      pattern_break: 0,
      outlier: 0,
      duplicate: 0,
      velocity: 0,
      threshold: 0,
    };

    const byStatus: Record<AnomalyStatus, number> = {
      open: 0,
      investigating: 0,
      resolved: 0,
      false_positive: 0,
      ignored: 0,
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    anomalies.forEach((anomaly) => {
      bySeverity[anomaly.severity]++;
      byType[anomaly.anomaly_type]++;
      byStatus[anomaly.status]++;

      if (anomaly.confidence_score) {
        totalConfidence += anomaly.confidence_score;
        confidenceCount++;
      }
    });

    return {
      total: anomalies.length,
      bySeverity,
      byType,
      byStatus,
      avgConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
  }

  /**
   * Detect anomalies using 30-day rolling window statistical analysis
   */
  static async detectWithRollingWindow(
    transactionId: string,
    windowDays: number = 30
  ): Promise<{
    isAnomaly: boolean;
    zScore?: number;
    mean?: number;
    stdDev?: number;
    percentile?: number;
  }> {
    // Validate input
    if (!transactionId || transactionId.trim().length === 0) {
      throw new Error("Transaction ID is required");
    }

    if (windowDays < 7 || windowDays > 365) {
      throw new Error("Window days must be between 7 and 365");
    }

    // Get transaction
    const { data: transaction, error: txError } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error("Transaction not found");
    }

    // Get rolling window data
    const windowStart = new Date(transaction.transaction_date);
    windowStart.setDate(windowStart.getDate() - windowDays);

    const { data: windowData } = await supabase
      .from("finance_transactions")
      .select("amount")
      .gte("transaction_date", windowStart.toISOString())
      .lt("transaction_date", transaction.transaction_date)
      .order("transaction_date", { ascending: false });

    if (!windowData || windowData.length < 10) {
      return { isAnomaly: false };
    }

    // Calculate statistics
    const amounts = windowData.map((t) => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Calculate z-score
    const zScore = stdDev > 0 ? Math.abs((transaction.amount - mean) / stdDev) : 0;

    // Calculate percentile
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const rank = sortedAmounts.filter((a) => a <= transaction.amount).length;
    const percentile = (rank / sortedAmounts.length) * 100;

    return {
      isAnomaly: zScore > 3,
      zScore,
      mean,
      stdDev,
      percentile,
    };
  }

  /**
   * Detect pattern breaks in transaction sequences
   */
  static async detectPatternBreak(
    transactionType: string,
    lookbackDays: number = 90
  ): Promise<Array<{
    transaction_id: string;
    expected_pattern: string;
    actual_pattern: string;
    confidence: number;
  }>> {
    // Validate input
    if (!transactionType || transactionType.trim().length === 0) {
      throw new Error("Transaction type is required");
    }

    if (lookbackDays < 30 || lookbackDays > 365) {
      throw new Error("Lookback days must be between 30 and 365");
    }

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    // Get historical transactions
    const { data: transactions } = await supabase
      .from("finance_transactions")
      .select("*")
      .eq("type", transactionType)
      .gte("transaction_date", lookbackDate.toISOString())
      .order("transaction_date", { ascending: true });

    if (!transactions || transactions.length < 20) {
      return [];
    }

    const patternBreaks: Array<{
      transaction_id: string;
      expected_pattern: string;
      actual_pattern: string;
      confidence: number;
    }> = [];

    // Analyze day-of-week patterns
    const dayOfWeekCounts = new Array(7).fill(0);
    transactions.forEach((t) => {
      const day = new Date(t.transaction_date).getDay();
      dayOfWeekCounts[day]++;
    });

    const totalCount = transactions.length;
    const expectedDayFrequency = dayOfWeekCounts.map((count) => count / totalCount);

    // Check recent transactions for pattern breaks
    const recentTransactions = transactions.slice(-10);
    recentTransactions.forEach((t) => {
      const day = new Date(t.transaction_date).getDay();
      const expectedFreq = expectedDayFrequency[day];

      // If this day typically has low frequency but transaction occurred
      if (expectedFreq < 0.05 && expectedFreq > 0) {
        patternBreaks.push({
          transaction_id: t.id,
          expected_pattern: `Low frequency on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}`,
          actual_pattern: "Transaction occurred on unusual day",
          confidence: 1 - expectedFreq,
        });
      }
    });

    return patternBreaks;
  }

  /**
   * Detect fraud patterns using velocity and behavior analysis
   */
  static async detectFraudPatterns(
    userId?: string,
    hours: number = 24
  ): Promise<Array<{
    pattern_type: "rapid_succession" | "unusual_time" | "amount_escalation" | "geographic_anomaly";
    severity: AnomalySeverity;
    description: string;
    transaction_ids: string[];
    confidence: number;
  }>> {
    // Validate input
    if (hours < 1 || hours > 168) {
      throw new Error("Hours must be between 1 and 168 (1 week)");
    }

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    let query = supabase
      .from("finance_transactions")
      .select("*")
      .gte("transaction_date", startTime.toISOString())
      .order("transaction_date", { ascending: true });

    if (userId) {
      query = query.eq("created_by", userId);
    }

    const { data: transactions } = await query;

    if (!transactions || transactions.length === 0) {
      return [];
    }

    const fraudPatterns: Array<{
      pattern_type: "rapid_succession" | "unusual_time" | "amount_escalation" | "geographic_anomaly";
      severity: AnomalySeverity;
      description: string;
      transaction_ids: string[];
      confidence: number;
    }> = [];

    // 1. Rapid succession detection (velocity)
    const rapidTransactions: string[] = [];
    for (let i = 1; i < transactions.length; i++) {
      const timeDiff =
        new Date(transactions[i].transaction_date).getTime() -
        new Date(transactions[i - 1].transaction_date).getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (minutesDiff < 5) {
        rapidTransactions.push(transactions[i].id);
      }
    }

    if (rapidTransactions.length >= 3) {
      fraudPatterns.push({
        pattern_type: "rapid_succession",
        severity: rapidTransactions.length >= 5 ? "critical" : "high",
        description: `${rapidTransactions.length} transactions within 5 minutes`,
        transaction_ids: rapidTransactions,
        confidence: Math.min(0.95, 0.6 + rapidTransactions.length * 0.1),
      });
    }

    // 2. Unusual time detection (transactions at odd hours)
    const unusualTimeTransactions: string[] = [];
    transactions.forEach((t) => {
      const hour = new Date(t.transaction_date).getHours();
      // Flag transactions between 2 AM and 5 AM
      if (hour >= 2 && hour < 5) {
        unusualTimeTransactions.push(t.id);
      }
    });

    if (unusualTimeTransactions.length > 0) {
      fraudPatterns.push({
        pattern_type: "unusual_time",
        severity: unusualTimeTransactions.length >= 3 ? "high" : "medium",
        description: `${unusualTimeTransactions.length} transactions during unusual hours (2-5 AM)`,
        transaction_ids: unusualTimeTransactions,
        confidence: 0.7,
      });
    }

    // 3. Amount escalation detection
    const amounts = transactions.map((t) => t.amount);
    let escalationCount = 0;
    const escalationTransactions: string[] = [];

    for (let i = 1; i < amounts.length; i++) {
      const increase = ((amounts[i] - amounts[i - 1]) / amounts[i - 1]) * 100;
      if (increase > 50) {
        escalationCount++;
        escalationTransactions.push(transactions[i].id);
      }
    }

    if (escalationCount >= 2) {
      fraudPatterns.push({
        pattern_type: "amount_escalation",
        severity: escalationCount >= 3 ? "critical" : "high",
        description: `${escalationCount} transactions with >50% amount escalation`,
        transaction_ids: escalationTransactions,
        confidence: 0.8,
      });
    }

    return fraudPatterns;
  }

  /**
   * Detect duplicate transactions with fuzzy matching
   */
  static async detectDuplicates(
    timeWindowHours: number = 24,
    amountTolerance: number = 0.01
  ): Promise<Array<{
    original_id: string;
    duplicate_ids: string[];
    similarity_score: number;
  }>> {
    // Validate input
    if (timeWindowHours < 1 || timeWindowHours > 168) {
      throw new Error("Time window must be between 1 and 168 hours");
    }

    if (amountTolerance < 0 || amountTolerance > 0.1) {
      throw new Error("Amount tolerance must be between 0 and 0.1 (10%)");
    }

    const startTime = new Date();
    startTime.setHours(startTime.getHours() - timeWindowHours);

    const { data: transactions } = await supabase
      .from("finance_transactions")
      .select("*")
      .gte("transaction_date", startTime.toISOString())
      .order("transaction_date", { ascending: true });

    if (!transactions || transactions.length < 2) {
      return [];
    }

    const duplicates: Array<{
      original_id: string;
      duplicate_ids: string[];
      similarity_score: number;
    }> = [];

    const processed = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
      if (processed.has(transactions[i].id)) continue;

      const original = transactions[i];
      const potentialDuplicates: string[] = [];

      for (let j = i + 1; j < transactions.length; j++) {
        if (processed.has(transactions[j].id)) continue;

        const candidate = transactions[j];

        // Check amount similarity
        const amountDiff = Math.abs(original.amount - candidate.amount);
        const amountSimilarity = 1 - amountDiff / Math.max(original.amount, candidate.amount);

        if (amountSimilarity >= 1 - amountTolerance) {
          // Check time proximity (within same day)
          const timeDiff = Math.abs(
            new Date(original.transaction_date).getTime() - new Date(candidate.transaction_date).getTime()
          );
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          if (hoursDiff < 24) {
            // Check type match
            const typeMatch = original.type === candidate.type ? 1 : 0;

            // Calculate overall similarity
            const similarity = (amountSimilarity + typeMatch) / 2;

            if (similarity >= 0.9) {
              potentialDuplicates.push(candidate.id);
              processed.add(candidate.id);
            }
          }
        }
      }

      if (potentialDuplicates.length > 0) {
        duplicates.push({
          original_id: original.id,
          duplicate_ids: potentialDuplicates,
          similarity_score: 0.95,
        });
        processed.add(original.id);
      }
    }

    return duplicates;
  }

  /**
   * Calculate z-score for outlier detection
   */
  static calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return Math.abs((value - mean) / stdDev);
  }

  /**
   * Detect outliers using Interquartile Range (IQR) method
   */
  static async detectOutliersIQR(
    transactionType?: string,
    lookbackDays: number = 30
  ): Promise<Array<{
    transaction_id: string;
    amount: number;
    iqr_multiplier: number;
    is_upper_outlier: boolean;
  }>> {
    // Validate input
    if (lookbackDays < 7 || lookbackDays > 365) {
      throw new Error("Lookback days must be between 7 and 365");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    let query = supabase
      .from("finance_transactions")
      .select("id, amount, transaction_date")
      .gte("transaction_date", startDate.toISOString())
      .order("amount", { ascending: true });

    if (transactionType) {
      query = query.eq("type", transactionType);
    }

    const { data: transactions } = await query;

    if (!transactions || transactions.length < 10) {
      return [];
    }

    const amounts = transactions.map((t) => t.amount);

    // Calculate quartiles
    const q1Index = Math.floor(amounts.length * 0.25);
    const q3Index = Math.floor(amounts.length * 0.75);
    const q1 = amounts[q1Index];
    const q3 = amounts[q3Index];
    const iqr = q3 - q1;

    // Calculate bounds (1.5 * IQR is standard for outliers)
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: Array<{
      transaction_id: string;
      amount: number;
      iqr_multiplier: number;
      is_upper_outlier: boolean;
    }> = [];

    transactions.forEach((t) => {
      if (t.amount < lowerBound) {
        outliers.push({
          transaction_id: t.id,
          amount: t.amount,
          iqr_multiplier: (q1 - t.amount) / iqr,
          is_upper_outlier: false,
        });
      } else if (t.amount > upperBound) {
        outliers.push({
          transaction_id: t.id,
          amount: t.amount,
          iqr_multiplier: (t.amount - q3) / iqr,
          is_upper_outlier: true,
        });
      }
    });

    return outliers;
  }

  /**
   * Generate suggested actions for an anomaly
   */
  static generateSuggestedActions(anomalyType: AnomalyType, severity: AnomalySeverity): string[] {
    const baseActions: Record<AnomalyType, string[]> = {
      spike: [
        "Verify transaction legitimacy with source system",
        "Check for data entry errors or decimal point issues",
        "Review approval workflow and authorization",
        "Confirm with vendor or customer if applicable",
      ],
      drop: [
        "Verify transaction completeness",
        "Check for missing data or partial records",
        "Review transaction source and integration",
        "Confirm expected transaction amount",
      ],
      pattern_break: [
        "Analyze recent changes in business operations",
        "Review transaction patterns over longer period",
        "Check for system or process changes",
        "Investigate external factors affecting transactions",
      ],
      outlier: [
        "Perform statistical analysis on transaction",
        "Compare with similar historical transactions",
        "Verify data quality and accuracy",
        "Review for exceptional business circumstances",
      ],
      duplicate: [
        "Check for duplicate entries in source system",
        "Verify transaction uniqueness constraints",
        "Review data import and integration processes",
        "Investigate potential system glitches",
      ],
      velocity: [
        "Review transaction source and automation",
        "Check for bulk processing or batch operations",
        "Verify rate limiting and throttling controls",
        "Investigate potential security concerns",
      ],
      threshold: [
        "Review against configured threshold rules",
        "Verify business justification for amount",
        "Check approval requirements and compliance",
        "Document exception if legitimate",
      ],
    };

    const actions = [...baseActions[anomalyType]];

    // Add severity-specific actions
    if (severity === "critical" || severity === "high") {
      actions.unshift("URGENT: Immediate investigation required");
      actions.push("Notify finance management immediately");
      actions.push("Consider temporary hold on related transactions");
    }

    return actions;
  }
}
