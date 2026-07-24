import { differenceInCalendarDays, startOfDay } from "date-fns";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { MOUVaultItem } from "@/hooks/useMOUVault";

interface MOUExpiryHorizonChartProps {
  items: MOUVaultItem[];
  isLoading?: boolean;
}

const HORIZONS = ["Expired", "Next 30 days", "31–60 days", "61–90 days", "Beyond 90 days"] as const;

function hasAutoRenewal(item: MOUVaultItem) {
  if (typeof item.has_auto_renewal === "boolean") return item.has_auto_renewal;
  return (item.extracted_terms as Record<string, unknown> | null)?.has_auto_renewal === true;
}

function buildMOUHorizon(items: MOUVaultItem[]) {
  const today = startOfDay(new Date());
  const data = HORIZONS.map((horizon) => ({ horizon, automatic: 0, manual: 0 }));

  items.forEach((item) => {
    if (!item.effective_end_date) return;
    const days = differenceInCalendarDays(new Date(item.effective_end_date), today);
    const index = days < 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    const key = hasAutoRenewal(item) ? "automatic" : "manual";
    data[index][key] += 1;
  });

  return data;
}

function HorizonTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReturnType<typeof buildMOUHorizon>[number] }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const total = item.automatic + item.manual;
  return (
    <div className="rounded-md border border-border bg-background p-3 text-sm shadow-sm">
      <p className="font-medium">{item.horizon}</p>
      <p className="text-muted-foreground">Auto-renewal on: {item.automatic}</p>
      <p className="text-muted-foreground">Manual renewal: {item.manual}</p>
      <p className="text-muted-foreground">Total: {total}</p>
    </div>
  );
}

export function MOUExpiryHorizonChart({ items, isLoading = false }: MOUExpiryHorizonChartProps) {
  if (isLoading) return <Skeleton className="h-[310px] w-full" />;

  const data = buildMOUHorizon(items);
  const hasDatedMOU = data.some((item) => item.automatic + item.manual > 0);
  if (!hasDatedMOU) {
    return (
      <div className="flex h-[310px] flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-3 h-10 w-10 opacity-50" />
        <p>No MOU expiry dates available yet</p>
      </div>
    );
  }

  return (
    <div role="img" aria-label="MOU expiry outlook grouped by time horizon and auto-renewal coverage">
      <ResponsiveContainer width="100%" height={310}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="horizon" width={96} tick={{ fontSize: 11 }} />
          <Tooltip content={<HorizonTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="automatic" name="Auto-renewal on" stackId="coverage" fill="hsl(var(--success))" />
          <Bar dataKey="manual" name="Manual renewal" stackId="coverage" fill="hsl(var(--warning))" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
