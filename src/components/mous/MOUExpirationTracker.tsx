import { useMemo } from "react";
import { format, differenceInDays, isPast, addDays } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MOUVaultItem } from "@/hooks/useMOUVault";
import { Link } from "react-router-dom";

interface MOUExpirationTrackerProps {
  items: MOUVaultItem[];
}

interface GroupedItem {
  item: MOUVaultItem;
  daysUntilExpiry: number;
  daysUntilTermination: number | null;
  status: "expired" | "critical" | "warning" | "active";
}

export function MOUExpirationTracker({ items }: MOUExpirationTrackerProps) {
  const groupedItems = useMemo(() => {
    const withDates = items
      .filter((item) => item.effective_end_date)
      .map((item) => {
        const endDate = new Date(item.effective_end_date!);
        const daysUntilExpiry = differenceInDays(endDate, new Date());
        
        let daysUntilTermination: number | null = null;
        if (item.termination_deadline) {
          daysUntilTermination = differenceInDays(new Date(item.termination_deadline), new Date());
        }

        let status: "expired" | "critical" | "warning" | "active" = "active";
        if (isPast(endDate)) {
          status = "expired";
        } else if (daysUntilExpiry <= 30) {
          status = "critical";
        } else if (daysUntilExpiry <= 90) {
          status = "warning";
        }

        return { item, daysUntilExpiry, daysUntilTermination, status };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return {
      expired: withDates.filter((i) => i.status === "expired"),
      critical: withDates.filter((i) => i.status === "critical"),
      warning: withDates.filter((i) => i.status === "warning"),
      active: withDates.filter((i) => i.status === "active"),
    };
  }, [items]);

  const stats = {
    total: items.length,
    expired: groupedItems.expired.length,
    critical: groupedItems.critical.length,
    warning: groupedItems.warning.length,
    active: groupedItems.active.length,
  };

  const TimelineItem = ({ data }: { data: GroupedItem }) => {
    const { item, daysUntilExpiry, daysUntilTermination, status } = data;
    
    const getProgressColor = () => {
      switch (status) {
        case "expired": return "bg-destructive";
        case "critical": return "bg-destructive";
        case "warning": return "bg-warning";
        default: return "bg-success";
      }
    };

    const getProgressValue = () => {
      if (status === "expired") return 100;
      if (!item.effective_start_date || !item.effective_end_date) return 0;
      
      const start = new Date(item.effective_start_date);
      const end = new Date(item.effective_end_date);
      const total = differenceInDays(end, start);
      const elapsed = differenceInDays(new Date(), start);
      
      return Math.min(100, Math.max(0, (elapsed / total) * 100));
    };

    return (
      <div className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{item.document_name}</p>
            {item.vendor && (
              <Link 
                to={`/vendors/${item.vendor_id}`}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                {item.vendor.name}
              </Link>
            )}
          </div>
          <Badge 
            className={
              status === "expired" ? "bg-destructive/10 text-destructive" :
              status === "critical" ? "bg-destructive/10 text-destructive" :
              status === "warning" ? "bg-warning/10 text-warning" :
              "bg-success/10 text-success"
            }
          >
            {status === "expired" ? "Expired" : `${daysUntilExpiry}d`}
          </Badge>
        </div>
        
        <div className="mt-2">
          <Progress value={getProgressValue()} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {item.effective_start_date && format(new Date(item.effective_start_date), "MMM d, yyyy")}
          </span>
          <span>
            {item.effective_end_date && format(new Date(item.effective_end_date), "MMM d, yyyy")}
          </span>
        </div>

        {daysUntilTermination !== null && daysUntilTermination > 0 && daysUntilTermination <= 30 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-warning">
            <AlertTriangle className="w-3 h-3" />
            <span>Termination deadline in {daysUntilTermination} days</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Expired</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.expired}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Critical (30d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning">
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm font-medium">Warning (90d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.warning}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.active}</p>
          </CardContent>
        </Card>
      </div>

      {/* Expired MOUs */}
      {groupedItems.expired.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Expired MOUs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupedItems.expired.map((data) => (
              <TimelineItem key={data.item.id} data={data} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Critical MOUs */}
      {groupedItems.critical.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <Clock className="w-4 h-4" />
              Expiring Soon (within 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupedItems.critical.map((data) => (
              <TimelineItem key={data.item.id} data={data} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warning MOUs */}
      {groupedItems.warning.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-info" />
              Upcoming Expirations (30-90 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {groupedItems.warning.map((data) => (
              <TimelineItem key={data.item.id} data={data} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active MOUs (collapsed by default, just show count) */}
      {groupedItems.active.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-medium">{stats.active} MOUs with 90+ days remaining</span>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-3" />
            <p>No MOU documents with expiration dates</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
