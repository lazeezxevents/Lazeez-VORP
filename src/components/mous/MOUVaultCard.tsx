import { useState } from "react";
import { format, differenceInDays, isPast } from "date-fns";
import {
  FileText,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Building2,
  FileSearch
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MOUVaultItem, useDeleteVaultItem, useTriggerExtraction } from "@/hooks/useMOUVault";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface MOUVaultCardProps {
  item: MOUVaultItem;
  showVendor?: boolean;
  vendorStatus?: string;
  onViewDetails?: (item: MOUVaultItem) => void;
  onViewDocument?: (item: MOUVaultItem) => void;
}

export function MOUVaultCard({ item, showVendor = true, vendorStatus, onViewDetails, onViewDocument }: MOUVaultCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteItem = useDeleteVaultItem();
  const triggerExtraction = useTriggerExtraction();

  const extractedTerms = item.extracted_terms as Record<string, unknown> | null;
  const hasAutoRenewal = extractedTerms?.has_auto_renewal || item.has_auto_renewal;

  const getExpirationStatus = () => {
    if (!item.effective_end_date) return null;

    const endDate = new Date(item.effective_end_date);
    const daysUntilExpiry = differenceInDays(endDate, new Date());

    if (isPast(endDate)) {
      return { label: "Expired", color: "bg-destructive/10 text-destructive", urgent: true };
    }
    if (daysUntilExpiry <= 30) {
      return { label: `${daysUntilExpiry}d left`, color: "bg-warning/10 text-warning", urgent: true };
    }
    if (daysUntilExpiry <= 90) {
      return { label: `${daysUntilExpiry}d left`, color: "bg-info/10 text-info", urgent: false };
    }
    return { label: "Active", color: "bg-success/10 text-success", urgent: false };
  };

  const getTerminationStatus = () => {
    if (!item.termination_deadline) return null;

    const deadline = new Date(item.termination_deadline);
    const daysUntil = differenceInDays(deadline, new Date());

    if (isPast(deadline)) {
      return { label: "Deadline passed", color: "text-destructive" };
    }
    if (daysUntil <= 14) {
      return { label: `Terminate by ${format(deadline, "MMM d")}`, color: "text-warning" };
    }
    return null;
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("mou-vault")
        .createSignedUrl(item.document_url, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const handleRetryExtraction = async () => {
    await triggerExtraction.mutateAsync({
      vaultId: item.id,
      documentUrl: item.document_url,
    });
  };

  const handleDelete = async () => {
    await deleteItem.mutateAsync(item.id);
    setDeleteOpen(false);
  };

  const expirationStatus = getExpirationStatus();
  const terminationStatus = getTerminationStatus();

  return (
    <>
      <Card className="group hover:shadow-md transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {item.document_name}
                </p>
                {showVendor && item.vendor && (
                  <Link
                    to={`/vendors/${item.vendor_id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Building2 className="w-3 h-3" />
                    {item.vendor.name}
                  </Link>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {item.document_type === "new" ? "New" : "Legacy"}
                  </Badge>
                  {hasAutoRenewal && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Auto-Renewal
                    </Badge>
                  )}
                  {expirationStatus && (
                    <Badge className={expirationStatus.color}>
                      {expirationStatus.label}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDocument?.(item)}>
                  <FileSearch className="w-4 h-4 mr-2" />
                  View Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewDetails?.(item)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Extracted Data
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(item.extraction_status === "failed" || item.extraction_status === "processing") && (
                  <DropdownMenuItem onClick={handleRetryExtraction}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Extraction
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Extraction Status */}
          <div className="mt-3 pt-3 border-t border-border">
            {item.extraction_status === "pending" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Pending extraction</span>
              </div>
            )}
            {item.extraction_status === "processing" && (
              <div className="flex items-center justify-between text-xs text-info">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>System extracting data...</span>
                </div>
                {/* Show retry if stuck for >5 min */}
                {new Date().getTime() - new Date(item.updated_at).getTime() > 5 * 60 * 1000 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs text-warning"
                    onClick={handleRetryExtraction}
                  >
                    Stuck? Retry
                  </Button>
                )}
              </div>
            )}
            {item.extraction_status === "completed" && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Extraction complete</span>
                  {item.extraction_confidence && (
                    <span className="text-muted-foreground">
                      ({Math.round(item.extraction_confidence)}% confidence)
                    </span>
                  )}
                </div>
                {item.signed_date && (
                  <p className="text-xs text-muted-foreground">
                    Signed: {format(new Date(item.signed_date), "MMM d, yyyy")}
                  </p>
                )}
                {item.effective_start_date && item.effective_end_date && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(item.effective_start_date), "MMM d, yyyy")} → {format(new Date(item.effective_end_date), "MMM d, yyyy")}
                  </p>
                )}
                {terminationStatus && (
                  <div className={`flex items-center gap-1 text-xs ${terminationStatus.color}`}>
                    <AlertTriangle className="w-3 h-3" />
                    <span>{terminationStatus.label}</span>
                  </div>
                )}
              </div>
            )}
            {item.extraction_status === "failed" && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3" />
                <span>Extraction failed</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={handleRetryExtraction}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Uploaded {format(new Date(item.created_at), "MMM d, yyyy")}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{item.document_name}" from the vault? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
