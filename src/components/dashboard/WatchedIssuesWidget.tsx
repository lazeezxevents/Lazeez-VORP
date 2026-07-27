import { motion, AnimatePresence } from "framer-motion";
import { Eye, ExternalLink, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyWatchedIssues } from "@/hooks/useIssueEnhancements";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  open:        "bg-info/10 text-info border-info/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  resolved:    "bg-success/10 text-success border-success/20",
  closed:      "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low:      "bg-priority-low/10 text-priority-low border-priority-low/20",
  medium:   "bg-priority-medium/10 text-priority-medium border-priority-medium/20",
  high:     "bg-priority-high/10 text-priority-high border-priority-high/20",
  critical: "bg-priority-critical/10 text-priority-critical border-priority-critical/20",
};

export function WatchedIssuesWidget() {
  const { data: issues = [], isLoading } = useMyWatchedIssues();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          My Watched Issues
        </CardTitle>
        {issues.length > 0 && (
          <Badge variant="secondary">{issues.length}</Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No watched issues</p>
            <p className="text-xs mt-0.5">Open an issue and click "Add" in the Watchers section.</p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-2"
          >
            <AnimatePresence initial={false}>
              {issues.slice(0, 6).map((issue) => (
                <motion.div
                  key={issue.id}
                  variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate("/issues")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      {issue.vendor && <span className="truncate">{issue.vendor.name}</span>}
                      <span className="opacity-40">·</span>
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{formatDistanceToNow(new Date(issue.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${priorityColors[issue.priority] ?? ""}`}>
                      {issue.priority}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${statusColors[issue.status] ?? ""}`}>
                      {issue.status.replace("_", " ")}
                    </Badge>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors ml-0.5" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {issues.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => navigate("/issues")}
          >
            View all {issues.length} watched issues
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
