import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2, Building2, CreditCard, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useVendors } from "@/hooks/useVendors";
import { useVendorPayments } from "@/hooks/useVendorPayments";
import { useIssues } from "@/hooks/useIssues";
import { useMOUs } from "@/hooks/useMOUs";
import {
  exportVendorsToPDF,
  exportVendorsToExcel,
  exportPaymentsToPDF,
  exportPaymentsToExcel,
  exportAnalyticsToPDF,
  exportAnalyticsToExcel,
} from "@/utils/dataExport";

type ExportType = "vendors" | "payments" | "analytics";
type ExportFormat = "pdf" | "excel";

export function DataExportPanel() {
  const [exportType, setExportType] = useState<ExportType>("vendors");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [isExporting, setIsExporting] = useState(false);

  const { data: vendors } = useVendors();
  const { data: payments } = useVendorPayments();
  const { data: issues } = useIssues();
  const { mous } = useMOUs();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      switch (exportType) {
        case "vendors":
          if (!vendors || vendors.length === 0) {
            toast.error("No vendors to export");
            return;
          }
          if (exportFormat === "pdf") {
            exportVendorsToPDF(vendors);
          } else {
            exportVendorsToExcel(vendors);
          }
          toast.success(`${vendors.length} vendors exported`);
          break;

        case "payments":
          if (!payments || payments.length === 0) {
            toast.error("No payments to export");
            return;
          }
          const paymentData = payments.map((p) => ({
            ...p,
            vendor_name: vendors?.find((v) => v.id === p.vendor_id)?.name || "Unknown",
          }));
          if (exportFormat === "pdf") {
            exportPaymentsToPDF(paymentData);
          } else {
            exportPaymentsToExcel(paymentData);
          }
          toast.success(`${payments.length} payments exported`);
          break;

        case "analytics":
          const analyticsData = {
            vendorStats: {
              total: vendors?.length || 0,
              active: vendors?.filter((v) => v.status === "active" || v.status === "onboarded").length || 0,
              pending: vendors?.filter((v) => v.status === "pending" || v.status === "new").length || 0,
              terminated: vendors?.filter((v) => v.status === "terminated" || v.status === "left").length || 0,
            },
            issueStats: {
              total: issues?.length || 0,
              open: issues?.filter((i) => i.status === "open").length || 0,
              inProgress: issues?.filter((i) => i.status === "in_progress").length || 0,
              resolved: issues?.filter((i) => i.status === "resolved" || i.status === "closed").length || 0,
            },
            mouStats: {
              total: mous?.length || 0,
              active: mous?.filter((m) => m.status === "signed" || m.status === "approved").length || 0,
              expiringSoon: mous?.filter((m) => {
                if (!m.end_date) return false;
                const daysUntil = Math.ceil((new Date(m.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return daysUntil > 0 && daysUntil <= 30;
              }).length || 0,
              expired: mous?.filter((m) => m.status === "expired").length || 0,
            },
            paymentStats: {
              totalRevenue: payments?.reduce((sum, p) => sum + p.order_amount, 0) || 0,
              totalCommission: payments?.reduce((sum, p) => sum + p.commission_amount, 0) || 0,
              pendingPayments: payments?.filter((p) => p.payment_status === "pending" || p.payment_status === "partial").length || 0,
              completedPayments: payments?.filter((p) => p.payment_status === "completed").length || 0,
            },
          };
          if (exportFormat === "pdf") {
            exportAnalyticsToPDF(analyticsData);
          } else {
            exportAnalyticsToExcel(analyticsData);
          }
          toast.success("Analytics report exported");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      value: "vendors",
      label: "Vendor Directory",
      description: "Export all vendor information including contacts and financials",
      icon: Building2,
      count: vendors?.length || 0,
    },
    {
      value: "payments",
      label: "Payment Transactions",
      description: "Export all payment records with commission details",
      icon: CreditCard,
      count: payments?.length || 0,
    },
    {
      value: "analytics",
      label: "Analytics Report",
      description: "Export comprehensive analytics dashboard data",
      icon: BarChart3,
      count: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Data Export
        </CardTitle>
        <CardDescription>
          Generate PDF or Excel reports for vendors, payments, and analytics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Type Selection */}
        <div className="space-y-3">
          <Label>What would you like to export?</Label>
          <div className="grid gap-3">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <div
                  key={option.value}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    exportType === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setExportType(option.value as ExportType)}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-5 h-5 ${
                        exportType === option.value ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{option.label}</span>
                        {option.count !== null && (
                          <span className="text-xs text-muted-foreground">
                            {option.count} records
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <Label>Export Format</Label>
          <Select value={exportFormat} onValueChange={(v: ExportFormat) => setExportFormat(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-destructive" />
                  PDF Document
                </div>
              </SelectItem>
              <SelectItem value="excel">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-success" />
                  Excel Spreadsheet
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Button */}
        <Button className="w-full" onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export {exportFormat.toUpperCase()}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
