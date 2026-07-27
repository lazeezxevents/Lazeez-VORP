import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart, RadarChart, 
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Building2, Ticket, Clock, TrendingUp, FileText, CheckCircle2, Download, 
  AlertTriangle, Users, Calendar, Star, Target, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataExportPanel } from "@/components/analytics/DataExportPanel";
import { useSafiScore } from "@/hooks/useSafiScore";
import { useState } from "react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))'];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'hsl(var(--success))',
  medium: 'hsl(var(--warning))',
  high: 'hsl(var(--priority-high))',
  critical: 'hsl(var(--destructive))'
};

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(var(--info))',
  in_progress: 'hsl(var(--warning))',
  resolved: 'hsl(var(--success))',
  closed: 'hsl(var(--muted-foreground))'
};

export default function Analytics() {
  const { vendorStats, issueStats, mouStats, isLoading: statsLoading } = useAnalytics();
  const { data: safiScores, isLoading: safiLoading } = useSafiScore();
  const isLoading = statsLoading || safiLoading;

  const scoreDistribution = safiScores ? [
    { name: 'Excellent (90-100)', value: safiScores.filter(s => s.score >= 90).length, fill: 'hsl(var(--success))' },
    { name: 'Good (70-89)', value: safiScores.filter(s => s.score >= 70 && s.score < 90).length, fill: 'hsl(var(--info))' },
    { name: 'Average (50-69)', value: safiScores.filter(s => s.score >= 50 && s.score < 70).length, fill: 'hsl(var(--warning))' },
    { name: 'Poor (<50)', value: safiScores.filter(s => s.score < 50).length, fill: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0) : [];

  const topSafiVendor = safiScores && safiScores.length > 0 ? safiScores[0] : null;

  const categoryData = vendorStats.data?.categoryDistribution
    ? Object.entries(vendorStats.data.categoryDistribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }))
    : [];

  const priorityData = issueStats.data?.priorityDistribution
    ? Object.entries(issueStats.data.priorityDistribution).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: PRIORITY_COLORS[name] || COLORS[0]
    }))
    : [];

  const statusData = issueStats.data?.statusDistribution
    ? Object.entries(issueStats.data.statusDistribution).map(([name, value]) => ({
      name: name.replace('_', ' ').charAt(0).toUpperCase() + name.replace('_', ' ').slice(1),
      value,
      fill: STATUS_COLORS[name] || COLORS[0]
    }))
    : [];

  const trendsData = issueStats.data?.monthlyTrends
    ? Object.entries(issueStats.data.monthlyTrends).map(([month, count]) => ({
      month,
      issues: count
    }))
    : [];

  const stats = [
    {
      title: "Total Vendors",
      value: vendorStats.data?.totalVendors || 0,
      subtitle: `${vendorStats.data?.activeVendors || 0} active`,
      icon: Building2
    },
    {
      title: "Total Issues",
      value: issueStats.data?.totalIssues || 0,
      subtitle: `${issueStats.data?.openIssues || 0} open`,
      icon: Ticket
    },
    {
      title: "Avg Resolution",
      value: `${(issueStats.data?.avgResolutionTime || 0).toFixed(1)}h`,
      subtitle: "average time",
      icon: Clock
    },
    {
      title: "Active MOUs",
      value: mouStats.data?.activeMous || 0,
      subtitle: `${mouStats.data?.totalMous || 0} total`,
      icon: FileText
    },
    {
      title: "Top SAFI Score",
      value: topSafiVendor?.score || 0,
      subtitle: topSafiVendor?.vendorName || "N/A",
      icon: TrendingUp
    },
    {
      title: "Pending Vendors",
      value: vendorStats.data?.pendingVendors || 0,
      subtitle: "awaiting approval",
      icon: Users
    },
    {
      title: "Expired MOUs",
      value: mouStats.data?.expiredMous || 0,
      subtitle: "need renewal",
      icon: Calendar
    },
    {
      title: "In Progress Issues",
      value: issueStats.data?.inProgressIssues || 0,
      subtitle: "actively worked on",
      icon: Activity
    },
    {
      title: "Resolved Issues",
      value: issueStats.data?.resolvedIssues || 0,
      subtitle: "successfully closed",
      icon: CheckCircle2
    },
    {
      title: "Avg Vendor Rating",
      value: (vendorStats.data?.avgRating || 0).toFixed(1),
      subtitle: "out of 5.0 stars",
      icon: Star
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout title="Analytics" subtitle="Performance metrics and insights">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" subtitle="Performance metrics and insights">
      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid - Now 10 cards with red monochrome icons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, index) => (
            <Card key={stat.title} style={{ animationDelay: `${index * 50}ms` }}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold mt-2 text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shadow-lg">
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Issue Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="issues"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SAFI Score Distribution (Advanced Pie) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                SAFI Score Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {scoreDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Issues by Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Issue Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Issues by Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 3 - New additions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Vendor Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* MOU Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                MOU Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: 'Active', value: mouStats.data?.activeMous || 0, fill: 'hsl(var(--success))' },
                  { name: 'Pending', value: mouStats.data?.pendingMous || 0, fill: 'hsl(var(--warning))' },
                  { name: 'Expired', value: mouStats.data?.expiredMous || 0, fill: 'hsl(var(--destructive))' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[
                      { name: 'Active', value: mouStats.data?.activeMous || 0, fill: 'hsl(var(--success))' },
                      { name: 'Pending', value: mouStats.data?.pendingMous || 0, fill: 'hsl(var(--warning))' },
                      { name: 'Expired', value: mouStats.data?.expiredMous || 0, fill: 'hsl(var(--destructive))' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* System Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={[
                  {
                    category: 'Vendors',
                    value: vendorStats.data?.totalVendors ? Math.min(100, (vendorStats.data.activeVendors / vendorStats.data.totalVendors) * 100) : 0
                  },
                  {
                    category: 'Issues',
                    value: issueStats.data?.totalIssues ? Math.min(100, (issueStats.data.resolvedIssues / issueStats.data.totalIssues) * 100) : 0
                  },
                  {
                    category: 'MOUs',
                    value: mouStats.data?.totalMous ? Math.min(100, (mouStats.data.activeMous / mouStats.data.totalMous) * 100) : 0
                  },
                  {
                    category: 'SAFI',
                    value: topSafiVendor?.score || 0
                  },
                  {
                    category: 'Response',
                    value: issueStats.data?.avgResolutionTime ? Math.max(0, 100 - Math.min(100, issueStats.data.avgResolutionTime / 2)) : 0
                  },
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" className="text-xs" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Health Score"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Export Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DataExportPanel />
          </div>
          <div className="lg:col-span-2">
            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Resolution Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      {issueStats.data?.totalIssues
                        ? ((issueStats.data.resolvedIssues / issueStats.data.totalIssues) * 100).toFixed(1)
                        : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {issueStats.data?.resolvedIssues || 0} of {issueStats.data?.totalIssues || 0} resolved
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Vendor Activation Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      {vendorStats.data?.totalVendors
                        ? ((vendorStats.data.activeVendors / vendorStats.data.totalVendors) * 100).toFixed(1)
                        : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {vendorStats.data?.activeVendors || 0} active vendors
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Average Vendor Rating</p>
                    <p className="text-2xl font-bold text-foreground">
                      {(vendorStats.data?.avgRating || 0).toFixed(1)} ★
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      across all rated vendors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
