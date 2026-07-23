import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Ticket, Clock, Users, FileText,
  AlertTriangle, CheckCircle, Target
} from "lucide-react";

interface VendorKPICardProps {
  stats: {
    totalIssues: number;
    openIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
    avgResolutionTime: number;
    totalMous: number;
    activeMous: number;
    assignedEmployees: number;
    resolutionRate: number;
  };
}

export function VendorKPICard({ stats }: VendorKPICardProps) {
  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Resolution Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Target className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resolution Rate</p>
                  <p className="text-lg font-bold">{stats.resolutionRate}%</p>
                </div>
              </div>
              {stats.resolutionRate >= 80 ? (
                <TrendingUp className="w-5 h-5 text-success" />
              ) : (
                <TrendingDown className="w-5 h-5 text-destructive" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10">
                <Clock className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Resolution</p>
                <p className="text-lg font-bold">
                  {stats.resolvedIssues > 0
                    ? `${stats.avgResolutionTime} days`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Open Issues */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Ticket className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open Issues</p>
                <p className="text-lg font-bold">{stats.openIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Issues */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-lg font-bold">{stats.criticalIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Issues */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Issues</p>
                <p className="text-lg font-bold">{stats.totalIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolved Issues */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-lg font-bold">{stats.resolvedIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active MOUs */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10">
                <FileText className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active MOUs</p>
                <p className="text-lg font-bold">{stats.activeMous}/{stats.totalMous}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Employees */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Members</p>
                <p className="text-lg font-bold">{stats.assignedEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
