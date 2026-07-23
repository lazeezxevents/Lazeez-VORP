import { useState } from "react";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Loader2, 
  AlertTriangle, 
  Edit2, 
  Save,
  X,
  Users,
  Building2,
  RefreshCw,
  Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MOUVaultItem, useUpdateVaultItem, useTerminateMOU } from "@/hooks/useMOUVault";
import { MOURenewalDialog } from "./MOURenewalDialog";

interface MOUExtractionStatusProps {
  item: MOUVaultItem;
  onClose?: () => void;
}

export function MOUExtractionStatus({ item, onClose }: MOUExtractionStatusProps) {
  const [editing, setEditing] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [formData, setFormData] = useState({
    signed_date: item.signed_date || "",
    effective_start_date: item.effective_start_date || "",
    effective_end_date: item.effective_end_date || "",
    termination_notice_days: item.termination_notice_days || 90,
  });

  const updateItem = useUpdateVaultItem();
  const terminateMOU = useTerminateMOU();

  const handleTerminate = async () => {
    await terminateMOU.mutateAsync({
      vaultId: item.id,
      vendorId: item.vendor_id,
    });
    setTerminateOpen(false);
  };

  const handleSave = async () => {
    await updateItem.mutateAsync({
      id: item.id,
      ...formData,
    });
    setEditing(false);
  };

  const extractedTerms = item.extracted_terms as Record<string, unknown> | null;
  const hasAutoRenewal = extractedTerms?.has_auto_renewal || item.has_auto_renewal;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {item.extraction_status === "completed" && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  Extraction Complete
                </>
              )}
              {item.extraction_status === "processing" && (
                <>
                  <Loader2 className="w-5 h-5 text-info animate-spin" />
                  Extracting...
                </>
              )}
              {item.extraction_status === "failed" && (
                <>
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Extraction Failed
                </>
              )}
              {item.extraction_status === "pending" && (
                <>
                  <Loader2 className="w-5 h-5 text-muted-foreground" />
                  Pending
                </>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {item.extraction_confidence !== null && item.extraction_confidence !== undefined && (
                <Badge variant="outline">
                  {Math.round(item.extraction_confidence)}% confidence
                </Badge>
              )}
              {item.extraction_status === "completed" && !editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
              {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {item.extraction_status === "processing" && (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p>AI is analyzing your document...</p>
              <p className="text-sm mt-1">This may take a minute</p>
            </div>
          )}

          {item.extraction_status === "completed" && (
            <div className="space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Signed Date</Label>
                      <Input
                        type="date"
                        value={formData.signed_date}
                        onChange={(e) => setFormData({ ...formData, signed_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Termination Notice (days)</Label>
                      <Input
                        type="number"
                        value={formData.termination_notice_days}
                        onChange={(e) => setFormData({ ...formData, termination_notice_days: parseInt(e.target.value) || 90 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Effective Start Date</Label>
                      <Input
                        type="date"
                        value={formData.effective_start_date}
                        onChange={(e) => setFormData({ ...formData, effective_start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Effective End Date</Label>
                      <Input
                        type="date"
                        value={formData.effective_end_date}
                        onChange={(e) => setFormData({ ...formData, effective_end_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={updateItem.isPending}>
                      {updateItem.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Key Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Signed Date</p>
                      <p className="font-medium">
                        {item.signed_date ? format(new Date(item.signed_date), "MMMM d, yyyy") : "Not extracted"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Termination Notice</p>
                      <p className="font-medium">{item.termination_notice_days} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Effective Start</p>
                      <p className="font-medium">
                        {item.effective_start_date ? format(new Date(item.effective_start_date), "MMMM d, yyyy") : "Not extracted"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Effective End</p>
                      <p className="font-medium">
                        {item.effective_end_date 
                          ? format(new Date(item.effective_end_date), "MMMM d, yyyy") 
                          : "Active (Ongoing)"}
                      </p>
                    </div>
                    {item.termination_deadline && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Termination Deadline</p>
                        <p className="font-medium text-warning">
                          {format(new Date(item.termination_deadline), "MMMM d, yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Parties Section */}
                  {(extractedTerms?.party_1_name || extractedTerms?.party_2_name) && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Parties Involved
                        </p>
                        <div className="space-y-3">
                          {extractedTerms.party_1_name && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">{String(extractedTerms.party_1_name)}</span>
                              </div>
                              {extractedTerms.party_1_business && (
                                <p className="text-xs text-muted-foreground ml-6">
                                  {String(extractedTerms.party_1_business)}
                                </p>
                              )}
                            </div>
                          )}
                          {extractedTerms.party_2_name && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">{String(extractedTerms.party_2_name)}</span>
                              </div>
                              {extractedTerms.party_2_business && (
                                <p className="text-xs text-muted-foreground ml-6">
                                  {String(extractedTerms.party_2_business)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* MOU Purpose */}
                  {extractedTerms?.mou_purpose && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          MOU Purpose
                        </p>
                        <p className="text-sm bg-muted/30 rounded-lg p-3">
                          {String(extractedTerms.mou_purpose)}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Auto-Renewal Status */}
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Renewal Status
                    </p>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto-Renewal Clause</span>
                        <Badge variant={hasAutoRenewal ? "default" : "outline"}>
                          {hasAutoRenewal ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {hasAutoRenewal && extractedTerms?.renewal_period_days && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Renewal Period</span>
                          <span className="text-sm font-medium">
                            {String(extractedTerms.renewal_period_days)} days
                          </span>
                        </div>
                      )}
                      {item.renewal_count !== undefined && item.renewal_count > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Times Renewed</span>
                          <span className="text-sm font-medium">{item.renewal_count}</span>
                        </div>
                      )}
                      {item.last_renewal_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Last Renewal</span>
                          <span className="text-sm font-medium">
                            {format(new Date(item.last_renewal_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setRenewalOpen(true)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Renew MOU
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setTerminateOpen(true)}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Terminate MOU
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Key Terms */}
                  {extractedTerms?.key_terms && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Key Terms</p>
                        <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                          {String(extractedTerms.key_terms)}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {item.extraction_status === "failed" && (
            <div className="text-center py-4 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-destructive" />
              <p>Failed to extract data from this document.</p>
              <p className="text-sm mt-1">You can retry or manually enter the information.</p>
              <Button variant="outline" className="mt-4" onClick={() => setEditing(true)}>
                Enter Manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate MOU?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the MOU effective end date to today and update the vendor status to <strong>Left</strong> in the Vendor Directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTerminate} className="bg-destructive text-destructive-foreground">
              Terminate & Mark Vendor Left
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MOURenewalDialog 
        item={item} 
        open={renewalOpen} 
        onOpenChange={setRenewalOpen} 
      />
    </>
  );
}
