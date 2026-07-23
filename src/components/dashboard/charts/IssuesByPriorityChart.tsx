import { Issue } from "@/hooks/useIssues";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface IssuesByPriorityChartProps {
  issues: Issue[];
  isLoading: boolean;
}

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: "hsl(var(--destructive))",
    high: "hsl(28 100% 50%)", // orange - fallback for --warning
    medium: "hsl(45 93% 47%)",
    low: "hsl(221 83% 53%)", // blue - fallback for --info
  };
  return colors[priority] || "hsl(var(--muted-foreground))";
}

function transformIssuePriorities(issues: Issue[]) {
  const priorityCounts = issues.reduce(
    (acc, issue) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Ensure all 4 priority levels are present, even with 0 count
  return PRIORITY_ORDER.map((priority) => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: priorityCounts[priority] || 0,
    fill: getPriorityColor(priority),
  }));
}

export function IssuesByPriorityChart({
  issues,
  isLoading,
}: IssuesByPriorityChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />;
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
        <Ticket className="w-12 h-12 mb-3 opacity-50" />
        <p>No issues yet</p>
      </div>
    );
  }

  const data = transformIssuePriorities(issues);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
