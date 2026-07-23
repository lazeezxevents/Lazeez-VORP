import { useState, useRef, useEffect } from "react";
import {
  Mic, Send, Sparkles, X, Loader2, StopCircle,
  MessageCircle, ChevronDown, Trash2, Bot, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { chatWithGroq, isGroqConfigured } from "@/lib/groqClient";

// ── System prompt ──────────────────────────────────────────────────────────────
const MOU_AGENT_SYSTEM_PROMPT = `You are "MOU Agent", an intelligent AI assistant for the Lazeez Events MOU (Memorandum of Understanding) Management System.

You help users with:
1. MOU document information (terms, parties, dates, renewal, termination clauses)
2. MOU status tracking and expiry alerts
3. Vendor management and lookup advice
4. Answering questions about any uploaded MOU in the Vault
5. General contract and MOU guidance

Guidelines:
- Be concise, friendly, and professional
- If asked to extract data from a PDF, explain the user should upload it in the MOU Vault tab and use the AI Extract button
- If asked about a specific MOU, ask for clarifying details (vendor name, signed date, etc.)
- Format dates as readable (e.g. "January 15, 2025")
- Bullet-point lists when showing multiple items
- Never return raw JSON to the user
- Always respond in natural conversational English`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MOUAgentBarProps {
  onSuccess?: (data: any) => void;
  className?: string;
}

// ── Speech recognition types ──────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onerror: (event: any) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
}
declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

// ── Offline keyword fallback ───────────────────────────────────────────────────
function offlineReply(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes("extract") || lower.includes("parse") || lower.includes("read"))
    return "To extract data from an MOU, go to **MOU Vault & AI Extractions** tab, upload your PDF, then click **AI Extract** on the document card. The Groq AI will automatically read the key terms!";
  if (lower.includes("expir") || lower.includes("renew"))
    return "You can track MOU expiry dates in the **Expiration Tracker** tab inside MOU Vault. Documents expiring within 30 days are flagged automatically.";
  if (lower.includes("vendor"))
    return "You can view and manage vendors from the **Vendors** menu in the sidebar. Each vendor can have multiple MOUs linked to them.";
  if (lower.includes("sign") || lower.includes("date"))
    return "Signed dates are stored per MOU. Once an MOU is uploaded and extracted, the signed date field is populated from the document text automatically.";
  return "I'm your MOU Agent! I can help you with MOU tracking, extraction, vendor queries, and contract guidance. What would you like to know?";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MOUAgentBar({ onSuccess, className }: MOUAgentBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "👋 Hi! I'm your **MOU Agent**. I can help you understand your MOU documents, check contract terms, track renewals, or answer any questions about vendors and agreements.\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Speech recognition setup
  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SR();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join("");
        setQuery(transcript);
      };
      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== "no-speech") toast.error("Voice error: " + event.error);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported in this browser."); return; }
    if (isListening) { recognitionRef.current.stop(); } else { setQuery(""); recognitionRef.current.start(); }
  };

  const handleSend = async () => {
    const text = query.trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setIsProcessing(true);

    // Build history for multi-turn (exclude the welcome message from history sent to Groq)
    const historyForGroq = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));
    historyForGroq.push({ role: "user", content: text });

    try {
      let reply: string;

      if (isGroqConfigured()) {
        reply = await chatWithGroq(MOU_AGENT_SYSTEM_PROMPT, historyForGroq, false);
      } else {
        // Small delay to simulate thinking
        await new Promise((r) => setTimeout(r, 400));
        reply = offlineReply(text);
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onSuccess?.({ type: "chat_response", reply });
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Sorry, I ran into an error: ${err?.message || "Unknown error"}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "👋 Chat cleared! I'm still here. What would you like to know about your MOUs?",
      timestamp: new Date(),
    }]);
  };

  // Format message content: bold **text**, newlines
  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : <span key={j}>{part}</span>
          )}
          {i < content.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* ── Trigger Bar ── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
          "bg-white/70 dark:bg-card/70 backdrop-blur-md shadow-md",
          isOpen
            ? "border-primary/50 shadow-primary/10"
            : "border-border/40 hover:border-primary/30 hover:shadow-lg"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary transition-all",
          !isOpen && "animate-pulse"
        )}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-foreground">MOU Agent</p>
          <p className="text-xs text-muted-foreground">
            {isOpen ? "Chat is open · click to minimize" : "Ask anything about your MOUs, contracts, or vendors..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {Math.min(messages.length - 1, 99)}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
        </div>
      </button>

      {/* ── Chat Panel ── */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 animate-fade-in">
          <Card className="flex flex-col shadow-2xl border-primary/20 bg-white/95 dark:bg-card/95 backdrop-blur-xl overflow-hidden"
            style={{ height: "480px" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">MOU Agent</p>
                  <p className="text-[10px] text-success">● {isGroqConfigured() ? "Powered by Groq AI" : "Offline Mode"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={clearChat} title="Clear chat">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5 animate-fade-in",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}>
                    {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  {/* Bubble */}
                  <div className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/60 text-foreground rounded-tl-sm border border-border/30"
                  )}>
                    {formatContent(msg.content)}
                    <p className={cn(
                      "text-[10px] mt-1.5",
                      msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isProcessing && (
                <div className="flex gap-2.5 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/60 border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="px-3 py-3 border-t border-border/40 bg-background/50">
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-1.5 border border-border/30 focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-card transition-all">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={isListening ? "🎙 Listening..." : "Ask about any MOU, vendor, or contract..."}
                  className={cn(
                    "flex-1 border-none bg-transparent focus-visible:ring-0 text-sm h-8 px-0",
                    isListening && "placeholder:text-primary"
                  )}
                  disabled={isProcessing}
                />
                <div className="flex items-center gap-1">
                  <Button
                    size="icon" variant="ghost"
                    onClick={toggleListening}
                    className={cn(
                      "h-7 w-7 rounded-lg transition-all",
                      isListening ? "text-destructive bg-destructive/10 animate-pulse" : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    {isListening ? <StopCircle className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    disabled={!query.trim() || isProcessing}
                    onClick={handleSend}
                    className={cn(
                      "h-7 w-7 rounded-lg transition-all",
                      query.trim() && !isProcessing
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isProcessing
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Send className="w-3.5 h-3.5" />
                    }
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Press Enter to send · Chat history is temporary (session only)
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
