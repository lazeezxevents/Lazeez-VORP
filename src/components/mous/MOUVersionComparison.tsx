import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ArrowRight, FileText, CheckCircle, Calendar, Diff, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { generateVersionComparisonPDF } from "@/utils/pdfVersionComparison";

interface MOUVersion {
  id: string;
  mou_id: string;
  version_number: number;
  title: string;
  status: string;
  terms: string | null;
  start_date: string | null;
  end_date: string | null;
  document_url: string | null;
  change_type: string;
  change_summary: string | null;
  created_at: string;
  changed_by: string | null;
}

interface MOUVersionComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mouId: string;
  mouTitle: string;
}

export function MOUVersionComparison({
  open,
  onOpenChange,
  mouId,
  mouTitle,
}: MOUVersionComparisonProps) {
  const [versions, setVersions] = useState<MOUVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [leftVersion, setLeftVersion] = useState<string>("");
  const [rightVersion, setRightVersion] = useState<string>("");

  useEffect(() => {
    if (open && mouId) {
      fetchVersions();
    }
  }, [open, mouId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("mou_versions")
        .select("*")
        .eq("mou_id", mouId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data || []);

      // Pre-select the two most recent versions
      if (data && data.length >= 2) {
        setRightVersion(data[0].id);
        setLeftVersion(data[1].id);
      } else if (data && data.length === 1) {
        setRightVersion(data[0].id);
        setLeftVersion(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const left = versions.find((v) => v.id === leftVersion);
  const right = versions.find((v) => v.id === rightVersion);

  const hasChange = (field: keyof MOUVersion) => {
    if (!left || !right) return false;
    return left[field] !== right[field];
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending_review: "bg-warning/10 text-warning",
    approved: "bg-info/10 text-info",
    signed: "bg-success/10 text-success",
    expired: "bg-destructive/10 text-destructive",
    terminated: "bg-destructive/10 text-destructive",
  };

  const handleExportPDF = () => {
    if (left && right) {
      generateVersionComparisonPDF(mouTitle, left, right);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Diff className="w-5 h-5" />
              Compare Versions: {mouTitle}
            </DialogTitle>
            {left && right && versions.length >= 2 && (
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-[300px]" />
              <Skeleton className="h-[300px]" />
            </div>
          </div>
        ) : versions.length < 2 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Not enough versions to compare</p>
            <p className="text-sm mt-2">
              At least 2 versions are needed for comparison
            </p>
          </div>
        ) : (
          <>
            {/* Version Selectors */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Earlier Version
                </label>
                <Select value={leftVersion} onValueChange={setLeftVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        Version {v.version_number} -{" "}
                        {format(new Date(v.created_at), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="w-5 h-5 text-muted-foreground mt-6" />

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">
                  Later Version
                </label>
                <Select value={rightVersion} onValueChange={setRightVersion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        Version {v.version_number} -{" "}
                        {format(new Date(v.created_at), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              {left && right && (
                <div className="space-y-6">
                  {/* Status Comparison */}
                  <ComparisonRow
                    label="Status"
                    icon={<CheckCircle className="w-4 h-4" />}
                    changed={hasChange("status")}
                    left={
                      <Badge className={statusColors[left.status] || "bg-muted"}>
                        {left.status.replace("_", " ")}
                      </Badge>
                    }
                    right={
                      <Badge className={statusColors[right.status] || "bg-muted"}>
                        {right.status.replace("_", " ")}
                      </Badge>
                    }
                  />

                  {/* Title Comparison */}
                  <ComparisonRow
                    label="Title"
                    icon={<FileText className="w-4 h-4" />}
                    changed={hasChange("title")}
                    left={<span className="font-medium">{left.title}</span>}
                    right={<span className="font-medium">{right.title}</span>}
                  />

                  {/* Date Range Comparison */}
                  <ComparisonRow
                    label="Duration"
                    icon={<Calendar className="w-4 h-4" />}
                    changed={hasChange("start_date") || hasChange("end_date")}
                    left={
                      <span>
                        {left.start_date
                          ? format(new Date(left.start_date), "MMM d, yyyy")
                          : "Not set"}{" "}
                        -{" "}
                        {left.end_date
                          ? format(new Date(left.end_date), "MMM d, yyyy")
                          : "Not set"}
                      </span>
                    }
                    right={
                      <span>
                        {right.start_date
                          ? format(new Date(right.start_date), "MMM d, yyyy")
                          : "Not set"}{" "}
                        -{" "}
                        {right.end_date
                          ? format(new Date(right.end_date), "MMM d, yyyy")
                          : "Not set"}
                      </span>
                    }
                  />

                  {/* Terms Comparison */}
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      hasChange("terms")
                        ? "border-warning bg-warning/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Terms & Conditions</span>
                      {hasChange("terms") && (
                        <Badge
                          variant="outline"
                          className="text-warning border-warning"
                        >
                          Changed
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">
                          Version {left.version_number}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {left.terms || (
                            <span className="text-muted-foreground italic">
                              No terms specified
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">
                          Version {right.version_number}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">
                          {right.terms || (
                            <span className="text-muted-foreground italic">
                              No terms specified
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document URL Comparison */}
                  <ComparisonRow
                    label="Document"
                    icon={<FileText className="w-4 h-4" />}
                    changed={hasChange("document_url")}
                    left={
                      left.document_url ? (
                        <Badge variant="outline" className="text-success border-success">
                          Attached
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No document</span>
                      )
                    }
                    right={
                      right.document_url ? (
                        <Badge variant="outline" className="text-success border-success">
                          Attached
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">No document</span>
                      )
                    }
                  />
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ComparisonRowProps {
  label: string;
  icon: React.ReactNode;
  changed: boolean;
  left: React.ReactNode;
  right: React.ReactNode;
}

function ComparisonRow({
  label,
  icon,
  changed,
  left,
  right,
}: ComparisonRowProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        changed ? "border-warning bg-warning/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium">{label}</span>
        {changed && (
          <Badge variant="outline" className="text-warning border-warning">
            Changed
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-2 bg-muted/50 rounded">{left}</div>
        <div className="p-2 bg-muted/50 rounded">{right}</div>
      </div>
    </div>
  );
}
