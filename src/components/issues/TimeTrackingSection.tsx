import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, Loader2, Timer, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

interface TimeTrackingSectionProps {
  issueId: string;
}

export function TimeTrackingSection({ issueId }: TimeTrackingSectionProps) {
  const { data: timeLogs, isLoading } = useIssueTimeLogs(issueId);
  const addTimeLog = useAddTimeLog(issueId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [loggedDate, setLoggedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0) return;

    await addTimeLog.mutateAsync({
      hours: hoursNum,
      description: description.trim() || undefined,
      logged_date: loggedDate,
    });

    setDialogOpen(false);
    setHours("");
    setDescription("");
    setLoggedDate(format(new Date(), "yyyy-MM-dd"));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Time Tracking
          </label>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const logs = timeLogs || [];
  const totalHours = logs.reduce((sum, log) => sum + log.hours, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Time Tracking
          </label>
          {totalHours > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Timer className="w-3 h-3" />
              {totalHours}h total
            </Badge>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Log time
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Log Time</DialogTitle>
                <DialogDescription>
                  Record time spent working on this issue.
                </DialogDescription>
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
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={loggedDate}
                    onChange={(e) => setLoggedDate(e.target.value)}
                    max={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="What did you work on?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!hours || parseFloat(hours) <= 0 || addTimeLog.isPending}
                >
                  {addTimeLog.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Log Time
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
          <Timer className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No time logged yet</p>
          <p className="text-xs">Start tracking time spent on this issue.</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Timer className="w-3 h-3" />
                      {log.hours}h
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(log.logged_date), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                {log.description && (
                  <p className="text-sm text-foreground whitespace-pre-wrap mb-2">
                    {log.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{log.user?.full_name || log.user?.email || "Unknown"}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
