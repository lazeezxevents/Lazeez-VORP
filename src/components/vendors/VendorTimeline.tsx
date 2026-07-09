import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, Ticket, Users, Settings, Clock,
  Plus, Edit, Trash2, CheckCircle, AlertCircle
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuditLogs, AuditLog } from "@/hooks/useAuditLogs";

interface VendorTimelineProps {
  vendorId: string;
}

const actionIcons: Record<string, React.ElementType> = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  status_changed: Settings,
  assigned: Users,
};

const actionColors: Record<string, string> = {
  created: "bg-success/10 text-success border-success/20",
  updated: "bg-info/10 text-info border-info/20",
  deleted: "bg-destructive/10 text-destructive border-destructive/20",
  status_changed: "bg-warning/10 text-warning border-warning/20",
  assigned: "bg-primary/10 text-primary border-primary/20",
};

const entityIcons: Record<string, React.ElementType> = {
  vendor: Settings,
  mou: FileText,
  issue: Ticket,
};

function getChangeDescription(log: AuditLog): string {
  const action = log.action;
  const entityType = log.entity_type;
  
  if (action === "created") {
    return `New ${entityType} created`;
  }
  
  if (action === "updated" && log.old_values && log.new_values) {
    // Detect status change
    const oldStatus = log.old_values.status;
    const newStatus = log.new_values.status;
    if (oldStatus !== newStatus) {
      return `Status changed from "${oldStatus}" to "${newStatus}"`;
    }
    
    // Detect title change
    const oldTitle = log.old_values.title || log.old_values.name;
    const newTitle = log.new_values.title || log.new_values.name;
    if (oldTitle !== newTitle) {
      return `Updated: "${newTitle}"`;
    }
    
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} updated`;
  }
  
  if (action === "deleted") {
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted`;
  }
  
  return `${action.charAt(0).toUpperCase() + action.slice(1).replace("_", " ")}`;
}

export function VendorTimeline({ vendorId }: VendorTimelineProps) {
  const { data: logs, isLoading } = useAuditLogs({ 
    entityType: "vendor", 
    entityId: vendorId,
    limit: 50 
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>No activity recorded yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
        
        <div className="space-y-6">
          {logs.map((log, index) => {
            const ActionIcon = actionIcons[log.action] || Edit;
            const EntityIcon = entityIcons[log.entity_type] || Settings;
            
            return (
              <div key={log.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className={cn(
                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2",
                  actionColors[log.action] || "bg-muted border-border"
                )}>
                  <ActionIcon className="w-4 h-4" />
                </div>
                
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {getChangeDescription(log)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <EntityIcon className="w-3 h-3 mr-1" />
                          {log.entity_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  
                  {/* Show changed values for updates */}
                  {log.action === "updated" && log.old_values && log.new_values && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                      <div className="flex items-center gap-1">
                        <span className="text-destructive line-through">
                          {String((log.old_values as Record<string, unknown>).status || (log.old_values as Record<string, unknown>).title || "Previous")}
                        </span>
                        <span>→</span>
                        <span className="text-success">
                          {String((log.new_values as Record<string, unknown>).status || (log.new_values as Record<string, unknown>).title || "Updated")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
