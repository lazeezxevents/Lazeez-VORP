import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, TrendingDown, Minus, Trophy, Target, Clock, 
  AlertTriangle, CheckCircle, Users, Activity, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmployeePerformance, EmployeeKPI } from "@/hooks/useEmployeePerformance";

function getScoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  if (score >= 40) return "text-orange-500";
  return "text-destructive";
}

function getScoreBgColor(score: number) {
  if (score >= 80) return "bg-success/10";
  if (score >= 60) return "bg-warning/10";
  if (score >= 40) return "bg-orange-500/10";
  return "bg-destructive/10";
}

function getScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  return "Needs Improvement";
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-4 h-4 text-success" />;
  if (trend === "down") return <TrendingDown className="w-4 h-4 text-destructive" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export function EmployeePerformance() {
  const { data, isLoading } = useEmployeePerformance();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { employees, stats } = data || { employees: [], stats: null };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-2xl font-bold">{stats?.totalEmployees || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-success/10">
                <Target className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Resolution Rate</p>
                <p className="text-2xl font-bold">{stats?.avgResolutionRate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-info/10">
                <Activity className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
                <p className="text-2xl font-bold">{stats?.avgPerformanceScore || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats?.topPerformer && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Trophy className="w-5 h-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Top Performer</p>
                  <p className="font-bold truncate">
                    {stats.topPerformer.fullName || stats.topPerformer.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Needs Attention Alert */}
      {stats?.needsAttention && stats.needsAttention.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Employees Needing Attention ({stats.needsAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {stats.needsAttention.slice(0, 5).map((emp) => (
                <Badge key={emp.id} variant="outline" className="border-destructive/50">
                  {emp.fullName || emp.email} - Score: {emp.performanceScore}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Employee Performance Metrics
          </CardTitle>
          <CardDescription>
            Track individual performance based on issues resolved, response time, and vendor satisfaction
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Employees Found</h3>
              <p>Assign the "Employee" role to users to track their performance</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Issues</TableHead>
                  <TableHead className="text-center">Resolution Rate</TableHead>
                  <TableHead className="text-center">Avg Time</TableHead>
                  <TableHead className="text-center">Critical/High</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={emp.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs gradient-primary text-primary-foreground">
                            {emp.fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ||
                              emp.email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {emp.fullName || "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp.designation || emp.department || emp.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("text-lg font-bold", getScoreColor(emp.performanceScore))}>
                          {emp.performanceScore}
                        </span>
                        <Badge className={cn("text-xs", getScoreBgColor(emp.performanceScore), getScoreColor(emp.performanceScore))}>
                          {getScoreLabel(emp.performanceScore)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-semibold">{emp.issuesResolved}/{emp.totalIssuesAssigned}</span>
                        <span className="text-xs text-muted-foreground">
                          {emp.issuesOpen} open, {emp.issuesInProgress} in progress
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("font-semibold", emp.resolutionRate >= 80 ? "text-success" : emp.resolutionRate >= 50 ? "text-warning" : "text-destructive")}>
                          {emp.resolutionRate}%
                        </span>
                        <Progress value={emp.resolutionRate} className="h-1.5 w-16" />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{emp.avgResolutionTimeDays} days</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant="outline" className="text-destructive border-destructive/30">
                          {emp.criticalIssuesResolved} crit
                        </Badge>
                        <Badge variant="outline" className="text-warning border-warning/30">
                          {emp.highPriorityResolved} high
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendIcon trend={emp.trend} />
                        <span className="text-xs text-muted-foreground">
                          {emp.issuesThisMonth} this month
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
