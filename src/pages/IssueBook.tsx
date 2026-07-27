import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIssueBookStats } from "@/hooks/useIssues";
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
  AlertCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Theme colors matching design system
// ---------------------------------------------------------------------------

const PRIORITY_COLORS = {
  critical: "hsl(var(--destructive))",
  high: "hsl(var(--warning))",
  medium: "hsl(var(--info))",
  low: "hsl(var(--success))",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IssueBook() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("vendors");

  const { data: stats, isLoading } = useIssueBookStats();

  const vendors = stats?.vendors || [];
  const assignees = stats?.assignees || [];

  const filteredVendors = vendors.filter((v) =>
    v.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssignees = assignees.filter((a) =>
    a.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Priority distribution for chart
  const priorityData = vendors.reduce(
    (acc, v) => {
      acc.critical += v.critical_count || 0;
      acc.high += v.high_count || 0;
      acc.medium += v.medium_count || 0;
      acc.low += v.low_count || 0;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  const priorityChartData = [
    { name: "Critical", value: priorityData.critical, color: PRIORITY_COLORS.critical },
    { name: "High", value: priorityData.high, color: PRIORITY_COLORS.high },
    { name: "Medium", value: priorityData.medium, color: PRIORITY_COLORS.medium },
    { name: "Low", value: priorityData.low, color: PRIORITY_COLORS.low },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Issue Book" subtitle="Historical issue analytics and performance metrics">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Issue Book" subtitle="Historical issue analytics and performance metrics">
      <div className="space-y-6 animate-fade-in">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendors.reduce((sum, v) => sum + (v.total_issues || 0), 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {vendors.reduce((sum, v) => sum + (v.total_resolved || 0), 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Archived</CardTitle>
              <Archive className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">
                {vendors.reduce((sum, v) => sum + (v.total_archived || 0), 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  vendors.reduce((sum, v) => sum + (v.avg_resolution_hours || 0), 0) /
                  (vendors.length || 1)
                ).toFixed(1)}h
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors or assignees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vendors">
              <Building2 className="h-4 w-4 mr-2" />
              By Vendor
            </TabsTrigger>
            <TabsTrigger value="assignees">
              <User className="h-4 w-4 mr-2" />
              By Assignee
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="space-y-4 mt-4">
            {filteredVendors.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No vendors found
                </CardContent>
              </Card>
            ) : (
              filteredVendors.map((v: any) => (
                <Card key={v.vendor_id} className="hover-lift transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{v.vendor_name}</CardTitle>
                      <Badge variant="outline">{(v.avg_resolution_hours ?? 0).toFixed(1)}h avg</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Issues</p>
                        <p className="text-2xl font-bold">{v.total_issues}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Resolved</p>
                        <p className="text-2xl font-bold text-success">{v.total_resolved}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Archived</p>
                        <p className="text-2xl font-bold text-info">{v.total_archived || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Critical</p>
                        <p className="text-2xl font-bold text-destructive">{v.critical_count || 0}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                        Critical: {v.critical_count || 0}
                      </Badge>
                      <Badge className="bg-warning/10 text-warning border-warning/20">
                        High: {v.high_count || 0}
                      </Badge>
                      <Badge className="bg-info/10 text-info border-info/20">
                        Medium: {v.medium_count || 0}
                      </Badge>
                      <Badge className="bg-success/10 text-success border-success/20">
                        Low: {v.low_count || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="assignees" className="space-y-4 mt-4">
            {filteredAssignees.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No assignees found
                </CardContent>
              </Card>
            ) : (
              filteredAssignees.map((a: any) => (
                <Card key={a.user_id} className="hover-lift transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{a.assignee_name}</CardTitle>
                      <Badge variant="outline" className="gap-1">
                        {(a.resolution_rate ?? 0) >= 80 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {(a.resolution_rate ?? 0).toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Assigned</p>
                        <p className="text-2xl font-bold">{a.total_assigned}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Resolved</p>
                        <p className="text-2xl font-bold text-success">{a.total_resolved}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Archived</p>
                        <p className="text-2xl font-bold text-info">{a.total_archived || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Logged time:</span>
                        <span className="font-medium">{(a.total_hours_logged ?? 0).toFixed(0)}h</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.total_resolved}/{a.total_assigned} resolved · {(a.total_hours_logged ?? 0).toFixed(0)}h logged
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
