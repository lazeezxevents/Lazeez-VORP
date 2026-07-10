/**
 * Compliance Tax Manager Service
 * 
 * Handles tax calculation, reporting, and compliance filing
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8
 * Tasks: 47.1, 47.2, 47.3
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export type TaxType = 'VAT' | 'GST' | 'income_tax' | 'sales_tax' | 'withholding_tax';
export type TransactionType = 'sale' | 'purchase' | 'income' | 'expense';
export type FilingStatus = 'draft' | 'pending' | 'filed' | 'paid';
export type ReportType = 'VAT' | 'GST' | 'income_tax' | 'sales_tax' | 'quarterly' | 'annual';

export interface TaxCalculationParams {
  jurisdictionCode: string;
  taxType: TaxType;
  taxableAmount: number;
  transactionDate: Date;
  transactionId?: string;
  transactionType: TransactionType;
}

export interface TaxCalculationResult {
  taxAmount: number;
  taxRate: number;
  ruleId: string | null;
  calculationId?: string;
}

export interface TaxReportParams {
  jurisdictionCode: string;
  reportType: ReportType;
  periodStart: Date;
  periodEnd: Date;
}

export interface TaxReportSummary {
  totalSales: number;
  taxableAmount: number;
  taxCollected: number;
  taxPaid: number;
  netTaxLiability: number;
}

export interface TaxReport extends TaxReportSummary {
  id: string;
  jurisdictionId: string;
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  filingDeadline: string | null;
  filingStatus: FilingStatus;
  filedAt: string | null;
  filedBy: string | null;
  reportData: any;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// Compliance Tax Manager Service
// =====================================================

export class ComplianceTaxManager {
  /**
   * Calculate tax for a transaction
   * Requirements: 20.1, 20.2, 20.3, 20.6
   * Task: 47.2
   */
  async calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
    try {
      const {
        jurisdictionCode,
        taxType,
        taxableAmount,
        transactionDate,
        transactionId,
        transactionType
      } = params;

      // Call database function to calculate tax
      const { data, error } = await supabase.rpc('calculate_tax', {
        p_jurisdiction_code: jurisdictionCode,
        p_tax_type: taxType,
        p_taxable_amount: taxableAmount,
        p_transaction_date: transactionDate.toISOString().split('T')[0]
      });

      if (error) {
        console.error('Tax calculation error:', error);
        toast.error('Failed to calculate tax');
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          taxAmount: 0,
          taxRate: 0,
          ruleId: null
        };
      }

      const result = data[0];

      // Record the calculation in the database
      if (result.rule_id) {
        const { data: jurisdiction } = await supabase
          .from('finance_tax_jurisdictions')
          .select('id')
          .eq('jurisdiction_code', jurisdictionCode)
          .single();

        if (jurisdiction) {
          const { data: calculation, error: calcError } = await supabase
            .from('finance_tax_calculations')
            .insert({
              jurisdiction_id: jurisdiction.id,
              tax_rule_id: result.rule_id,
              transaction_id: transactionId || null,
              transaction_type: transactionType,
              transaction_date: transactionDate.toISOString().split('T')[0],
              taxable_amount: taxableAmount,
              tax_rate: result.tax_rate,
              tax_amount: result.tax_amount,
              calculated_by: (await supabase.auth.getUser()).data.user?.id
            })
            .select('id')
            .single();

          if (calcError) {
            console.error('Failed to record tax calculation:', calcError);
          }

          return {
            taxAmount: parseFloat(result.tax_amount),
            taxRate: parseFloat(result.tax_rate),
            ruleId: result.rule_id,
            calculationId: calculation?.id
          };
        }
      }

      return {
        taxAmount: parseFloat(result.tax_amount),
        taxRate: parseFloat(result.tax_rate),
        ruleId: result.rule_id
      };
    } catch (error) {
      console.error('Tax calculation failed:', error);
      throw error;
    }
  }

  /**
   * Generate tax report for a period
   * Requirements: 20.4, 20.5, 20.7, 20.8
   * Task: 47.3
   */
  async generateTaxReport(params: TaxReportParams): Promise<TaxReport> {
    try {
      const { jurisdictionCode, reportType, periodStart, periodEnd } = params;

      // Get jurisdiction
      const { data: jurisdiction, error: jurisdictionError } = await supabase
        .from('finance_tax_jurisdictions')
        .select('id')
        .eq('jurisdiction_code', jurisdictionCode)
        .single();

      if (jurisdictionError || !jurisdiction) {
        toast.error('Jurisdiction not found');
        throw new Error(`Jurisdiction not found: ${jurisdictionCode}`);
      }

      // Call database function to generate report summary
      const { data: summary, error: summaryError } = await supabase.rpc('generate_tax_report', {
        p_jurisdiction_code: jurisdictionCode,
        p_report_type: reportType,
        p_period_start: periodStart.toISOString().split('T')[0],
        p_period_end: periodEnd.toISOString().split('T')[0]
      });

      if (summaryError) {
        console.error('Tax report generation error:', summaryError);
        toast.error('Failed to generate tax report');
        throw summaryError;
      }

      const reportSummary = summary[0];

      // Get filing deadline
      const { data: deadline } = await supabase.rpc('get_next_filing_deadline', {
        p_jurisdiction_code: jurisdictionCode,
        p_report_type: reportType
      });

      // Get detailed calculations for the period
      const { data: calculations } = await supabase
        .from('finance_tax_calculations')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
        .gte('transaction_date', periodStart.toISOString().split('T')[0])
        .lte('transaction_date', periodEnd.toISOString().split('T')[0])
        .order('transaction_date', { ascending: true });

      // Create report record
      const { data: report, error: reportError } = await supabase
        .from('finance_tax_reports')
        .insert({
          jurisdiction_id: jurisdiction.id,
          report_type: reportType,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          total_sales: reportSummary.total_sales,
          taxable_amount: reportSummary.taxable_amount,
          tax_collected: reportSummary.tax_collected,
          tax_paid: reportSummary.tax_paid,
          net_tax_liability: reportSummary.net_tax_liability,
          filing_deadline: deadline || null,
          filing_status: 'draft',
          report_data: {
            calculations: calculations || [],
            summary: reportSummary,
            generatedAt: new Date().toISOString()
          },
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (reportError) {
        console.error('Failed to create tax report:', reportError);
        toast.error('Failed to create tax report');
        throw reportError;
      }

      toast.success('Tax report generated successfully');

      return {
        id: report.id,
        jurisdictionId: report.jurisdiction_id,
        reportType: report.report_type as ReportType,
        periodStart: report.period_start,
        periodEnd: report.period_end,
        totalSales: parseFloat(report.total_sales),
        taxableAmount: parseFloat(report.taxable_amount),
        taxCollected: parseFloat(report.tax_collected),
        taxPaid: parseFloat(report.tax_paid),
        netTaxLiability: parseFloat(report.net_tax_liability),
        filingDeadline: report.filing_deadline,
        filingStatus: report.filing_status as FilingStatus,
        filedAt: report.filed_at,
        filedBy: report.filed_by,
        reportData: report.report_data,
        createdAt: report.created_at,
        updatedAt: report.updated_at
      };
    } catch (error) {
      console.error('Tax report generation failed:', error);
      throw error;
    }
  }

  /**
   * File a compliance report (mark as filed)
   * Requirements: 20.7, 20.8
   * Task: 47.3
   */
  async fileComplianceReport(reportId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('finance_tax_reports')
        .update({
          filing_status: 'filed',
          filed_at: new Date().toISOString(),
          filed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', reportId);

      if (error) {
        console.error('Failed to file compliance report:', error);
        toast.error('Failed to file compliance report');
        throw error;
      }

      toast.success('Compliance report filed successfully');
    } catch (error) {
      console.error('Filing compliance report failed:', error);
      throw error;
    }
  }

  /**
   * Get tax reports for a jurisdiction
   */
  async getTaxReports(
    jurisdictionCode: string,
    options?: {
      status?: FilingStatus;
      reportType?: ReportType;
      limit?: number;
    }
  ): Promise<TaxReport[]> {
    try {
      // Get jurisdiction
      const { data: jurisdiction } = await supabase
        .from('finance_tax_jurisdictions')
        .select('id')
        .eq('jurisdiction_code', jurisdictionCode)
        .single();

      if (!jurisdiction) {
        return [];
      }

      let query = supabase
        .from('finance_tax_reports')
        .select('*')
        .eq('jurisdiction_id', jurisdiction.id)
        .order('period_end', { ascending: false });

      if (options?.status) {
        query = query.eq('filing_status', options.status);
      }

      if (options?.reportType) {
        query = query.eq('report_type', options.reportType);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch tax reports:', error);
        throw error;
      }

      return (data || []).map(report => ({
        id: report.id,
        jurisdictionId: report.jurisdiction_id,
        reportType: report.report_type as ReportType,
        periodStart: report.period_start,
        periodEnd: report.period_end,
        totalSales: parseFloat(report.total_sales),
        taxableAmount: parseFloat(report.taxable_amount),
        taxCollected: parseFloat(report.tax_collected),
        taxPaid: parseFloat(report.tax_paid),
        netTaxLiability: parseFloat(report.net_tax_liability),
        filingDeadline: report.filing_deadline,
        filingStatus: report.filing_status as FilingStatus,
        filedAt: report.filed_at,
        filedBy: report.filed_by,
        reportData: report.report_data,
        createdAt: report.created_at,
        updatedAt: report.updated_at
      }));
    } catch (error) {
      console.error('Failed to get tax reports:', error);
      throw error;
    }
  }

  /**
   * Get upcoming filing deadlines
   */
  async getUpcomingDeadlines(jurisdictionCode: string): Promise<TaxReport[]> {
    try {
      const reports = await this.getTaxReports(jurisdictionCode, {
        status: 'draft',
        limit: 10
      });

      // Filter reports with upcoming deadlines (within next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      return reports.filter(report => {
        if (!report.filingDeadline) return false;
        const deadline = new Date(report.filingDeadline);
        return deadline <= thirtyDaysFromNow && deadline >= new Date();
      });
    } catch (error) {
      console.error('Failed to get upcoming deadlines:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const complianceTaxManager = new ComplianceTaxManager();
