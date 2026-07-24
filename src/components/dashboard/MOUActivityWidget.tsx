import { useMemo } from "react";
import { format, differenceInDays, addDays, startOfDay } from "date-fns";
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useMOUVault, type MOUVaultItem } from "@/hooks/useMOUVault";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning",
  processing: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  signed: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
  terminated: "bg-destructive/10 text-destructive",
};

export function MOUActivityWidget() {
  const navigate = useNavigate();
  const { data: vaultItems = [], isLoading, isError, error } = useMOUVault();

  const { stats, expiringItems, recentActivity } = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysFromNow = addDays(today, 30);
    const isActive = (item: MOUVaultItem) =>
      item.extraction_status === "completed" &&
      (!item.effective_start_date || new Date(item.effective_start_date) <= today) &&
      (!item.effective_end_date || new Date(item.effective_end_date) >= today);
    const activeItems = vaultItems.filter(isActive);
    const expiring = activeItems
      .filter((item) => item.effective_end_date && new Date(item.effective_end_date) <= thirtyDaysFromNow)
      .sort((a, b) => new Date(a.effective_end_date!).getTime() - new Date(b.effective_end_date!).getTime());

    return {
      stats: {
        total: vaultItems.length,
        active: activeItems.length,
        expiringSoon: expiring.length,
        pendingReview: vaultItems.filter((item) =>
          item.extraction_status === "pending" || item.extraction_status === "processing"
        ).length,
      },
      expiringItems: expiring.slice(0, 5),
      recentActivity: [...vaultItems]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5),
    };
  }, [vaultItems]);

  const getDaysUntilExpiry = (endDate: string) => {
    const days = differenceInDays(new Date(endDate), new Date());
    return days;
  };

  const getExpiryBadge = (days: number) => {
    if (days <= 7) {
      return (
        <Badge className="bg-destructive/10 text-destructive">
          {days} days left
        </Badge>
      );
    } else if (days <= 14) {
      return (
        <Badge className="bg-warning/10 text-warning">{days} days left</Badge>
      );
    } else {
      return (
        <Badge className="bg-info/10 text-info">{days} days left</Badge>
      );
    }
  };

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader><CardTitle>MOU Vault data could not load</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check your access to the MOU Vault."}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* MOU Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
              <p className="text-xs text-muted-foreground">Total MOUs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.active || 0}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.expiringSoon || 0}</p>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.pendingReview || 0}</p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Expirations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Upcoming Expirations
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => navigate("/mou-vault")}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {expiringItems.length > 0 ? (
                <div className="space-y-3">
                  {expiringItems.map((mou) => {
                    const days = mou.effective_end_date
                      ? getDaysUntilExpiry(mou.effective_end_date)
                      : null;
                    return (
                      <div
                        key={mou.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg",
                          "bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        )}
                        onClick={() => navigate("/mou-vault")}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {mou.document_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {mou.vendor?.name || "No vendor"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {days !== null && getExpiryBadge(days)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No MOUs expiring soon</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-info" />
              Recent MOU Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">
                          {activity.document_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.extraction_status === "completed"
                            ? "Document extraction completed"
                            : `Extraction ${activity.extraction_status}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(activity.updated_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <Badge className={statusColors[activity.extraction_status] || "bg-muted"}>
                        {activity.extraction_status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
