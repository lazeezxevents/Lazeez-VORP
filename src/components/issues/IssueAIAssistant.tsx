import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Target,
  Users,
  TrendingUp,
  Shield,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Issue, useUpdateIssue } from "@/hooks/useIssues";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";

interface AIAnalysis {
  severity_assessment: string;
  root_cause: string;
  vendor_history_summary: string;
  difficulty_level: "easy" | "moderate" | "complex" | "critical";
  recommended_actions: { step: string; priority: "immediate" | "short_term" | "long_term" }[];
  suggested_status: string;
  suggested_assignee?: string;
  resolution_remark: string;
  risk_factors: string[];
}

interface IssueAIAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: Issue | null;
}

const difficultyColors: Record<string, string> = {
  easy: "bg-success/10 text-success border-success/30",
  moderate: "bg-warning/10 text-warning border-warning/30",
  complex: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

const priorityColors: Record<string, string> = {
  immediate: "text-destructive",
  short_term: "text-warning",
  long_term: "text-info",
};

export function IssueAIAssistant({ open, onOpenChange, issue }: IssueAIAssistantProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const updateIssue = useUpdateIssue();

  const analyze = async () => {
    if (!issue) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      if (!isGroqConfigured()) {
        throw new Error("Groq API key not configured. Please add it to your .env file.");
      }

      // 1. Fetch vendor context since we are on the client now
      let vendorContextStr = "No previous issues found.";
      let fetchedVendorName = issue.vendor?.name || "Unknown Vendor";

      if (issue.vendor_id) {
        const { data: vendorInfo } = await supabase
          .from("vendors")
          .select("name")
          .eq("id", issue.vendor_id)
          .single();

        if (vendorInfo) fetchedVendorName = vendorInfo.name;

        const { data: pastIssues } = await supabase
          .from("issues")
          .select("title, status, priority, created_at")
          .eq("vendor_id", issue.vendor_id)
          .neq("id", issue.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (pastIssues && pastIssues.length > 0) {
          vendorContextStr = pastIssues.map(i => `- ${(i as any).title} (${(i as any).status}, ${(i as any).priority})`).join("\n");
        }
      }

      // 2. Call Groq
      const systemPrompt = `You are an AI Incident Manager for Lazeez Events.
Analyze the following event/vendor issue and provide a structured JSON assessment.

Return exactly this JSON structure:
{
  "severity_assessment": "1-2 sentence explanation of severity",
  "root_cause": "Hypothesized root cause based on details",
  "vendor_history_summary": "1 sentence summarizing past vendor context",
  "difficulty_level": "easy", "moderate", "complex", or "critical",
  "recommended_actions": [
    { "step": "Actionable step here", "priority": "immediate", "short_term", or "long_term" }
  ],
  "suggested_status": "in_progress", "resolved", "blocked", or "escalated",
  "resolution_remark": "A short note summarizing the AI insight for the vendor's file",
  "risk_factors": ["Array of potential future risks string"]
}`;

      const userPrompt = `Issue Title: ${issue.title}
Issue Description: ${issue.description || "N/A"}
Current Priority: ${issue.priority}
Current Status: ${issue.status}
Reported Against Vendor: ${fetchedVendorName}

Past Issues from this Vendor:
${vendorContextStr}`;

      const analysisJson = await callGroq(systemPrompt, userPrompt, true);

      setAnalysis(analysisJson);
      setVendorName(fetchedVendorName);
    } catch (e) {
      const msg = e?.message || "Failed to analyze issue";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const applyStatus = async () => {
    if (!issue || !analysis) return;
    try {
      await updateIssue.mutateAsync({
        id: issue.id,
        status: analysis.suggested_status as any,
      });
      toast.success(`Status updated to ${analysis.suggested_status}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const addRemark = async () => {
    if (!issue?.vendor_id || !analysis) return;
    try {
      const { error } = await supabase.from("vendor_remarks").insert({
        vendor_id: issue.vendor_id,
        remark: `[System Insight] ${analysis.resolution_remark}`,
        remark_type: "general",
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success("Remark added to vendor");
    } catch {
      toast.error("Failed to add remark");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Issue Assistant
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="px-6 pb-6 space-y-4">
            {/* Issue Info */}
            {issue && (
              <Card>
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{issue.title}</p>
                  {issue.vendor?.name && (
                    <p className="text-xs text-muted-foreground mt-1">Vendor: {issue.vendor.name}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{issue.priority}</Badge>
                    <Badge variant="outline" className="text-xs">{issue.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analyze Button */}
            {!analysis && !loading && (
              <Button onClick={analyze} className="w-full gap-2" size="lg">
                <Sparkles className="w-4 h-4" />
                Analyze via VORP
              </Button>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-sm">Analyzing issue context...</p>
                <p className="text-xs mt-1">Reviewing vendor history, payments, and past issues</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <Card className="border-destructive/30">
                <CardContent className="p-4 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {error}
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={analyze}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Analysis Results */}
            {analysis && (
              <>
                {/* Difficulty & Severity */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Difficulty:</span>
                      <Badge className={difficultyColors[analysis.difficulty_level]}>
                        {analysis.difficulty_level.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm">{analysis.severity_assessment}</p>
                  </CardContent>
                </Card>

                {/* Root Cause */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Root Cause
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{analysis.root_cause}</p>
                  </CardContent>
                </Card>

                {/* Vendor History */}
                {analysis.vendor_history_summary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-info" />
                        Vendor History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{analysis.vendor_history_summary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Recommended Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      Recommended Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.recommended_actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ArrowRight className={cn("w-3 h-3 mt-1 flex-shrink-0", priorityColors[action.priority])} />
                          <div>
                            <p className="text-sm">{action.step}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{action.priority.replace("_", " ")}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Factors */}
                {analysis.risk_factors.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4 text-destructive" />
                        Risk Factors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {analysis.risk_factors.map((risk, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-destructive mt-1">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Actions */}
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Quick Actions</p>
                  {analysis.suggested_status !== issue?.status && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={applyStatus}>
                      <CheckCircle2 className="w-4 h-4" />
                      Set status to "{analysis.suggested_status}"
                    </Button>
                  )}
                  {issue?.vendor_id && (
                    <Button variant="outline" className="w-full justify-start gap-2" onClick={addRemark}>
                      <Users className="w-4 h-4" />
                      Add system insight as vendor remark
                    </Button>
                  )}
                  <Button variant="ghost" className="w-full" onClick={analyze}>
                    Re-analyze
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}