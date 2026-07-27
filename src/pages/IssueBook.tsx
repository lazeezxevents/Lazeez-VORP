import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  Building2,
  User,
  BarChart3,
  Archive,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatDistanceToNow, format } from "date-fns";

// ---------------------------------------------------------------------------
// Types (match the SQL views)
// ---------------------------------------------------------------------------

interface IssueBookEntry {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string;
  resolution_hours: number | null;
  resolved_on_time: boolean | null;
  vendor_name: string | null;
  reporter_name: string | null;
  assignee_name: string | null;
  total_hours_logged: number;
  comment_count: number;
  attachment_count: number;
  watcher_count: number;
}

interface VendorIssueStat {
  vendor_name: string;
  total_issues: number;
  resolved_issues: number;
  open_issues: number;
  critical_issues: number;
  resolution_rate: number;
  avg_resolution_hours: number;
}

interface AssigneeIssueStat {
  full_name: string | null;
  email: string;
  total_assigned: number;
  total_resolved: number;
  currently_open: number;
  resolution_rate: number;
  avg_resolution_hours: number;
  total_hours_logged: number;
}

interface WeeklyAnalytics {
  week: string;
  total_created: number;
  resolved: number;
  avg_resolution_hours: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IssueBook() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["issue-book"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_book")
        .select("*")
        .order("resolved_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IssueBookEntry[];
    },
  });

  const { data: vendorStats = [], isLoading: vendorStatsLoading } = useQuery({
    queryKey: ["vendor-issue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_issue_stats")
        .select("*")
        .order("total_issues", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as VendorIssueStat[];
    },
  });

  const { data: assigneeStats = [], isLoading: assigneeStatsLoading } = useQuery({
    queryKey: ["assignee-issue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignee_issue_stats")
        .select("*")
        .order("total_resolved", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AssigneeIssueStat[];
    },
  });

  const { data: weeklyData = [], isLoading: weeklyLoading } = useQuery({
    queryKey: ["issue-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issue_analytics")
        .select("*")
        .order("week", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as WeeklyAnalytics[];
    },
  });

  const filtered = entries.filter((e) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const avgResolutionHours = entries.length
    ? entries.reduce((sum, e) => sum + (e.resolution_hours ?? 0), 0) / entries.length
    : 0;

  const onTimeRate = entries.length
    ? (entries.filter((e) => e.resolved_on_time === true).length / entries.length) * 100
    : 0;

  const totalHoursLogged = entries.reduce((sum, e) => sum + e.total_hours_logged, 0);

  const isLoading = entriesLoading || vendorStatsLoading || assigneeStatsLoading || weeklyLoading;

  const COLORS = ["#ED004F", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

  const priorityData = [
    { name: "Critical", value: entries.filter((e) => e.priority === "critical").length },
    { name: "High", value: entries.filter((e) => e.priority === "high").length },
    { name: "Medium", value: entries.filter((e) => e.priority === "medium").length },
    { name: "Low", value: entries.filter((e) => e.priority === "low").length },
  ].filter((d) => d.value > 0);

  return (
    <DashboardLayout
      title="Issue Book"
      subtitle="Archive of resolved and closed issues with performance analytics"
    >
      <div className="space-y-6 animate-fade-in">
        {/* Hero card */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Archive className="h-5 w-5" />
                  <span className="text-sm font-semibold">Issue Archive & Analytics</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {entries.length} archived issues
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Historical performance data for vendor assessment and employee evaluation.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase">Avg Resolution Time</p>
                <Clock className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold">{avgResolutionHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Across {entries.length} issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase">On-Time Resolution</p>
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold">{onTimeRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Met SLA targets</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Hours Logged</p>
                <BarChart3 className="w-4 h-4 text-info" />
              </div>
              <p className="text-2xl font-bold">{totalHoursLogged.toFixed(0)}h</p>
              <p className="text-xs text-muted-foreground">Time tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase">Active Vendors</p>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{vendorStats.length}</p>
              <p className="text-xs text-muted-foreground">With resolved issues</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue Resolution Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[...weeklyData].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                      labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line type="monotone" dataKey="total_created" stroke="#ED004F" strokeWidth={2} name="Created" />
                    <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={priorityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      labelStyle={{ fontSize: "12px" }}
                    >
                      {priorityData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vendor & Employee stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Top Vendors by Issue Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vendorStatsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : vendorStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No vendor data yet.</p>
              ) : (
                <div className="space-y-3">
                  {vendorStats.slice(0, 5).map((v, idx) => (
                    <div
                      key={v.vendor_name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{v.vendor_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.total_issues} issues · {v.resolution_rate}% resolved
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{(v.avg_resolution_hours ?? 0).toFixed(1)}h avg</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Top Performers by Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assigneeStatsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : assigneeStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No assignee data yet.</p>
              ) : (
                <div className="space-y-3">
                  {assigneeStats.slice(0, 5).map((a, idx) => (
                    <div
                      key={a.email}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{a.full_name || a.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.total_resolved}/{a.total_assigned} resolved · {(a.total_hours_logged ?? 0).toFixed(0)}h logged
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1">
                        {(a.resolution_rate ?? 0) >= 80 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {(a.resolution_rate ?? 0).toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Archived issues table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Archived Issues ({filtered.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No archived issues found.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        {entry.vendor_name && <span>Vendor: {entry.vendor_name}</span>}
                        {entry.assignee_name && <span>· Assignee: {entry.assignee_name}</span>}
                        <span>· Resolved {formatDistanceToNow(new Date(entry.resolved_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.resolution_hours && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {entry.resolution_hours.toFixed(1)}h
                        </Badge>
                      )}
                      {entry.resolved_on_time !== null && (
                        <Badge variant={entry.resolved_on_time ? "default" : "destructive"} className="gap-1">
                          {entry.resolved_on_time ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {entry.resolved_on_time ? "On time" : "Overdue"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
