import { useMemo } from "react";
import { format, addDays, addMonths, isPast } from "date-fns";
import { 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Ban,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MOUVaultItem } from "@/hooks/useMOUVault";

interface RenewalCycle {
  number: number;
  startDate: Date;
  endDate: Date;
  status: "expired" | "active" | "upcoming";
  terminationDeadline: Date | null;
  label: string;
}

interface MOURenewalTimelineProps {
  item: MOUVaultItem;
  vendorStatus?: string;
  compact?: boolean;
}

/** Map renewal_period_days to calendar months */
function daysToMonths(days: number): number {
  if (days <= 31) return 1;
  if (days <= 62) return 2;
  if (days <= 92) return 3;
  if (days <= 182) return 6;
  if (days <= 367) return 12;
  return Math.round(days / 30);
}

function computeRenewalCycles(
  startDate: Date,
  effectiveEndDate: Date | null,
  renewalDays: number,
  hasAutoRenewal: boolean,
  vendorActive: boolean,
  noticeDays: number
): RenewalCycle[] {
  const cycles: RenewalCycle[] = [];
  const today = new Date();
  const months = daysToMonths(renewalDays);

  let cycleStart = startDate;
  // First cycle uses DB end date if available, otherwise falls back to addMonths
  let cycleEnd = effectiveEndDate || addMonths(cycleStart, months);
  let cycleNum = 0;

  // Build expired cycles
  while (cycleEnd <= today) {
    const deadline = noticeDays > 0 ? addDays(cycleEnd, -noticeDays) : null;
    cycles.push({
      number: cycleNum,
      startDate: cycleStart,
      endDate: cycleEnd,
      status: "expired",
      terminationDeadline: deadline,
      label: cycleNum === 0 ? "Original Term" : `Auto-Renewed #${cycleNum}`,
    });

    if (!hasAutoRenewal || !vendorActive) break;
    cycleNum++;
    cycleStart = cycleEnd;
    cycleEnd = addMonths(cycleStart, months);
  }

  // Current active cycle
  if (hasAutoRenewal && vendorActive && cycleEnd > today) {
    const deadline = noticeDays > 0 ? addDays(cycleEnd, -noticeDays) : null;
    cycles.push({
      number: cycleNum,
      startDate: cycleStart,
      endDate: cycleEnd,
      status: "active",
      terminationDeadline: deadline,
      label: cycleNum === 0 ? "Original Term" : `Auto-Renewed #${cycleNum}`,
    });

    // One projected future cycle
    const nextStart = cycleEnd;
    const nextEnd = addMonths(nextStart, months);
    const nextDeadline = noticeDays > 0 ? addDays(nextEnd, -noticeDays) : null;
    cycles.push({
      number: cycleNum + 1,
      startDate: nextStart,
      endDate: nextEnd,
      status: "upcoming",
      terminationDeadline: nextDeadline,
      label: `Projected #${cycleNum + 1}`,
    });
  } else if (!hasAutoRenewal && cycles.length === 0) {
    const deadline = noticeDays > 0 ? addDays(cycleEnd, -noticeDays) : null;
    cycles.push({
      number: 0,
      startDate: cycleStart,
      endDate: cycleEnd,
      status: isPast(cycleEnd) ? "expired" : "active",
      terminationDeadline: deadline,
      label: "Original Term (No Auto-Renewal)",
    });
  }

  return cycles;
}

const statusConfig = {
  expired: {
    color: "bg-destructive/10 text-destructive border-destructive/30",
    dotColor: "bg-destructive",
    lineColor: "bg-destructive/20",
    icon: CheckCircle2,
  },
  active: {
    color: "bg-success/10 text-success border-success/30",
    dotColor: "bg-success",
    lineColor: "bg-success/20",
    icon: RefreshCw,
  },
  upcoming: {
    color: "bg-info/10 text-info border-info/30",
    dotColor: "bg-info",
    lineColor: "bg-info/20",
    icon: Clock,
  },
};

