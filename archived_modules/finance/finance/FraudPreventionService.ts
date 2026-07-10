/**
 * Fraud Prevention Service
 * 
 * Monitors transactions for fraud and manages approval workflows
 * Requirements: 16.1 (extended), 8.10 (extended)
 * Tasks: 49.1, 49.2
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export type FraudRuleType = 'large_transaction' | 'velocity' | 'pattern' | 'duplicate' | 'threshold';
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'investigating' | 'resolved' | 'false_positive';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ApprovalLevel = 'manager' | 'senior_manager' | 'director' | 'cfo';

export interface FraudRule {
  id: string;
  ruleName: string;
  ruleType: FraudRuleType;
  description: string | null;
  thresholdAmount: number | null;
  timeWindowMinutes: number | null;
  maxTransactionsPerWindow: number | null;
  severity: FraudSeverity;
  autoBlock: boolean;
  requireApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FraudAlert {
  id: string;
  alertType: string;
  severity: FraudSeverity;
  description: string;
  transactionId: string | null;
  entityType: string | null;
  entityId: string | null;
  alertData: any;
  triggeredRuleId: string | null;
  status: AlertStatus;
  resolutionNotes: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface TransactionApproval {
  id: string;
  transactionId: string;
  transactionType: string;
  amount: number;
  requiredApprovals: number;
  approvalLevel: ApprovalLevel;
  status: ApprovalStatus;
  approvals: any[];
  executeAfter: string | null;
  executedAt: string | null;
  requestedBy: string | null;
  requestedAt: string;
  expiresAt: string | null;
}

export interface FraudCheckResult {
  isFlagged: boolean;
  severity: FraudSeverity | null;
  ruleId: string | null;
  description: string | null;
  transactionCount?: number;
}

// =====================================================
// Fraud Prevention Service
// =====================================================

export class FraudPreventionService {
  /**
   * Check for large transaction
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async checkLargeTransaction(
    amount: number,
    transactionType: string
  ): Promise<FraudCheckResult> {
    try {
      const { data, error } = await supabase.rpc('check_large_transaction', {
        p_amount: amount,
        p_transaction_type: transactionType
      });

      if (error) {
        console.error('Check large transaction failed:', error);
        throw error;
      }

      const result = data[0];

      return {
        isFlagged: result.is_flagged,
        severity: result.severity,
        ruleId: result.rule_id,
        description: result.description
      };
    } catch (error) {
      console.error('Check large transaction failed:', error);
      throw error;
    }
  }

  /**
   * Check transaction velocity
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async checkTransactionVelocity(
    entityType: string,
    entityId: string,
    transactionType: string
  ): Promise<FraudCheckResult> {
    try {
      const { data, error } = await supabase.rpc('check_transaction_velocity', {
        p_entityType: entityType,
        p_entityId: entityId,
        p_transaction_type: transactionType
      });

      if (error) {
        console.error('Check transaction velocity failed:', error);
        throw error;
      }

      const result = data[0];

      return {
        isFlagged: result.is_flagged,
        severity: result.severity,
        ruleId: result.rule_id,
        description: result.description,
        transactionCount: result.transaction_count
      };
    } catch (error) {
      console.error('Check transaction velocity failed:', error);
      throw error;
    }
  }

  /**
   * Create fraud alert
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async createFraudAlert(params: {
    alertType: string;
    severity: FraudSeverity;
    description: string;
    transactionId?: string;
    entityType?: string;
    entityId?: string;
    alertData?: any;
    ruleId?: string;
  }): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('create_fraud_alert', {
        p_alert_type: params.alertType,
        p_severity: params.severity,
        p_description: params.description,
        p_transaction_id: params.transactionId || null,
        p_entityType: params.entityType || null,
        p_entityId: params.entityId || null,
        p_alert_data: params.alertData || null,
        p_rule_id: params.ruleId || null
      });

      if (error) {
        console.error('Create fraud alert failed:', error);
        throw error;
      }

      toast.warning('Fraud alert created', {
        description: params.description
      });

      return data;
    } catch (error) {
      console.error('Create fraud alert failed:', error);
      throw error;
    }
  }

  /**
   * Request transaction approval
   * Requirements: 8.10 (extended)
   * Task: 49.2
   */
  async requestTransactionApproval(params: {
    transactionId: string;
    transactionType: string;
    amount: number;
    requiredApprovals?: number;
    approvalLevel?: ApprovalLevel;
    delayMinutes?: number;
  }): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('request_transaction_approval', {
        p_transaction_id: params.transactionId,
        p_transaction_type: params.transactionType,
        p_amount: params.amount,
        p_required_approvals: params.requiredApprovals || 1,
        p_approval_level: params.approvalLevel || 'manager',
        p_delay_minutes: params.delayMinutes || 0
      });

      if (error) {
        console.error('Request transaction approval failed:', error);
        toast.error('Failed to request approval');
        throw error;
      }

      toast.info('Transaction approval requested', {
        description: `Requires ${params.requiredApprovals || 1} approval(s)`
      });

      return data;
    } catch (error) {
      console.error('Request transaction approval failed:', error);
      throw error;
    }
  }

  /**
   * Approve transaction
   * Requirements: 8.10 (extended)
   * Task: 49.2
   */
  async approveTransaction(
    approvalId: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('approve_transaction', {
        p_approval_id: approvalId,
        p_approval_notes: approvalNotes || null
      });

      if (error) {
        console.error('Approve transaction failed:', error);
        toast.error('Failed to approve transaction');
        throw error;
      }

      if (data) {
        toast.success('Transaction approved and ready for execution');
      } else {
        toast.info('Approval recorded, waiting for additional approvals');
      }

      return data;
    } catch (error) {
      console.error('Approve transaction failed:', error);
      throw error;
    }
  }

  /**
   * Reject transaction
   * Requirements: 8.10 (extended)
   * Task: 49.2
   */
  async rejectTransaction(
    approvalId: string,
    rejectionReason: string
  ): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('reject_transaction', {
        p_approval_id: approvalId,
        p_rejection_reason: rejectionReason
      });

      if (error) {
        console.error('Reject transaction failed:', error);
        toast.error('Failed to reject transaction');
        throw error;
      }

      if (data) {
        toast.success('Transaction rejected');
      } else {
        toast.error('Approval request not found');
      }
    } catch (error) {
      console.error('Reject transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get fraud alerts
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async getFraudAlerts(options?: {
    status?: AlertStatus;
    severity?: FraudSeverity;
    limit?: number;
  }): Promise<FraudAlert[]> {
    try {
      let query = supabase
        .from('finance_fraud_alerts')
        .select('*')
        .order('detected_at', { ascending: false });

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.severity) {
        query = query.eq('severity', options.severity);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Get fraud alerts failed:', error);
        throw error;
      }

      return (data || []).map(alert => ({
        id: alert.id,
        alertType: alert.alert_type,
        severity: alert.severity as FraudSeverity,
        description: alert.description,
        transactionId: alert.transaction_id,
        entityType: alert.entity_type,
        entityId: alert.entity_id,
        alertData: alert.alert_data,
        triggeredRuleId: alert.triggered_rule_id,
        status: alert.status as AlertStatus,
        resolutionNotes: alert.resolution_notes,
        detectedAt: alert.detected_at,
        resolvedAt: alert.resolved_at,
        resolvedBy: alert.resolved_by
      }));
    } catch (error) {
      console.error('Get fraud alerts failed:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals
   * Requirements: 8.10 (extended)
   * Task: 49.2
   */
  async getPendingApprovals(): Promise<TransactionApproval[]> {
    try {
      const { data, error } = await supabase
        .from('finance_transaction_approvals')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });

      if (error) {
        console.error('Get pending approvals failed:', error);
        throw error;
      }

      return (data || []).map(approval => ({
        id: approval.id,
        transactionId: approval.transaction_id,
        transactionType: approval.transaction_type,
        amount: parseFloat(approval.amount),
        requiredApprovals: approval.required_approvals,
        approvalLevel: approval.approval_level as ApprovalLevel,
        status: approval.status as ApprovalStatus,
        approvals: approval.approvals || [],
        executeAfter: approval.execute_after,
        executedAt: approval.executed_at,
        requestedBy: approval.requested_by,
        requestedAt: approval.requested_at,
        expiresAt: approval.expires_at
      }));
    } catch (error) {
      console.error('Get pending approvals failed:', error);
      throw error;
    }
  }

  /**
   * Resolve fraud alert
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async resolveFraudAlert(
    alertId: string,
    status: 'resolved' | 'false_positive',
    resolutionNotes: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('finance_fraud_alerts')
        .update({
          status,
          resolution_notes: resolutionNotes,
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      if (error) {
        console.error('Resolve fraud alert failed:', error);
        toast.error('Failed to resolve alert');
        throw error;
      }

      toast.success('Fraud alert resolved');
    } catch (error) {
      console.error('Resolve fraud alert failed:', error);
      throw error;
    }
  }

  /**
   * Get fraud statistics
   * Requirements: 16.1 (extended)
   * Task: 49.1
   */
  async getFraudStatistics(): Promise<{
    totalAlerts: number;
    openAlerts: number;
    criticalAlerts: number;
    pendingApprovals: number;
    resolvedToday: number;
  }> {
    try {
      const { count: totalAlerts } = await supabase
        .from('finance_fraud_alerts')
        .select('*', { count: 'exact', head: true });

      const { count: openAlerts } = await supabase
        .from('finance_fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      const { count: criticalAlerts } = await supabase
        .from('finance_fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .eq('status', 'open');

      const { count: pendingApprovals } = await supabase
        .from('finance_transaction_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: resolvedToday } = await supabase
        .from('finance_fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['resolved', 'false_positive'])
        .gte('resolved_at', today.toISOString());

      return {
        totalAlerts: totalAlerts || 0,
        openAlerts: openAlerts || 0,
        criticalAlerts: criticalAlerts || 0,
        pendingApprovals: pendingApprovals || 0,
        resolvedToday: resolvedToday || 0
      };
    } catch (error) {
      console.error('Get fraud statistics failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fraudPreventionService = new FraudPreventionService();
