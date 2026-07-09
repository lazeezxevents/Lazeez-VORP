import { useState, useEffect } from "react";
import { format } from "date-fns";
import { History, FileText, CheckCircle, PenLine, Upload, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface MOUVersion {
  id: string;
  mou_id: string;
  version_number: number;
  title: string;
  status: string;
  change_type: string;
  change_summary: string;
  created_at: string;
  changed_by: string | null;
}

interface MOUVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mouId: string;
  mouTitle: string;
}

const changeTypeIcons: Record<string, typeof History> = {
  created: FileText,
  status_change: CheckCircle,
  terms_updated: PenLine,
  document_updated: Upload,
  updated: PenLine,
};

const changeTypeColors: Record<string, string> = {
  created: "bg-success/10 text-success",
  status_change: "bg-info/10 text-info",
  terms_updated: "bg-warning/10 text-warning",
  document_updated: "bg-primary/10 text-primary",
  updated: "bg-muted text-muted-foreground",
};

export function MOUVersionHistory({ open, onOpenChange, mouId, mouTitle }: MOUVersionHistoryProps) {
  const [versions, setVersions] = useState<MOUVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

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

      // Fetch profiles for changed_by users
      const userIds = [...new Set(data?.map(v => v.changed_by).filter(Boolean) as string[])];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profileMap: Record<string, string> = {};
        profilesData?.forEach(p => {
          profileMap[p.id] = p.full_name || p.email;
        });
        setProfiles(profileMap);
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History: {mouTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No version history available</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-6">
                {versions.map((version, index) => {
                  const Icon = changeTypeIcons[version.change_type] || PenLine;
                  const colorClass = changeTypeColors[version.change_type] || changeTypeColors.updated;

                  return (
                    <div key={version.id} className="relative flex gap-4 pl-2">
                      {/* Timeline dot */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">
                              Version {version.version_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {version.change_summary}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {version.status.replace("_", " ")}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{format(new Date(version.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                          {version.changed_by && profiles[version.changed_by] && (
                            <>
                              <span>•</span>
                              <span>by {profiles[version.changed_by]}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
