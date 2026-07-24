import { DashboardLayout } from "@/components/layout";
import {
  Building2,
  Ticket,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  CircleAlert,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVendors } from "@/hooks/useVendors";
import { useIssues } from "@/hooks/useIssues";
import { useAuth } from "@/contexts/AuthContext";
import { MOUActivityWidget } from "@/components/dashboard/MOUActivityWidget";
import { EmployeeVendorWidget } from "@/components/dashboard/EmployeeVendorWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useSafiScore } from "@/hooks/useSafiScore";
import { VendorCategoryPieChart } from "@/components/dashboard/charts/VendorCategoryPieChart";
import { IssuesByPriorityChart } from "@/components/dashboard/charts/IssuesByPriorityChart";
import { IssueStatusDonutChart } from "@/components/dashboard/charts/IssueStatusDonutChart";
import { VendorOnboardingTrendChart } from "@/components/dashboard/charts/VendorOnboardingTrendChart";
import { Progress } from "@/components/ui/progress";
import { useMOUVault } from "@/hooks/useMOUVault";

const priorityColors: Record<string, string> = {
  low: "bg-priority-low/10 text-priority-low border-priority-low/20",
  medium: "bg-priority-medium/10 text-priority-medium border-priority-medium/20",
  high: "bg-priority-high/10 text-priority-high border-priority-high/20",
  critical: "bg-priority-critical/10 text-priority-critical border-priority-critical/20",
};