export function MOURenewalTimeline({ item, vendorStatus, compact = false }: MOURenewalTimelineProps) {
  const inactiveStatuses = ["left", "terminated", "blacklisted"];
  const vendorActive = !vendorStatus || !inactiveStatuses.includes(vendorStatus);

  const hasAutoRenewal = item.has_auto_renewal || 
    (item.extracted_terms as Record<string, unknown>)?.has_auto_renewal === true;
  
  const renewalDays = item.renewal_period_days || 
    Number((item.extracted_terms as Record<string, unknown>)?.renewal_period_days) || 90;

  const noticeDays = item.termination_notice_days || 30;

  const cycles = useMemo(() => {
    if (!item.effective_start_date) return [];
    const startDate = new Date(item.effective_start_date);
    const endDate = item.effective_end_date ? new Date(item.effective_end_date) : null;
    return computeRenewalCycles(startDate, endDate, renewalDays, !!hasAutoRenewal, vendorActive, noticeDays);
  }, [item.effective_start_date, item.effective_end_date, renewalDays, hasAutoRenewal, vendorActive, noticeDays]);

  if (cycles.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No renewal data available (missing start date)
      </div>
    );
  }

  const totalRenewals = cycles.filter(c => c.status === "expired" && c.number > 0).length +
    (cycles.some(c => c.status === "active" && c.number > 0) ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Renewal Timeline
        </h4>
        <div className="flex items-center gap-2">
          {totalRenewals > 0 && (
            <Badge variant="outline" className="text-xs">
              {totalRenewals} renewal{totalRenewals !== 1 ? "s" : ""}
            </Badge>
          )}
          {!vendorActive && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
              <Ban className="w-3 h-3 mr-1" />
              Vendor Inactive
            </Badge>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-6">
        {cycles.map((cycle, index) => {
          const config = statusConfig[cycle.status];
          const Icon = config.icon;
          const isLast = index === cycles.length - 1;
          const deadlinePassed = cycle.terminationDeadline && isPast(cycle.terminationDeadline);

          return (
            <div key={cycle.number} className="relative pb-4 last:pb-0">
              {/* Vertical line */}
              {!isLast && (
                <div className={`absolute left-[-16px] top-6 w-0.5 h-[calc(100%-8px)] ${config.lineColor}`} />
              )}
              
              {/* Dot */}
              <div className={`absolute left-[-20px] top-1.5 w-3 h-3 rounded-full border-2 border-background ${config.dotColor}`} />

              {/* Content */}
              <div className={`rounded-lg border p-3 ${cycle.status === "active" ? "border-success/30 bg-success/5" : cycle.status === "upcoming" ? "border-dashed border-info/30 bg-info/5" : "border-border bg-muted/20"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Icon className="w-3 h-3" />
                    {cycle.label}
                  </span>
                  <Badge variant="outline" className={`text-xs ${config.color}`}>
                    {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{format(cycle.startDate, "MMM d, yyyy")}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>{format(cycle.endDate, "MMM d, yyyy")}</span>
                </div>
                {!compact && cycle.terminationDeadline && cycle.status !== "expired" && (
                  <div className={`text-xs mt-1.5 flex items-center gap-1 ${deadlinePassed ? "text-destructive" : "text-warning"}`}>
                    <AlertTriangle className="w-3 h-3" />
                    Termination deadline: {format(cycle.terminationDeadline, "MMM d, yyyy")}
                    {deadlinePassed && " (passed)"}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Vendor inactive marker */}
        {!vendorActive && (
          <div className="relative pb-0">
            <div className="absolute left-[-20px] top-1.5 w-3 h-3 rounded-full border-2 border-background bg-destructive" />
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <span className="text-xs font-medium flex items-center gap-1.5 text-destructive">
                <Ban className="w-3 h-3" />
                Vendor {vendorStatus} — No further renewals
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
