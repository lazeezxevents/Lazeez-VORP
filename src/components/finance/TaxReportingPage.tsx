/**
 * Tax Reporting Page
 * 
 * Displays tax summary, filing status, and deadlines
 * Requirements: 20.7, 20.10
 * Task: 47.4
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  FileText,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Receipt,
  FileCheck
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { complianceTaxManager, TaxReport, ReportType, FilingStatus } from './ComplianceTaxManager';
import { format, parseISO, differenceInDays } from 'date-fns';

// =====================================================
// Animation Variants
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 }
};

// =====================================================
// Helper Functions
// =====================================================

const getFilingStatusConfig = (status: FilingStatus) => {
  const configs = {
    draft: {
      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      icon: FileText,
      label: 'Draft'
    },
    pending: {
      color: 'bg-warning/10 text-warning',
      icon: Clock,
      label: 'Pending'
    },
    filed: {
      color: 'bg-success/10 text-success',
      icon: CheckCircle,
      label: 'Filed'
    },
    paid: {
      color: 'bg-success/10 text-success',
      icon: FileCheck,
      label: 'Paid'
    }
  };
  return configs[status] || configs.draft;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// =====================================================
// Components
// =====================================================

interface TaxReportCardProps {
  report: TaxReport;
  onFile: (reportId: string) => void;
  onExport: (report: TaxReport) => void;
}

const TaxReportCard = ({ report, onFile, onExport }: TaxReportCardProps) => {
  const statusConfig = getFilingStatusConfig(report.filingStatus);
  const StatusIcon = statusConfig.icon;
  
  const daysUntilDeadline = report.filingDeadline
    ? differenceInDays(parseISO(report.filingDeadline), new Date())
    : null;
  
  const isOverdue = daysUntilDeadline !== null && daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline >= 0;

  return (
    <motion.div variants={itemVariants}>
      <Card className="hover-lift transition-all duration-300">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                {report.reportType} Report
              </CardTitle>
              <CardDescription>
                {format(parseISO(report.periodStart), 'MMM d, yyyy')} -{' '}
                {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <Badge className={statusConfig.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total sales</p>
              <p className="text-sm font-medium">{formatCurrency(report.totalSales)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Taxable amount</p>
              <p className="text-sm font-medium">{formatCurrency(report.taxableAmount)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tax collected</p>
              <p className="text-sm font-medium text-success">
                {formatCurrency(report.taxCollected)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tax paid</p>
              <p className="text-sm font-medium text-destructive">
                {formatCurrency(report.taxPaid)}
              </p>
            </div>
          </div>

          {/* Net Liability */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Net tax liability</span>
              <span className="text-lg font-bold">
                {formatCurrency(report.netTaxLiability)}
              </span>
            </div>
          </div>

          {/* Filing Deadline */}
          {report.filingDeadline && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Filing deadline:</span>
              <span className={`font-medium ${isOverdue ? 'text-destructive' : isUrgent ? 'text-warning' : ''}`}>
                {format(parseISO(report.filingDeadline), 'MMM d, yyyy')}
                {daysUntilDeadline !== null && (
                  <span className="ml-1">
                    ({isOverdue ? `${Math.abs(daysUntilDeadline)} days overdue` : `${daysUntilDeadline} days left`})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport(report)}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            {report.filingStatus === 'draft' && (
              <Button
                size="sm"
                onClick={() => onFile(report.id)}
                className="flex-1"
              >
                <FileCheck className="w-4 h-4 mr-2" />
                Mark as filed
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// =====================================================
// Main Component
// =====================================================

export const TaxReportingPage = () => {
  const queryClient = useQueryClient();
  const [selectedJurisdiction] = useState('PK'); // Default to Pakistan
  const [filterStatus, setFilterStatus] = useState<FilingStatus | 'all'>('all');
  const [filterReportType, setFilterReportType] = useState<ReportType | 'all'>('all');
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [generateParams, setGenerateParams] = useState({
    reportType: 'GST' as ReportType,
    periodStart: '',
    periodEnd: ''
  });

  // Fetch tax reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['tax-reports', selectedJurisdiction, filterStatus, filterReportType],
    queryFn: async () => {
      const allReports = await complianceTaxManager.getTaxReports(selectedJurisdiction, {
        status: filterStatus === 'all' ? undefined : filterStatus,
        reportType: filterReportType === 'all' ? undefined : filterReportType,
        limit: 50
      });
      return allReports;
    }
  });

  // Fetch upcoming deadlines
  const { data: upcomingDeadlines = [] } = useQuery({
    queryKey: ['tax-deadlines', selectedJurisdiction],
    queryFn: () => complianceTaxManager.getUpcomingDeadlines(selectedJurisdiction)
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      return await complianceTaxManager.generateTaxReport({
        jurisdictionCode: selectedJurisdiction,
        reportType: generateParams.reportType,
        periodStart: new Date(generateParams.periodStart),
        periodEnd: new Date(generateParams.periodEnd)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-reports'] });
      queryClient.invalidateQueries({ queryKey: ['tax-deadlines'] });
      setIsGenerateDialogOpen(false);
      setGenerateParams({
        reportType: 'GST',
        periodStart: '',
        periodEnd: ''
      });
    }
  });

  // File report mutation
  const fileReportMutation = useMutation({
    mutationFn: (reportId: string) => complianceTaxManager.fileComplianceReport(reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-reports'] });
      queryClient.invalidateQueries({ queryKey: ['tax-deadlines'] });
    }
  });

  // Export report handler
  const handleExportReport = (report: TaxReport) => {
    // Create CSV content
    const csvContent = [
      ['Tax Report', report.reportType],
      ['Period', `${format(parseISO(report.periodStart), 'MMM d, yyyy')} - ${format(parseISO(report.periodEnd), 'MMM d, yyyy')}`],
      [''],
      ['Total Sales', report.totalSales],
      ['Taxable Amount', report.taxableAmount],
      ['Tax Collected', report.taxCollected],
      ['Tax Paid', report.taxPaid],
      ['Net Tax Liability', report.netTaxLiability],
      [''],
      ['Filing Deadline', report.filingDeadline ? format(parseISO(report.filingDeadline), 'MMM d, yyyy') : 'N/A'],
      ['Filing Status', report.filingStatus]
    ].map(row => row.join(',')).join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${report.reportType}-${report.periodStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Report exported successfully');
  };

  // Calculate summary stats
  const totalLiability = reports.reduce((sum, r) => sum + r.netTaxLiability, 0);
  const totalCollected = reports.reduce((sum, r) => sum + r.taxCollected, 0);
  const totalPaid = reports.reduce((sum, r) => sum + r.taxPaid, 0);
  const overdueCount = reports.filter(r => {
    if (!r.filingDeadline || r.filingStatus !== 'draft') return false;
    return differenceInDays(parseISO(r.filingDeadline), new Date()) < 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax reporting</h1>
          <p className="text-sm text-muted-foreground">
            Manage tax calculations and compliance filings
          </p>
        </div>
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <FileText className="w-4 h-4 mr-2" />
              Generate report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate tax report</DialogTitle>
              <DialogDescription>
                Create a new tax report for the specified period
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Report type</Label>
                <Select
                  value={generateParams.reportType}
                  onValueChange={(value) =>
                    setGenerateParams({ ...generateParams, reportType: value as ReportType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST</SelectItem>
                    <SelectItem value="VAT">VAT</SelectItem>
                    <SelectItem value="income_tax">Income tax</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Period start</Label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={generateParams.periodStart}
                  onChange={(e) =>
                    setGenerateParams({ ...generateParams, periodStart: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Period end</Label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={generateParams.periodEnd}
                  onChange={(e) =>
                    setGenerateParams({ ...generateParams, periodEnd: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsGenerateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => generateReportMutation.mutate()}
                disabled={
                  !generateParams.periodStart ||
                  !generateParams.periodEnd ||
                  generateReportMutation.isPending
                }
              >
                {generateReportMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total liability</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalLiability)}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tax collected</p>
                  <p className="text-2xl font-bold text-success">{formatCurrency(totalCollected)}</p>
                </div>
                <div className="p-3 bg-success/10 rounded-full">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tax paid</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-full">
                  <Receipt className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Overdue reports</p>
                  <p className="text-2xl font-bold">{overdueCount}</p>
                </div>
                <div className={`p-3 rounded-full ${overdueCount > 0 ? 'bg-destructive/10' : 'bg-success/10'}`}>
                  <AlertTriangle className={`w-6 h-6 ${overdueCount > 0 ? 'text-destructive' : 'text-success'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Upcoming Deadlines */}
      {upcomingDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Upcoming deadlines</CardTitle>
            <CardDescription>Reports due within the next 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingDeadlines.map((report) => {
                const daysLeft = report.filingDeadline
                  ? differenceInDays(parseISO(report.filingDeadline), new Date())
                  : 0;
                const isUrgent = daysLeft <= 7;

                return (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${isUrgent ? 'bg-warning/10' : 'bg-info/10'}`}>
                        <Calendar className={`w-4 h-4 ${isUrgent ? 'text-warning' : 'text-info'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{report.reportType} Report</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(report.periodStart), 'MMM d')} -{' '}
                          {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${isUrgent ? 'text-warning' : ''}`}>
                        {daysLeft} days left
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.filingDeadline && format(parseISO(report.filingDeadline), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilingStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="filed">Filed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterReportType} onValueChange={(value) => setFilterReportType(value as ReportType | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="GST">GST</SelectItem>
            <SelectItem value="VAT">VAT</SelectItem>
            <SelectItem value="income_tax">Income tax</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="font-medium">No tax reports found</p>
            <p className="text-sm text-muted-foreground">Generate your first report to get started</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {reports.map((report) => (
            <TaxReportCard
              key={report.id}
              report={report}
              onFile={(id) => fileReportMutation.mutate(id)}
              onExport={handleExportReport}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
};
