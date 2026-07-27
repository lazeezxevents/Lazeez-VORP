import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Brain,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Target,
  Users,
  TrendingUp,
  Shield,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Issue, useUpdateIssue } from "@/hooks/useIssues";
import { supabase } from "@/integrations/supabase/client";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AIAnalysis {
  severity_assessment: string;
  root_cause: string;
  vendor_history_summary: string;
  difficulty_level: "easy" | "moderate" | "complex" | "critical";
  recommended_actions: {
    step: string;
    priority: "immediate" | "short_term" | "long_term";
  }[];
  suggested_status: string;
  resolution_remark: string;
  risk_factors: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const difficultyConfig: Record<string, { label: string; color: string }> = {
  easy:     { label: "Easy",     color: "bg-success/10 text-success border-success/30" },
  moderate: { label: "Moderate", color: "bg-warning/10 text-warning border-warning/30" },
  complex:  { label: "Complex",  color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  critical: { label: "Critical", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const priorityColors: Record<string, string> = {
  immediate:  "text-destructive",
  short_term: "text-warning",
  long_term:  "text-info",
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const backdropVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
  exit:    { opacity: 0 },
};

const panelVariants = {
  hidden:  { opacity: 0, x: 40, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    x: 32,
    scale: 0.97,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IssueAIPanelProps {
  issue: Issue | null;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueAIPanel({ issue, open, onClose }: IssueAIPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateIssue = useUpdateIssue();

  const analyze = async () => {
    if (!issue) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      if (!isGroqConfigured()) {
        throw new Error("Groq API key not configured. Add VITE_GROQ_API_KEY to your .env file.");
      }

      // Gather vendor context
      let vendorContextStr = "No previous issues found.";
      let vendorName = issue.vendor?.name || "Unknown Vendor";

      if (issue.vendor_id) {
        const { data: vendorInfo } = await supabase
          .from("vendors")
          .select("name")
          .eq("id", issue.vendor_id)
          .single();
        if (vendorInfo) vendorName = vendorInfo.name;

        const { data: pastIssues } = await supabase
          .from("issues")
          .select("title, status, priority, created_at")
          .eq("vendor_id", issue.vendor_id)
          .neq("id", issue.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (pastIssues && pastIssues.length > 0) {
          vendorContextStr = (pastIssues as Array<{ title: string; status: string; priority: string }>)
            .map((i) => `- ${i.title} (${i.status}, ${i.priority})`)
            .join("\n");
        }
      }

      const systemPrompt = `You are an AI Incident Manager for Lazeez Events.
Analyze the following event/vendor issue and return exactly this JSON structure:
{
  "severity_assessment": "1-2 sentence explanation of severity",
  "root_cause": "Hypothesized root cause based on details",
  "vendor_history_summary": "1 sentence summarizing past vendor context",
  "difficulty_level": "easy" | "moderate" | "complex" | "critical",
  "recommended_actions": [
    { "step": "Actionable step", "priority": "immediate" | "short_term" | "long_term" }
  ],
  "suggested_status": "in_progress" | "resolved" | "blocked" | "escalated",
  "resolution_remark": "Short note summarizing the AI insight",
  "risk_factors": ["Array of potential future risks"]
}`;

      const userPrompt = `Issue Title: ${issue.title}
Issue Description: ${issue.description || "N/A"}
Current Priority: ${issue.priority}
Current Status: ${issue.status}
Vendor: ${vendorName}

Past Issues from this Vendor:
${vendorContextStr}`;

      const result = await callGroq(systemPrompt, userPrompt, true);
      setAnalysis(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to analyze issue";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const applyStatus = async () => {
    if (!issue || !analysis) return;
    try {
      await updateIssue.mutateAsync({ id: issue.id, status: analysis.suggested_status as never });
      toast.success(`Status updated to "${analysis.suggested_status}"`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const addRemark = async () => {
    if (!issue?.vendor_id || !analysis) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: remarkError } = await supabase.from("vendor_remarks").insert({
        vendor_id: issue.vendor_id,
        remark: `[AI Insight] ${analysis.resolution_remark}`,
        remark_type: "general",
        created_by: user?.id,
      });
      if (remarkError) throw remarkError;
      toast.success("Remark added to vendor file");
    } catch {
      toast.error("Failed to add vendor remark");
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && issue && (
        <>
          {/* Backdrop — lighter than detail panel to show stacking */}
          <motion.div
            key="ai-backdrop"
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in panel from right */}
          <motion.aside
            key="ai-panel"
            className="
              fixed top-0 right-0 bottom-0 z-[60]
              w-full max-w-[420px]
              bg-background
              border-l border-border
              shadow-2xl
              flex flex-col
              overflow-hidden
            "
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="complementary"
            aria-label="AI Issue Assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">AI Assist</p>
                  <p className="text-xs text-muted-foreground">Powered by Groq</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close AI panel">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Issue context card */}
            <div className="px-5 pt-4 shrink-0">
              <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                <p className="text-sm font-medium text-foreground leading-snug">{issue.title}</p>
                {issue.vendor?.name && (
                  <p className="text-xs text-muted-foreground mt-1">Vendor: {issue.vendor.name}</p>
                )}
                <div className="flex gap-2 mt-2.5">
                  <Badge variant="outline" className="text-[11px]">{issue.priority}</Badge>
                  <Badge variant="outline" className="text-[11px]">{issue.status}</Badge>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Analyze trigger */}
              {!analysis && !loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Button onClick={analyze} className="w-full gap-2" size="lg">
                    <Sparkles className="w-4 h-4" />
                    Analyze with AI
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Reviews vendor history, past issues, and current context
                  </p>
                </motion.div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center py-14 gap-3 text-muted-foreground">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <Loader2 className="w-5 h-5 absolute -bottom-1 -right-1 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Analyzing issue…</p>
                    <p className="text-xs mt-0.5">Reviewing vendor history and context</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>{error}</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={analyze}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Results */}
              {analysis && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                  className="space-y-3"
                >
                  {/* Assessment */}
                  <motion.div variants={itemVariants}>
                    <Card>
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Target className="w-3.5 h-3.5" />
                          Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Difficulty</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              difficultyConfig[analysis.difficulty_level]?.color
                            )}
                          >
                            {difficultyConfig[analysis.difficulty_level]?.label ?? analysis.difficulty_level}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed">{analysis.severity_assessment}</p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Root cause */}
                  <motion.div variants={itemVariants}>
                    <Card>
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                          Root Cause
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <p className="text-sm leading-relaxed">{analysis.root_cause}</p>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Vendor history */}
                  {analysis.vendor_history_summary && (
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-info" />
                            Vendor History
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <p className="text-sm leading-relaxed">{analysis.vendor_history_summary}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Recommended actions */}
                  <motion.div variants={itemVariants}>
                    <Card>
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          Recommended Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4 space-y-2.5">
                        {analysis.recommended_actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight
                              className={cn(
                                "w-3.5 h-3.5 mt-0.5 shrink-0",
                                priorityColors[action.priority]
                              )}
                            />
                            <div>
                              <p className="text-sm leading-snug">{action.step}</p>
                              <Badge variant="outline" className="text-[10px] mt-1">
                                {action.priority.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Risk factors */}
                  {analysis.risk_factors.length > 0 && (
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-destructive" />
                            Risk Factors
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <ul className="space-y-1.5">
                            {analysis.risk_factors.map((risk, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-destructive mt-1 shrink-0">•</span>
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Quick actions */}
                  <motion.div variants={itemVariants}>
                    <Separator />
                    <div className="space-y-2 pt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Quick actions
                      </p>
                      {analysis.suggested_status !== issue.status && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={applyStatus}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          Set status to "{analysis.suggested_status}"
                        </Button>
                      )}
                      {issue.vendor_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={addRemark}
                        >
                          <Users className="w-3.5 h-3.5" />
                          Add insight to vendor file
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-2"
                        onClick={analyze}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-analyze
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
