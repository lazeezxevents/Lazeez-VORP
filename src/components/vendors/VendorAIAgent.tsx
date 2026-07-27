import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bot, Send, Loader2, X, Sparkles, AlertTriangle, RefreshCw,
  Building2, FileText, Ticket, DollarSign, History, Brain,
  ChevronDown, ChevronUp, Database,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { chatWithGroq, isGroqConfigured } from "@/lib/groqClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationMessage {
  id: string;
  vendor_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface VendorContext {
  vendor: {
    id: string;
    name: string;
    category: string;
    status: string;
    rating: number | null;
    commission_percentage: number | null;
    subscription_amount: number | null;
    description: string | null;
  };
  issues: Array<{ title: string; status: string; priority: string; created_at: string }>;
  payments: Array<{ amount: number; payment_type: string; status: string; payment_date: string | null }>;
  mous: Array<{ title: string; status: string; start_date: string | null; end_date: string | null }>;
  remarks: Array<{ remark: string; remark_type: string; created_at: string }>;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(ctx: VendorContext): string {
  const issuesSummary = ctx.issues.length
    ? ctx.issues.slice(0, 10).map(i => `- ${i.title} [${i.status}/${i.priority}] (${format(new Date(i.created_at), "MMM d, yyyy")})`).join("\n")
    : "No issues recorded.";

  const paymentsSummary = ctx.payments.length
    ? ctx.payments.slice(0, 10).map(p => `- ${p.payment_type}: PKR ${p.amount?.toLocaleString()} [${p.status}]${p.payment_date ? ` on ${format(new Date(p.payment_date), "MMM d, yyyy")}` : ""}`).join("\n")
    : "No payment records.";

  const mousSummary = ctx.mous.length
    ? ctx.mous.slice(0, 5).map(m => `- ${m.title} [${m.status}]${m.end_date ? ` expires ${format(new Date(m.end_date), "MMM d, yyyy")}` : ""}`).join("\n")
    : "No MOUs on file.";

  const remarksSummary = ctx.remarks.length
    ? ctx.remarks.slice(0, 5).map(r => `- [${r.remark_type}] ${r.remark}`).join("\n")
    : "No remarks.";

  return `You are the MOU Agent for Lazeez Events — a senior vendor intelligence AI.

You have full context about this vendor and can answer questions about:
- Their performance, issues, payment history
- Active MOUs and renewal status
- Team remarks and insights
- Risk flags and recommendations

Always be concise, factual, and reference the actual data provided.

=== VENDOR PROFILE ===
Name: ${ctx.vendor.name}
Category: ${ctx.vendor.category}
Status: ${ctx.vendor.status}
Rating: ${ctx.vendor.rating ?? "Not rated"}
Commission: ${ctx.vendor.commission_percentage ? `${ctx.vendor.commission_percentage}%` : "None"}
Subscription: ${ctx.vendor.subscription_amount ? `PKR ${ctx.vendor.subscription_amount.toLocaleString()}` : "None"}
${ctx.vendor.description ? `Description: ${ctx.vendor.description}` : ""}

=== ISSUE HISTORY (recent 10) ===
${issuesSummary}

=== PAYMENT HISTORY (recent 10) ===
${paymentsSummary}

=== MOUs ===
${mousSummary}

=== TEAM REMARKS ===
${remarksSummary}`;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useVendorConversation(vendorId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["vendor-agent-conversation", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_agent_conversations")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ConversationMessage[];
    },
    enabled: !!vendorId && !!user,
  });

  const saveMessage = useMutation({
    mutationFn: async ({ role, content }: { role: "user" | "assistant"; content: string }) => {
      const { data, error } = await supabase
        .from("vendor_agent_conversations")
        .insert({ vendor_id: vendorId, user_id: user!.id, role, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-agent-conversation", vendorId] }),
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vendor_agent_conversations")
        .delete()
        .eq("vendor_id", vendorId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-agent-conversation", vendorId] });
      toast.success("Conversation cleared");
    },
  });

  return { query, saveMessage, clearHistory };
}

function useVendorContext(vendorId: string) {
  return useQuery({
    queryKey: ["vendor-full-context", vendorId],
    queryFn: async () => {
      const [vendorRes, issuesRes, paymentsRes, mousRes, remarksRes] = await Promise.all([
        supabase.from("vendors").select("id,name,category,status,rating,commission_percentage,subscription_amount,description").eq("id", vendorId).single(),
        supabase.from("issues").select("title,status,priority,created_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
        supabase.from("vendor_payments").select("amount,payment_type,status,payment_date").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
        supabase.from("mous").select("title,status,start_date,end_date").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(5),
        supabase.from("vendor_remarks").select("remark,remark_type,created_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(5),
      ]);

      if (vendorRes.error) throw vendorRes.error;

      return {
        vendor: vendorRes.data,
        issues: issuesRes.data ?? [],
        payments: paymentsRes.data ?? [],
        mous: mousRes.data ?? [],
        remarks: remarksRes.data ?? [],
      } as VendorContext;
    },
    enabled: !!vendorId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Context stats bar
// ---------------------------------------------------------------------------

function ContextStats({ ctx }: { ctx: VendorContext }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-border bg-muted/20 shrink-0">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Ticket className="w-3.5 h-3.5" />
            <span>{ctx.issues.length} issues</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="w-3.5 h-3.5" />
            <span>{ctx.payments.length} payments</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span>{ctx.mous.length} MOUs</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2 text-xs text-muted-foreground">
              {ctx.issues.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">Recent issues</p>
                  {ctx.issues.slice(0, 3).map((issue, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        issue.priority === "critical" ? "bg-destructive" :
                        issue.priority === "high" ? "bg-orange-500" :
                        issue.priority === "medium" ? "bg-warning" : "bg-success"
                      )} />
                      <span className="truncate">{issue.title}</span>
                      <Badge variant="outline" className="ml-auto text-[9px] shrink-0">{issue.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {ctx.payments.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-1">Recent payments</p>
                  {ctx.payments.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="capitalize">{p.payment_type?.replace("_", " ")}</span>
                      <span>PKR {p.amount?.toLocaleString()}</span>
                      <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

const msgVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2 } },
};

function AgentBubble({ msg, isThinking = false }: { msg: ConversationMessage; isThinking?: boolean }) {
  if (msg.role === "assistant") {
    return (
      <motion.div variants={msgVariants} className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          {isThinking ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0 max-w-[88%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">MOU Agent</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-primary/5 text-primary border-primary/20">AI</Badge>
            {!isThinking && (
              <span className="text-[10px] text-muted-foreground/70">
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className={cn(
            "rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed border",
            isThinking
              ? "bg-muted/50 border-border text-muted-foreground italic"
              : "bg-primary/5 border-primary/15 text-foreground"
          )}>
            {isThinking ? (
              <span className="flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/50 inline-block"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
                Analyzing vendor data…
              </span>
            ) : (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={msgVariants} className="flex items-start gap-2.5 flex-row-reverse">
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-[11px] bg-muted text-muted-foreground">You</AvatarFallback>
      </Avatar>
      <div className="max-w-[80%] items-end flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-row-reverse">
          <span className="text-xs font-medium text-foreground">You</span>
          <span className="text-[10px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className="rounded-xl bg-primary text-primary-foreground rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed">
          <span className="whitespace-pre-wrap">{msg.content}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS = [
  "Summarize this vendor's performance",
  "What issues are unresolved?",
  "Show me the payment history",
  "Are there any active MOUs expiring soon?",
  "What are the risk factors for this vendor?",
  "Has this vendor had recurring issues?",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface VendorAIAgentProps {
  vendorId: string;
  open: boolean;
  onClose: () => void;
}

export function VendorAIAgent({ vendorId, open, onClose }: VendorAIAgentProps) {
  const { user } = useAuth();
  const { data: ctx, isLoading: ctxLoading } = useVendorContext(vendorId);
  const { query: convQuery, saveMessage, clearHistory } = useVendorConversation(vendorId);
  const messages = convQuery.data ?? [];

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPlaceholder, setThinkingPlaceholder] = useState<ConversationMessage | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allMessages = [...messages, ...(thinkingPlaceholder ? [thinkingPlaceholder] : [])];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isThinking || !ctx) return;
    if (!isGroqConfigured()) {
      setAgentError("Groq API key not configured. Add VITE_GROQ_API_KEY to .env.");
      return;
    }

    setInput("");
    setAgentError(null);

    // Persist user message
    await saveMessage.mutateAsync({ role: "user", content: msg });

    // Show thinking bubble
    const placeholderId = `thinking-${Date.now()}`;
    setThinkingPlaceholder({
      id: placeholderId,
      vendor_id: vendorId,
      user_id: user!.id,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
    });
    setIsThinking(true);

    try {
      const systemPrompt = buildSystemPrompt(ctx);

      // Build history for multi-turn context (last 10 turns)
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: msg });

      const response = await chatWithGroq(systemPrompt, history, false);

      setThinkingPlaceholder(null);
      await saveMessage.mutateAsync({ role: "assistant", content: response });
    } catch (e: unknown) {
      setThinkingPlaceholder(null);
      const errMsg = e instanceof Error ? e.message : "Agent failed to respond";
      setAgentError(errMsg);
      toast.error(`MOU Agent: ${errMsg}`);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, ctx, messages, vendorId, user, saveMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const panelVariants = {
    hidden: { opacity: 0, x: 40, scale: 0.97 },
    visible: { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.7 } },
    exit: { opacity: 0, x: 32, scale: 0.97, transition: { duration: 0.18, ease: "easeIn" } },
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <>
          <motion.div
            key="vendor-agent-backdrop"
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]"
            variants={backdropVariants}
            initial="hidden" animate="visible" exit="exit"
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            key="vendor-agent-panel"
            className="fixed top-0 right-0 bottom-0 z-[60] w-full max-w-[480px] bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden"
            variants={panelVariants}
            initial="hidden" animate="visible" exit="exit"
            role="complementary"
            aria-label="MOU Agent — Vendor Intelligence"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Brain className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    MOU Agent
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">AI</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ctxLoading ? "Loading vendor data…" : ctx ? ctx.vendor.name : "Vendor intelligence"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-8 text-xs gap-1.5 text-muted-foreground"
                    onClick={() => clearHistory.mutate()}
                    disabled={clearHistory.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Clear
                  </Button>
                )}
                <div className="flex items-center gap-1 text-[10px] text-success mr-1">
                  <Database className="w-3 h-3" />
                  <span>Saved</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Vendor context bar */}
            {ctx && !ctxLoading && <ContextStats ctx={ctx} />}
            {ctxLoading && (
              <div className="px-4 py-3 border-b border-border shrink-0 space-y-1.5">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              {convQuery.isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                      <Skeleton className="h-14 flex-1 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : allMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center text-muted-foreground">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Ask about this vendor</p>
                    <p className="text-xs mt-1 max-w-xs leading-relaxed">
                      I have full context — issues, payments, MOUs, and team remarks. Conversation history is saved.
                    </p>
                  </div>
                  {/* Suggested prompts */}
                  <div className="w-full space-y-1.5 pt-2">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors"
                        onClick={() => handleSend(prompt)}
                        disabled={isThinking || ctxLoading}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <motion.div
                  initial="hidden" animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                  className="space-y-4 pb-2"
                >
                  <AnimatePresence initial={false}>
                    {allMessages.map((msg) => (
                      <AgentBubble
                        key={msg.id}
                        msg={msg}
                        isThinking={msg.id.startsWith("thinking-")}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Error banner */}
            <AnimatePresence>
              {agentError && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mx-5 mb-2 flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{agentError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Suggested prompts (when conversation active) */}
            {messages.length > 0 && messages.length < 3 && (
              <div className="px-5 pb-2 flex gap-2 flex-wrap">
                {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border hover:bg-accent hover:border-primary/30 transition-colors text-muted-foreground"
                    onClick={() => handleSend(p)}
                    disabled={isThinking}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-5 pb-5 pt-3 border-t border-border shrink-0">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about payments, issues, MOUs, risks…"
                  className="min-h-[76px] max-h-32 resize-none text-sm pr-12"
                  disabled={isThinking || ctxLoading || !ctx}
                />
                <Button
                  size="icon"
                  className="absolute right-2 bottom-2 h-8 w-8"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isThinking || ctxLoading || !ctx}
                  aria-label="Send"
                >
                  {isThinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Ctrl+Enter to send · History saved per vendor</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
