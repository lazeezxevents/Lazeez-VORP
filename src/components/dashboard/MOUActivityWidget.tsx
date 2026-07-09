import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays, addDays } from "date-fns";
import { FileText, Clock, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface MOUWithVendor {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  vendor: { name: string } | null;
}

interface MOUVersion {
  id: string;
  mou_id: string;
  version_number: number;
  change_type: string;
  change_summary: string | null;
  created_at: string;
  status: string;
  title: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  signed: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
  terminated: "bg-destructive/10 text-destructive",
};

export function MOUActivityWidget() {
  const navigate = useNavigate();

  // Fetch MOUs with upcoming expirations
  const { data: mous, isLoading: mousLoading } = useQuery({
    queryKey: ["mous-expiring"],
    queryFn: async () => {
      const thirtyDaysFromNow = addDays(new Date(), 30).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("mous")
        .select(`*, vendor:vendors(name)`)
        .lte("end_date", thirtyDaysFromNow)
        .gte("end_date", new Date().toISOString().split("T")[0])
        .in("status", ["signed", "approved"])
        .order("end_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data as unknown as MOUWithVendor[];
    },
  });

  // Fetch recent MOU activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["mou-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mou_versions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as MOUVersion[];
    },
  });

  // Fetch MOU stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["mou-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mous")
        .select("status, end_date");

      if (error) throw error;

      const now = new Date();
      const thirtyDaysFromNow = addDays(now, 30);

      return {
        total: data?.length || 0,
        active: data?.filter((m) => m.status === "signed" || m.status === "approved")?.length || 0,
        expiringSoon: data?.filter((m) => {
          if (!m.end_date) return false;
          const endDate = new Date(m.end_date);
          return endDate >= now && endDate <= thirtyDaysFromNow;
        })?.length || 0,
        pendingReview: data?.filter((m) => m.status === "pending_review")?.length || 0,
      };
    },
  });

  const isLoading = mousLoading || activityLoading || statsLoading;

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
              onClick={() => navigate("/mous")}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {mous && mous.length > 0 ? (
                <div className="space-y-3">
                  {mous.map((mou) => {
                    const days = mou.end_date
                      ? getDaysUntilExpiry(mou.end_date)
                      : null;
                    return (
                      <div
                        key={mou.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg",
                          "bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        )}
                        onClick={() => navigate("/mous")}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {mou.title}
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
              {recentActivity && recentActivity.length > 0 ? (
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
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.change_summary || `Version ${activity.version_number}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                      <Badge className={statusColors[activity.status] || "bg-muted"}>
                        {activity.status.replace("_", " ")}
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
