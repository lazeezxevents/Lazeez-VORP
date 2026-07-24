import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  X, 
  Download, 
  ExternalLink, 
  Loader2, 
  FileText,
  Calendar,
  Clock,
  Users,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from "@/components/ui/resizable";
import { MOUVaultItem, useTriggerExtraction, useUpdateVaultItem } from "@/hooks/useMOUVault";
import { MOURenewalTimeline } from "./MOURenewalTimeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MOUDocumentViewerProps {
  item: MOUVaultItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorStatus?: string;
}

export function MOUDocumentViewer({ item, open, onOpenChange, vendorStatus }: MOUDocumentViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const triggerExtraction = useTriggerExtraction();
  const updateItem = useUpdateVaultItem();

  useEffect(() => {
    if (item && open) {
      loadSignedUrl();
    } else {
      setSignedUrl(null);
    }
  }, [item, open]);

  const loadSignedUrl = async () => {
    if (!item) return;
    
    setLoading(true);
    try {
      let resolvedUrl = item.document_url;

      // If it's already a full URL (https://...) use it directly
      if (!resolvedUrl.startsWith("http")) {
        // Bare storage path — construct public URL
        const { data, error } = await supabase.storage
          .from("mou-vault")
          .createSignedUrl(resolvedUrl, 60 * 60);
        if (error || !data?.signedUrl) throw error || new Error("Could not create document URL");
        resolvedUrl = data.signedUrl;
      }

      setSignedUrl(resolvedUrl);
    } catch (error) {
      console.error("Failed to load document:", error);
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, "_blank");
    }
  };

  const handleRetryExtraction = async () => {
    if (!item) return;
    await triggerExtraction.mutateAsync({
      vaultId: item.id,
      documentUrl: item.document_url,
    });
  };

  if (!item) return null;

  const extractedTerms = item.extracted_terms as Record<string, unknown> | null;
  const hasAutoRenewal = typeof item.has_auto_renewal === "boolean"
    ? item.has_auto_renewal
    : extractedTerms?.has_auto_renewal === true;
  const renewalPeriodDays = item.renewal_period_days || Number(extractedTerms?.renewal_period_days) || 365;

  const handleAutoRenewalChange = async (enabled: boolean) => {
    await updateItem.mutateAsync({
      id: item.id,
      has_auto_renewal: enabled,
      ...(enabled ? { renewal_period_days: renewalPeriodDays } : {}),
      extracted_terms: {
        ...(extractedTerms || {}),
        has_auto_renewal: enabled,
        ...(enabled ? { renewal_period_days: renewalPeriodDays } : {}),
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-6xl p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-lg truncate">{item.document_name}</h2>
                {item.vendor && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {item.vendor.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 pr-6">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!signedUrl}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {signedUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(signedUrl, "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Tab
                </Button>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <ResizablePanelGroup direction="horizontal">
              {/* PDF Viewer Panel */}
              <ResizablePanel defaultSize={65} minSize={40}>
                <div className="h-full bg-muted/30 flex items-center justify-center">
                  {loading ? (
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                      <p className="text-muted-foreground">Loading document...</p>
                    </div>
                  ) : signedUrl ? (
                    <iframe
                      src={`${signedUrl}#toolbar=1&navpanes=0`}
                      className="w-full h-full border-0"
                      title={item.document_name}
                    />
                  ) : (
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">Unable to load document</p>
                      <Button variant="outline" className="mt-3" onClick={loadSignedUrl}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Extracted Data Panel */}
              <ResizablePanel defaultSize={35} minSize={25}>
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-6">
                    {/* Extraction Status */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        AI Extraction
                        {item.extraction_status === "completed" && (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Complete
                          </Badge>
                        )}
                        {item.extraction_status === "processing" && (
                          <Badge variant="outline" className="bg-info/10 text-info">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {item.extraction_status === "failed" && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                        {item.extraction_status === "pending" && (
                          <Badge variant="outline">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </h3>

                      {item.extraction_confidence && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Confidence: {Math.round(item.extraction_confidence)}%
                        </p>
                      )}

                      {(item.extraction_status === "failed" || item.extraction_status === "pending") && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleRetryExtraction}
                          disabled={triggerExtraction.isPending}
                        >
                          {triggerExtraction.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          {item.extraction_status === "pending" ? "Start Extraction" : "Retry"}
                        </Button>
                      )}
                    </div>

                    <Separator />

                    {/* Key Dates */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Key Dates
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Signed Date</span>
                          <span className="font-medium">
                            {item.signed_date 
                              ? format(new Date(item.signed_date), "MMM d, yyyy") 
                              : "Not extracted"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Effective Start</span>
                          <span className="font-medium">
                            {item.effective_start_date 
                              ? format(new Date(item.effective_start_date), "MMM d, yyyy") 
                              : "Not extracted"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Effective End</span>
                          <span className="font-medium">
                            {item.effective_end_date 
                              ? format(new Date(item.effective_end_date), "MMM d, yyyy") 
                              : (vendorStatus === "left" || vendorStatus === "terminated" ? "Terminated" : "Active (Ongoing)")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Notice Period</span>
                          <span className="font-medium">{item.termination_notice_days} days</span>
                        </div>
                        {item.termination_deadline && (
                          <div className="flex justify-between text-warning">
                            <span>Termination Deadline</span>
                            <span className="font-medium">
                              {format(new Date(item.termination_deadline), "MMM d, yyyy")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Parties */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Parties
                      </h3>
                      {extractedTerms?.party_1_name || extractedTerms?.party_2_name ? (
                        <div className="space-y-3">
                          {extractedTerms.party_1_name && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="font-medium text-sm">{String(extractedTerms.party_1_name)}</p>
                              {extractedTerms.party_1_business && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {String(extractedTerms.party_1_business)}
                                </p>
                              )}
                            </div>
                          )}
                          {extractedTerms.party_2_name && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="font-medium text-sm">{String(extractedTerms.party_2_name)}</p>
                              {extractedTerms.party_2_business && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {String(extractedTerms.party_2_business)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : extractedTerms?.party_names ? (
                        <p className="text-sm bg-muted/30 rounded-lg p-3">
                          {String(extractedTerms.party_names)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not extracted</p>
                      )}
                    </div>

                    {/* Auto-Renewal */}
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          Renewal
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Auto-Renewal</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={hasAutoRenewal ? "default" : "outline"}>
                                {hasAutoRenewal ? "On" : "Off"}
                              </Badge>
                              <Switch
                                checked={hasAutoRenewal}
                                onCheckedChange={(enabled) => void handleAutoRenewalChange(enabled)}
                                disabled={updateItem.isPending}
                                aria-label={`Turn auto-renewal ${hasAutoRenewal ? "off" : "on"} for ${item.document_name}`}
                              />
                            </div>
                          </div>
                          {hasAutoRenewal && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Renewal Period</span>
                              <span className="font-medium">{renewalPeriodDays} days</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>

                    {/* MOU Purpose */}
                    {extractedTerms?.mou_purpose && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Purpose</h3>
                          <p className="text-sm bg-muted/30 rounded-lg p-3">
                            {String(extractedTerms.mou_purpose)}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Key Terms */}
                    {extractedTerms?.key_terms && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Key Terms</h3>
                          <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                            {String(extractedTerms.key_terms)}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Renewal Timeline */}
                    {item.effective_start_date && (
                      <>
                        <Separator />
                        <MOURenewalTimeline item={item} vendorStatus={vendorStatus} />
                      </>
                    )}

                    {/* Document Info */}
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Document Info</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type</span>
                          <Badge variant="outline">
                            {item.document_type === "new" ? "New" : "Legacy"}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Uploaded</span>
                          <span className="font-medium">
                            {format(new Date(item.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
