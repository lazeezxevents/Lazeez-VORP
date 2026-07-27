import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  Loader2,
  Timer,
  Calendar,
  User,
  Play,
  Square,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIssueTimeLogs, useAddTimeLog } from "@/hooks/useIssueEnhancements";

// ---------------------------------------------------------------------------
// Live stopwatch hook
// ---------------------------------------------------------------------------

function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (running) return;
    startRef.current = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
    setRunning(true);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  };

  const reset = () => {
    stop();
    setElapsed(0);
    startRef.current = null;
  };

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const display = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const elapsedHours = +(elapsed / 3600).toFixed(4);

  return { running, elapsed, elapsedHours, display, start, stop, reset };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TimeTrackingSectionProps {
  issueId: string;
  /** If true, the stopwatch auto-starts (issue just created) */
  autoStart?: boolean;
}

export function TimeTrackingSection({ issueId, autoStart = false }: TimeTrackingSectionProps) {
  const { data: timeLogs, isLoading } = useIssueTimeLogs(issueId);
  const addTimeLog = useAddTimeLog(issueId);
  const stopwatch = useStopwatch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [loggedDate, setLoggedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Auto-start if prop is set
  useEffect(() => {
    if (autoStart) stopwatch.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const handleLogStopwatch = async () => {
    if (stopwatch.elapsedHours < 0.01) return;
    const h = Math.max(0.01, +stopwatch.elapsedHours.toFixed(2));
    stopwatch.reset();
    await addTimeLog.mutateAsync({
      hours: h,
      description: "Recorded via live timer",
      logged_date: format(new Date(), "yyyy-MM-dd"),
    });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) return;
    await addTimeLog.mutateAsync({ hours: h, description: description.trim() || undefined, logged_date: loggedDate });
    setDialogOpen(false);
    setHours("");
    setDescription("");
    setLoggedDate(format(new Date(), "yyyy-MM-dd"));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  const logs = timeLogs ?? [];
  const totalHours = logs.reduce((sum, l) => sum + Number(l.hours), 0);

  // Bucket: auto-created (0.01h) vs real
  const realLogs = logs.filter((l) => Number(l.hours) > 0.01);
  const hasAutoEntry = logs.some(
    (l) => Number(l.hours) === 0.01 && l.description?.includes("automatically")
  );

  return (
    <div className="space-y-5">
      {/* Live stopwatch card */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-background p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stopwatch.running ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {stopwatch.running ? "Timer running" : "Timer stopped"}
            </span>
            {hasAutoEntry && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Auto-started on creation
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalHours > 0 && (
              <Badge variant="outline" className="gap-1 text-xs">
                <TrendingUp className="w-3 h-3" />
                {totalHours.toFixed(2)}h total
              </Badge>
            )}
          </div>
        </div>

        {/* Clock display */}
        <div className="font-mono text-3xl font-bold tracking-widest text-center py-3 tabular-nums">
          {stopwatch.display}
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-3">
          {!stopwatch.running ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={stopwatch.start}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={stopwatch.stop}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={handleLogStopwatch}
            disabled={stopwatch.elapsed < 60 || addTimeLog.isPending}
            title={stopwatch.elapsed < 60 ? "Run timer for at least 1 minute" : "Log elapsed time"}
          >
            {addTimeLog.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            Log elapsed
          </Button>
        </div>

        {/* Progress bar showing how full the day is */}
        {totalHours > 0 && (
          <div className="mt-3 space-y-1">
            <Progress value={Math.min((totalHours / 8) * 100, 100)} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground text-right">
              {totalHours.toFixed(2)}h of 8h workday
            </p>
          </div>
        )}
      </motion.div>

      {/* Manual log */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Time log history
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Manual entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <form onSubmit={handleManualSubmit}>
              <DialogHeader>
                <DialogTitle>Log Time Manually</DialogTitle>
                <DialogDescription>Record time spent on this issue.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="hours">Hours *</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    placeholder="e.g., 2.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="log-date">Date *</Label>
                  <Input
                    id="log-date"
                    type="date"
                    value={loggedDate}
                    onChange={(e) => setLoggedDate(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="log-desc">Description (optional)</Label>
                  <Textarea
                    id="log-desc"
                    placeholder="What did you work on?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!hours || parseFloat(hours) <= 0 || addTimeLog.isPending}>
                  {addTimeLog.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Clock className="w-4 h-4 mr-2" />}
                  Log Time
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Log entries */}
      {realLogs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-xl">
          <Timer className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No time logged yet</p>
          <p className="text-xs">Use the stopwatch or manual entry above.</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {realLogs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.04 }}
                className="p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 font-mono">
                      <Timer className="w-3 h-3" />
                      {Number(log.hours).toFixed(2)}h
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.logged_date), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                {log.description && (
                  <p className="text-sm text-foreground whitespace-pre-wrap mb-1.5 leading-snug">
                    {log.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{log.user?.full_name || log.user?.email || "Unknown"}</span>
                  <span className="opacity-50">·</span>
                  <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
