import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  Send, Bot, Loader2, AtSign, Sparkles, AlertTriangle, Database,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Issue } from "@/hooks/useIssues";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useIssueChatMessages,
  useSendChatMessage,
  IssueChatMessage,
} from "@/hooks/useIssueEnhancements";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CS_AGENT_MENTION = "@cs-agent";
const CS_AGENT_NAME = "CS Agent";

const AGENT_SYSTEM_PROMPT = `You are the CS Agent for Lazeez Events — a professional, concise customer success AI embedded in the issue tracking system.

When team members @mention you, respond helpfully based on the issue context provided.
- Keep responses focused and actionable
- Use bullet points for multi-step guidance
- Reference the specific issue title and details when relevant
- Flag if you need more information
- Suggest escalation paths when appropriate
- Be professional but approachable`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null | undefined, email?: string | null): string {
  if (name) return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (email || "U").slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// @mention popup
// ---------------------------------------------------------------------------

function MentionPopup({ visible, onSelect }: { visible: boolean; onSelect: (m: string) => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 mb-2 w-56 bg-popover border border-border rounded-xl shadow-xl z-10 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Mention</p>
          </div>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
            onClick={() => onSelect(CS_AGENT_MENTION)}
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">CS Agent</p>
              <p className="text-[11px] text-muted-foreground">AI-powered support agent</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 text-primary border-primary/20">AI</Badge>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Message bubble — works for both persisted DB messages and ephemeral "thinking"
// ---------------------------------------------------------------------------

interface ThinkingMsg {
  id: string;
  is_thinking: true;
  created_at: string;
}

const msgVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
};

function MessageBubble({
  msg,
  isOwn,
  isThinking = false,
}: {
  msg: IssueChatMessage;
  isOwn: boolean;
  isThinking?: boolean;
}) {
  const name = msg.user?.full_name || msg.user?.email?.split("@")[0] || "Team member";
  const initials = getInitials(msg.user?.full_name, msg.user?.email);

  if (msg.is_ai) {
    return (
      <motion.div variants={msgVariants} className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          {isThinking ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0 max-w-[85%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">{msg.ai_agent_name || CS_AGENT_NAME}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20 h-4">AI</Badge>
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
                CS Agent is thinking…
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
    <motion.div variants={msgVariants} className={cn("flex items-start gap-2.5", isOwn && "flex-row-reverse")}>
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarImage src={msg.user?.avatar_url ?? undefined} alt={name} />
        <AvatarFallback className="text-[11px] bg-muted text-muted-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] min-w-0", isOwn && "items-end flex flex-col")}>
        <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
          <span className="text-xs font-medium text-foreground">{name}</span>
          <span className="text-[10px] text-muted-foreground/70" title={format(new Date(msg.created_at), "PPpp")}>
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
        </div>
        <div className={cn(
          "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isOwn
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted/60 border border-border text-foreground rounded-tl-sm"
        )}>
          <span className="whitespace-pre-wrap">
            {msg.content.split(/(@cs-agent)/gi).map((part, i) =>
              /^@cs-agent$/i.test(part) ? (
                <span key={i} className={cn("font-semibold", isOwn ? "text-primary-foreground/80" : "text-primary")}>{part}</span>
              ) : (
                part
              )
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface IssueTeamChatProps {
  issue: Issue;
}

export function IssueTeamChat({ issue }: IssueTeamChatProps) {
  const { user } = useAuth();
  const { data: persistedMessages, isLoading } = useIssueChatMessages(issue.id);
  const sendMessage = useSendChatMessage(issue.id);

  const [input, setInput] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  // ephemeral "thinking" placeholder
  const [thinkingMsg, setThinkingMsg] = useState<IssueChatMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const allMessages: IssueChatMessage[] = [
    ...(persistedMessages ?? []),
    ...(thinkingMsg ? [thinkingMsg] : []),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, isAgentTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const last = value[value.length - 1];
    const prev = value[value.length - 2];
    setShowMentionPopup(last === "@" && (prev === undefined || prev === " " || prev === "\n"));
  };

  const handleMentionSelect = (mention: string) => {
    setInput((p) => p.slice(0, p.lastIndexOf("@")) + mention + " ");
    setShowMentionPopup(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { setShowMentionPopup(false); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
  };

  const callAIAgent = useCallback(async (userText: string) => {
    if (!isGroqConfigured()) {
      setAgentError("Groq API key not configured. Add VITE_GROQ_API_KEY to .env to enable the CS Agent.");
      return;
    }

    setIsAgentTyping(true);
    setAgentError(null);

    // Ephemeral thinking bubble
    const placeholderId = `thinking-${Date.now()}`;
    setThinkingMsg({
      id: placeholderId,
      issue_id: issue.id,
      user_id: user!.id,
      content: "",
      is_ai: true,
      ai_agent_name: CS_AGENT_NAME,
      metadata: null,
      created_at: new Date().toISOString(),
    });

    try {
      const issueContext = [
        `Issue: "${issue.title}"`,
        `Status: ${issue.status}`,
        `Priority: ${issue.priority}`,
        issue.vendor?.name ? `Vendor: ${issue.vendor.name}` : "",
        issue.description ? `Description: ${issue.description}` : "",
        issue.assignee?.full_name ? `Assigned to: ${issue.assignee.full_name}` : "",
      ].filter(Boolean).join("\n");

      const historyStr = (persistedMessages ?? [])
        .slice(-8)
        .map((m) => `${m.is_ai ? (m.ai_agent_name || CS_AGENT_NAME) : (m.user?.full_name || "User")}: ${m.content}`)
        .join("\n");

      const systemPrompt = `${AGENT_SYSTEM_PROMPT}\n\nCurrent Issue Context:\n${issueContext}\n\nRecent conversation:\n${historyStr || "(no previous messages)"}`;

      const responseText = await callGroq(systemPrompt, userText, false);

      setThinkingMsg(null);

      // Persist AI response
      await sendMessage.mutateAsync({ content: responseText, isAi: true, aiAgentName: CS_AGENT_NAME });
    } catch (e: unknown) {
      setThinkingMsg(null);
      const msg = e instanceof Error ? e.message : "CS Agent failed to respond";
      setAgentError(msg);
      toast.error(`CS Agent: ${msg}`);
    } finally {
      setIsAgentTyping(false);
    }
  }, [issue, persistedMessages, sendMessage, user]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isAgentTyping || sendMessage.isPending) return;
    setInput("");
    setShowMentionPopup(false);

    // Persist user message
    await sendMessage.mutateAsync({ content: text, isAi: false });

    if (text.toLowerCase().includes("@cs-agent")) {
      await callAIAgent(text);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Team Chat</span>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 h-4 px-1.5">
            @cs-agent available
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-success">
            <Database className="w-3 h-3" />
            <span>Persisted</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <AtSign className="w-3 h-3" />
          <span>@ to mention</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : allMessages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground py-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Team chat for this issue</p>
              <p className="text-xs mt-1 max-w-xs leading-relaxed">
                Messages are saved and shared with the whole team.{" "}
                Type <span className="font-mono bg-muted px-1 py-0.5 rounded text-primary">@cs-agent</span> for AI help.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-4"
          >
            <AnimatePresence initial={false}>
              {allMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={!msg.is_ai && msg.user_id === user?.id}
                  isThinking={msg.id.startsWith("thinking-")}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {agentError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="mx-5 mb-2 flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2"
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{agentError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-5 pb-5 pt-3 border-t border-border shrink-0">
        <div className="relative">
          <MentionPopup visible={showMentionPopup} onSelect={handleMentionSelect} />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the team… type @ to mention"
            className="min-h-[76px] max-h-32 resize-none text-sm pr-12"
            disabled={isAgentTyping || sendMessage.isPending}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSend}
            disabled={!input.trim() || isAgentTyping || sendMessage.isPending}
            aria-label="Send message"
          >
            {isAgentTyping || sendMessage.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Ctrl+Enter to send · @ to mention</p>
      </div>
    </div>
  );
}
