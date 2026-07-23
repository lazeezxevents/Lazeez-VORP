import { Ticket } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { Issue } from "@/hooks/useIssues";

interface IssueStatusDonutChartProps {
  issues: Issue[];
  isLoading: boolean;
}

const STATUS_ORDER = ["open", "in_progress", "resolved", "closed"] as const;

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    open: "hsl(221 83% 53%)",
    in_progress: "hsl(28 100% 50%)",
    resolved: "hsl(142 71% 45%)",
    closed: "hsl(var(--muted-foreground))",
  };
  return colors[status] || "hsl(var(--muted-foreground))";
}

function transformIssueStatuses(issues: Issue[]) {
  const total = issues.length;
  if (total === 0) return [];

  const statusCounts = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return STATUS_ORDER.map((status) => ({
    name: status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    value: statusCounts[status] || 0,
    percentage: Math.round(((statusCounts[status] || 0) / total) * 100),
    fill: getStatusColor(status),
  })).filter((item) => item.value > 0);
}

interface TooltipPayloadItem {
  payload: {
    name: string;
    value: number;
    percentage: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-background border border-border p-2 rounded shadow-sm text-sm">
        <p className="font-medium">{d.name}</p>
        <p>
          {d.value} issues ({d.percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

export function IssueStatusDonutChart({
  issues,
  isLoading,
}: IssueStatusDonutChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  const data = transformIssueStatuses(issues);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <Ticket className="w-10 h-10 mb-3 opacity-50" />
        <p>No issues yet</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          label={(entry) => `${entry.percentage}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
