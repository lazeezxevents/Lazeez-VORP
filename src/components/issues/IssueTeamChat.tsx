import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import {
  Send,
  Bot,
  User,
  Loader2,
  AtSign,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Issue } from "@/hooks/useIssues";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  author_name: string;
  author_email?: string;
  avatar_url?: string | null;
  content: string;
  created_at: string;
  is_ai?: boolean;
  is_thinking?: boolean;
}

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

function getInitials(name: string, email?: string): string {
  if (name && name !== "Unknown") {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email || "U").slice(0, 2).toUpperCase();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// @mention suggestion popup
// ---------------------------------------------------------------------------

interface MentionPopupProps {
  visible: boolean;
  onSelect: (mention: string) => void;
}

function MentionPopup({ visible, onSelect }: MentionPopupProps) {
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
            <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 text-primary border-primary/20">
              AI
            </Badge>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

const msgVariants = {
  hidden:  { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22 } },
};

interface MessageBubbleProps {
  msg: ChatMessage;
  isOwn: boolean;
}

function MessageBubble({ msg, isOwn }: MessageBubbleProps) {
  const initials = getInitials(msg.author_name, msg.author_email);

  if (msg.is_ai) {
    // Agent message — always left-aligned with special styling
    return (
      <motion.div variants={msgVariants} className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          {msg.is_thinking ? (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0 max-w-[85%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary">{CS_AGENT_NAME}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20 h-4">
              AI
            </Badge>
            {!msg.is_thinking && (
              <span className="text-[10px] text-muted-foreground/70">
                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
          <div
            className={cn(
              "rounded-xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed border",
              msg.is_thinking
                ? "bg-muted/50 border-border text-muted-foreground italic"
                : "bg-primary/5 border-primary/15 text-foreground"
            )}
          >
            {msg.is_thinking ? (
              <span className="flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/50 inline-block"
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

  // Human message
  return (
    <motion.div
      variants={msgVariants}
      className={cn("flex items-start gap-2.5", isOwn && "flex-row-reverse")}
    >
      <Avatar className="w-7 h-7 shrink-0 mt-0.5">
        <AvatarImage src={msg.avatar_url ?? undefined} alt={msg.author_name} />
        <AvatarFallback className="text-[11px] bg-muted text-muted-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[80%] min-w-0", isOwn && "items-end flex flex-col")}>
        <div
          className={cn(
            "flex items-center gap-2 mb-1",
            isOwn && "flex-row-reverse"
          )}
        >
          <span className="text-xs font-medium text-foreground">{msg.author_name}</span>
          <span
            className="text-[10px] text-muted-foreground/70"
            title={format(new Date(msg.created_at), "PPpp")}
          >
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
        </div>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted/60 border border-border text-foreground rounded-tl-sm"
          )}
        >
          {/* Highlight @cs-agent mentions */}
          <span className="whitespace-pre-wrap">
            {msg.content.split(/(@cs-agent)/gi).map((part, i) =>
              /^@cs-agent$/i.test(part) ? (
                <span key={i} className={cn("font-semibold", isOwn ? "text-primary-foreground/80" : "text-primary")}>
                  {part}
                </span>
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const thinkingMsgId = useRef<string | null>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAgentTyping]);

  // Detect @ key to show mention popup
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Show popup when user types "@" at the end or after a space
    const lastChar = value[value.length - 1];
    const beforeLastChar = value[value.length - 2];
    const shouldShow =
      lastChar === "@" && (beforeLastChar === undefined || beforeLastChar === " " || beforeLastChar === "\n");
    setShowMentionPopup(shouldShow);
  };

  const handleMentionSelect = (mention: string) => {
    // Replace trailing "@" with the full mention
    setInput((prev) => prev.slice(0, prev.lastIndexOf("@")) + mention + " ");
    setShowMentionPopup(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setShowMentionPopup(false);
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const callAIAgent = useCallback(
    async (userMessage: string, conversationHistory: ChatMessage[]) => {
      if (!isGroqConfigured()) {
        setAgentError("Groq API key not configured. Add VITE_GROQ_API_KEY to .env to enable the CS Agent.");
        return;
      }

      setIsAgentTyping(true);
      setAgentError(null);

      // Add a "thinking" placeholder
      const thinkId = generateId();
      thinkingMsgId.current = thinkId;
      setMessages((prev) => [
        ...prev,
        {
          id: thinkId,
          role: "agent",
          author_name: CS_AGENT_NAME,
          content: "",
          created_at: new Date().toISOString(),
          is_ai: true,
          is_thinking: true,
        },
      ]);

      try {
        // Build context for the agent
        const issueContext = `
Issue: "${issue.title}"
Status: ${issue.status}
Priority: ${issue.priority}
${issue.vendor?.name ? `Vendor: ${issue.vendor.name}` : ""}
${issue.description ? `Description: ${issue.description}` : ""}
${issue.assignee?.full_name ? `Assigned to: ${issue.assignee.full_name}` : ""}
`.trim();

        // Build conversation history for context (last 6 messages, skip thinking)
        const historyStr = conversationHistory
          .filter((m) => !m.is_thinking && m.content)
          .slice(-6)
          .map((m) => `${m.is_ai ? CS_AGENT_NAME : m.author_name}: ${m.content}`)
          .join("\n");

        const fullSystemPrompt = `${AGENT_SYSTEM_PROMPT}

Current Issue Context:
${issueContext}

Recent conversation:
${historyStr || "(no previous messages)"}`;

        const responseText = await callGroq(fullSystemPrompt, userMessage, false);

        // Replace thinking placeholder with actual response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkId
              ? {
                  ...m,
                  content: responseText,
                  created_at: new Date().toISOString(),
                  is_thinking: false,
                }
              : m
          )
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "CS Agent failed to respond";
        // Remove thinking placeholder
        setMessages((prev) => prev.filter((m) => m.id !== thinkId));
        setAgentError(msg);
        toast.error(`CS Agent: ${msg}`);
      } finally {
        setIsAgentTyping(false);
        thinkingMsgId.current = null;
      }
    },
    [issue]
  );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isAgentTyping) return;

    // Get current user info
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { data: profile } = authUser
      ? await supabase.from("profiles").select("full_name, email, avatar_url").eq("id", authUser.id).single()
      : { data: null };

    const authorName =
      profile?.full_name ||
      user?.email?.split("@")[0] ||
      "You";

    const newMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      author_name: authorName,
      author_email: profile?.email || user?.email,
      avatar_url: profile?.avatar_url,
      content: text,
      created_at: new Date().toISOString(),
      is_ai: false,
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput("");
    setShowMentionPopup(false);

    // Check if @cs-agent is mentioned
    if (text.toLowerCase().includes("@cs-agent")) {
      await callAIAgent(text, updatedMessages);
    }
  };

  const currentUserId = user?.id;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium text-foreground">Team Chat</span>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 h-4 px-1.5">
            @cs-agent available
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <AtSign className="w-3 h-3" />
          <span>Mention @cs-agent for AI help</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground py-8"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Team chat for this issue</p>
              <p className="text-xs mt-1 max-w-xs leading-relaxed">
                Discuss with your team. Type{" "}
                <span className="font-mono bg-muted px-1 py-0.5 rounded text-primary">@cs-agent</span>{" "}
                to ask the AI assistant for help.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-4"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={!msg.is_ai && (msg.author_email === user?.email)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Agent error banner */}
      <AnimatePresence>
        {agentError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mx-5 mb-2 flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2"
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{agentError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
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
            disabled={isAgentTyping}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={sendMessage}
            disabled={!input.trim() || isAgentTyping}
            aria-label="Send message"
          >
            {isAgentTyping ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Ctrl+Enter to send · @ to mention
        </p>
      </div>
    </div>
  );
}
