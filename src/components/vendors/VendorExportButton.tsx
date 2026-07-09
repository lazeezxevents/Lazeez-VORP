import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Vendor } from "@/hooks/useVendors";
import {
  exportSingleVendorToPDF,
  exportSingleVendorToExcel,
  exportVendorsToPDF,
  exportVendorsToExcel,
} from "@/utils/dataExport";
import { toast } from "sonner";

interface VendorExportButtonProps {
  vendor?: Vendor;
  vendors?: Vendor[];
  stats?: {
    totalIssues?: number;
    openIssues?: number;
    resolvedIssues?: number;
    totalPayments?: number;
    totalRevenue?: number;
  };
  variant?: "single" | "bulk";
  fullWidth?: boolean;
}

export function VendorExportButton({
  vendor,
  vendors,
  stats,
  variant = "single",
  fullWidth = false,
}: VendorExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "pdf" | "excel") => {
    setIsExporting(true);
    try {
      if (variant === "single" && vendor) {
        if (format === "pdf") {
          exportSingleVendorToPDF(vendor, stats);
        } else {
          exportSingleVendorToExcel(vendor, stats);
        }
        toast.success(`Vendor exported to ${format.toUpperCase()}`);
      } else if (variant === "bulk" && vendors && vendors.length > 0) {
        if (format === "pdf") {
          exportVendorsToPDF(vendors);
        } else {
          exportVendorsToExcel(vendors);
        }
        toast.success(`${vendors.length} vendors exported to ${format.toUpperCase()}`);
      } else {
        toast.error("No vendors to export");
      }
    } catch (error: any) {
      toast.error(`Failed to export: ${error.message || "Unknown error"}`);
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting} className={fullWidth ? "w-full" : ""}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="w-4 h-4 mr-2 text-destructive" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-success" />
          Export as Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
