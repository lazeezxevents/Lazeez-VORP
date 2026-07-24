import { format, subDays } from "date-fns";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Issue } from "@/hooks/useIssues";

interface IssueFlowTrendChartProps {
  issues: Issue[];
  isLoading: boolean;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function buildIssueFlow(issues: Issue[]) {
  const today = startOfDay(new Date());

  return Array.from({ length: 14 }, (_, index) => {
    const date = subDays(today, 13 - index);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const opened = issues.filter((issue) => {
      const createdAt = new Date(issue.created_at);
      return createdAt >= date && createdAt < nextDay;
    }).length;
    const resolved = issues.filter((issue) => {
      if (!issue.resolved_at) return false;
      const resolvedAt = new Date(issue.resolved_at);
      return resolvedAt >= date && resolvedAt < nextDay;
    }).length;
    const backlog = issues.filter((issue) => {
      const createdAt = new Date(issue.created_at);
      const resolvedAt = issue.resolved_at ? new Date(issue.resolved_at) : null;
      return createdAt < nextDay && (!resolvedAt || resolvedAt >= nextDay);
    }).length;

    return {
      date: format(date, "MMM d"),
      fullDate: format(date, "MMM d, yyyy"),
      opened,
      resolved,
      backlog,
    };
  });
}

function FlowTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReturnType<typeof buildIssueFlow>[number] }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm shadow-sm">
      <p className="font-medium">{item.fullDate}</p>
      <p className="text-muted-foreground">Opened: {item.opened}</p>
      <p className="text-muted-foreground">Resolved: {item.resolved}</p>
      <p className="text-muted-foreground">Open backlog: {item.backlog}</p>
    </div>
  );
}

export function IssueFlowTrendChart({ issues, isLoading }: IssueFlowTrendChartProps) {
  if (isLoading) return <Skeleton className="h-[310px] w-full" />;

  if (issues.length === 0) {
    return (
      <div className="flex h-[310px] flex-col items-center justify-center text-muted-foreground">
        <Ticket className="mb-3 h-10 w-10 opacity-50" />
        <p>No issue activity yet</p>
      </div>
    );
  }

  const data = buildIssueFlow(issues);

  return (
    <div role="img" aria-label="Fourteen day issue flow showing issues opened, resolved, and remaining backlog">
      <ResponsiveContainer width="100%" height={310}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip content={<FlowTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="opened" name="Opened" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="resolved" name="Resolved" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="backlog" name="Open backlog" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