const statusColors: Record<string, string> = {
  open: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  const { user, profile, hasPermission } = useAuth();
  const { data: vendors, isLoading: vendorsLoading } = useVendors();
  const { data: issues, isLoading: issuesLoading } = useIssues();
  const { data: safiScores, isLoading: safiLoading } = useSafiScore();
  const { data: vaultItems = [] } = useMOUVault();
  const navigate = useNavigate();

  const isLoading = vendorsLoading || issuesLoading || safiLoading;

  // Calculate stats from real data
  const stats = [
    {
      title: "Total Vendors",
      value: vendors?.length || 0,
      change: vendors?.filter((v) => {
        const created = new Date(v.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      })?.length || 0,
      changeType: "positive" as const,
      icon: Building2,
      description: "Active vendors",
    },
    {
      title: "Open Issues",
      value: issues?.filter((i) => i.status === "open" || i.status === "in_progress").length || 0,
      change: issues?.filter((i) => {
        const created = new Date(i.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo && (i.status === "open" || i.status === "in_progress");
      })?.length || 0,
      changeType: "negative" as const,
      icon: Ticket,
      description: "Pending resolution",
    },
    {
      title: "Critical Issues",
      value: issues?.filter((i) => i.priority === "critical" && i.status !== "closed" && i.status !== "resolved").length || 0,
      change: issues?.filter((i) => {
        const created = new Date(i.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo && i.priority === "critical";
      })?.length || 0,
      changeType: "negative" as const,
      icon: AlertCircle,
      description: "Needs attention",
    },
    {
      title: "Resolved Today",
      value: issues?.filter((i) => {
        if (!i.resolved_at) return false;
        const resolved = new Date(i.resolved_at);
        const today = new Date();
        return resolved.toDateString() === today.toDateString();
      })?.length || 0,
      change: "+",
      changeType: "positive" as const,
      icon: CheckCircle2,
      description: "Issues closed",
    },
  ];

  // Get recent issues
  const recentIssues = issues?.slice(0, 5) || [];

  // Get top vendors by SAFI Score
  const topVendors = safiScores
    ?.filter((v) => v.status === "active")
    ?.slice(0, 4) || [];

  const unresolvedIssues = issues?.filter((issue) => issue.status === "open" || issue.status === "in_progress") || [];
  const resolvedIssues = issues?.filter((issue) => issue.status === "resolved" || issue.status === "closed") || [];
  const overdueIssues = unresolvedIssues.filter((issue) => issue.due_date && new Date(issue.due_date) < new Date());
  const resolutionRate = issues?.length ? Math.round((resolvedIssues.length / issues.length) * 100) : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeVaultMOUs = vaultItems.filter((item) =>
    item.extraction_status === "completed" &&
    (!item.effective_start_date || new Date(item.effective_start_date) <= today) &&
    (!item.effective_end_date || new Date(item.effective_end_date) >= today)
  ).length;

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle={`Welcome back, ${profile?.full_name || (user?.email === "highypestudio@gmail.com" ? "Administrator" : (user?.email?.split("@")[0] || "User"))}`}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.title}
              className="relative overflow-hidden animate-stagger-fade-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <CardContent className="p-6">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold mt-2 text-foreground">
                        {stat.value}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {stat.changeType === "positive" ? (
                          <ArrowUpRight className="w-4 h-4 text-success" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                        )}
                        <span
                          className={
                            stat.changeType === "positive"
                              ? "text-success text-sm"
                              : "text-destructive text-sm"
                          }
                        >
                          {typeof stat.change === "number" ? `+${stat.change}` : stat.change}
                        </span>
                        <span className="text-muted-foreground text-sm">this week</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center transition-transform duration-300 hover:scale-110">
                      <stat.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Issue resolution rate</p>
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <p className="text-3xl font-bold">{resolutionRate}%</p>
              <Progress value={resolutionRate} aria-label="Issue resolution rate" />
              <p className="text-xs text-muted-foreground">{resolvedIssues.length} of {issues?.length || 0} issues resolved or closed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Overdue issue workload</p>
                <CircleAlert className="w-5 h-5 text-warning" />
              </div>
              <p className="text-3xl font-bold">{overdueIssues.length}</p>
              <p className="text-xs text-muted-foreground">{unresolvedIssues.length} issues currently open or in progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Active MOU agreements</p>
                <FileCheck2 className="w-5 h-5 text-info" />
              </div>
              <p className="text-3xl font-bold">{activeVaultMOUs}</p>
              <p className="text-xs text-muted-foreground">Validated agreements from the MOU Vault</p>
            </CardContent>
          </Card>
        </div>

        {/* MOU Activity Widget */}
        {hasPermission("mous.view") && <MOUActivityWidget />}

        {/* Employee Vendor Widget */}
        {hasPermission("users.manage") && <EmployeeVendorWidget />}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Issues */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Recent Issues</CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {issues?.length || 0} total
                </Badge>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : recentIssues.length > 0 ? (
                  <div className="space-y-3">
                    {recentIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate("/issues")}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {issue.title}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {issue.vendor?.name || "No vendor"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={priorityColors[issue.priority]}>
                            {issue.priority}
                          </Badge>
                          <Badge className={statusColors[issue.status]}>
                            {issue.status.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground w-20 text-right">
                            {formatDistanceToNow(new Date(issue.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No issues yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Vendors */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Top Vendors</CardTitle>
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : topVendors.length > 0 ? (
                <div className="space-y-4">
                  {topVendors.map((vendor, index) => (
                    <div
                      key={vendor.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate("/vendors")}
                    >
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {vendor.vendorName}
                        </p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {vendor.category}
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-primary">
                            {vendor.score}
                          </span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SAFI Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No vendors yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hasPermission("vendors.manage") && (
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate("/vendors")}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Add New Vendor</p>
                  <p className="text-sm text-muted-foreground">Onboard a new vendor</p>
                </div>
              </CardContent>
            </Card>
          )}

          {hasPermission("issues.create") && (
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate("/issues")}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Ticket className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Create Issue</p>
                  <p className="text-sm text-muted-foreground">Log a new ticket</p>
                </div>
              </CardContent>
            </Card>
          )}

          {hasPermission("mous.manage") && (
            <Card
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate("/mous")}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Manage MOUs</p>
                  <p className="text-sm text-muted-foreground">View all agreements</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Analytics Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
          </div>

          {/* Large Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Issues by Priority</CardTitle>
              </CardHeader>
              <CardContent>
                {issuesLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : (
                  <IssuesByPriorityChart issues={issues || []} isLoading={issuesLoading} />
                )}
              </CardContent>
            </Card>

            <Card className="animate-fade-in" style={{ animationDelay: '80ms' }}>
              <CardHeader>
                <CardTitle>Vendor Onboarding Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorsLoading ? (
                  <Skeleton className="h-[350px] w-full" />
                ) : (
                  <VendorOnboardingTrendChart vendors={vendors || []} isLoading={vendorsLoading} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Small Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="animate-fade-in" style={{ animationDelay: '160ms' }}>
              <CardHeader>
                <CardTitle>Vendor Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <VendorCategoryPieChart vendors={vendors || []} isLoading={vendorsLoading} />
                )}
              </CardContent>
            </Card>

            <Card className="animate-fade-in" style={{ animationDelay: '240ms' }}>
              <CardHeader>
                <CardTitle>Issue Status</CardTitle>
              </CardHeader>
              <CardContent>
                {issuesLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <IssueStatusDonutChart issues={issues || []} isLoading={issuesLoading} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
