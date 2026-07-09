import { format } from "date-fns";
import { 
  History, 
  RefreshCw, 
  FileEdit, 
  XCircle,
  FileText,
  Download,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMOUVaultRevisions, MOUVaultRevision } from "@/hooks/useMOUVault";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MOURevisionHistoryProps {
  vaultId: string;
}

export function MOURevisionHistory({ vaultId }: MOURevisionHistoryProps) {
  const { data: revisions, isLoading } = useMOUVaultRevisions(vaultId);

  const getRevisionIcon = (type: string) => {
    switch (type) {
      case "renewal":
        return <RefreshCw className="w-4 h-4" />;
      case "amendment":
        return <FileEdit className="w-4 h-4" />;
      case "termination":
        return <XCircle className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getRevisionColor = (type: string) => {
    switch (type) {
      case "renewal":
        return "bg-success/10 text-success";
      case "amendment":
        return "bg-info/10 text-info";
      case "termination":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleDownloadDocument = async (documentUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("mou-vault")
        .createSignedUrl(documentUrl, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          Revision History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {revisions && revisions.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <div className="relative pl-6 space-y-4">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
              
              {revisions.map((revision, index) => (
                <div key={revision.id} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className={`absolute left-[-15px] w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${getRevisionColor(revision.revision_type)}`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  
                  <div className="flex-1 bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getRevisionIcon(revision.revision_type)}
                        <Badge variant="outline" className={getRevisionColor(revision.revision_type)}>
                          {revision.revision_type.charAt(0).toUpperCase() + revision.revision_type.slice(1)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(revision.revision_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    
                    {revision.notes && (
                      <p className="text-sm text-muted-foreground mb-2">{revision.notes}</p>
                    )}
                    
                    {revision.document_url && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-xs"
                        onClick={() => handleDownloadDocument(revision.document_url!)}
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        View Document
                      </Button>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(revision.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No revisions recorded yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
