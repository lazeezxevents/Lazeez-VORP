import { format, subDays, parseISO } from "date-fns";
import { Building2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipProps } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vendor } from "@/hooks/useVendors";

interface VendorOnboardingTrendChartProps {
  vendors: Vendor[];
  isLoading: boolean;
}

function transformVendorOnboardingTrend(vendors: Vendor[]) {
  const today = new Date();
  const dailyCounts: Record<string, number> = {};

  // Initialize all 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const date = subDays(today, i);
    const key = format(date, "yyyy-MM-dd");
    dailyCounts[key] = 0;
  }

  // Count vendors by creation date
  vendors.forEach((vendor) => {
    const key = vendor.created_at.split("T")[0];
    if (key in dailyCounts) {
      dailyCounts[key]++;
    }
  });

  return Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: format(parseISO(date), "MMM dd"),
      fullDate: date,
      count,
    }));
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border p-2 rounded shadow-sm text-sm">
        <p className="font-medium">{payload[0].payload.fullDate}</p>
        <p>{payload[0].value} vendors</p>
      </div>
    );
  }
  return null;
}

export function VendorOnboardingTrendChart({
  vendors,
  isLoading,
}: VendorOnboardingTrendChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />;
  }

  if (vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
        <Building2 className="w-10 h-10 mb-3 opacity-50" />
        <p>No vendors in the last 30 days</p>
      </div>
    );
  }

  const data = transformVendorOnboardingTrend(vendors);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--primary))", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
