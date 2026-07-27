/**
 * VendorIssueChat — shows the persistent team chat for a specific issue
 * inline inside the vendor detail Issues tab.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronDown, ChevronUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IssueTeamChat } from "@/components/issues/IssueTeamChat";
import { Issue } from "@/hooks/useIssues";
import { cn } from "@/lib/utils";

interface VendorIssueChatProps {
  issue: Issue;
}

export function VendorIssueChat({ issue }: VendorIssueChatProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors",
          open
            ? "border-primary/30 bg-primary/5 text-primary"
            : "border-border hover:border-primary/30 hover:bg-muted/40 text-muted-foreground"
        )}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="font-medium">Team chat</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20">
            Live
          </Badge>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 380, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden rounded-b-lg border border-t-0 border-primary/20"
          >
            <IssueTeamChat issue={issue} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
