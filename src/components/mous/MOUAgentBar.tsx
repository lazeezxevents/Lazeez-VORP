import { useState, useRef, useEffect } from "react";
import {
  Mic, Send, Sparkles, X, Loader2, StopCircle,
  ChevronDown, Trash2, Bot, User, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { chatWithGroq, isGroqConfigured } from "@/lib/groqClient";
import { useVendors } from "@/hooks/useVendors";
import { useMOUVault, MOUVaultItem } from "@/hooks/useMOUVault";
import { useMOUs } from "@/components/hooks/useMOUs";

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

// ── Build rich context for the AI from live DB data ───────────────────────────
function buildSystemPrompt(
  vendors: any[],
  mous: any[],
  vaultItems: MOUVaultItem[]
): string {
  // ── Vendors summary ──
  const vendorLines = (vendors || []).map(v =>
    `• ${v.name} | Category: ${v.category} | Status: ${v.status} | Contact: ${v.contact_person || "N/A"} | Phone: ${v.phone || "N/A"} | City: ${v.city || "N/A"} | Rating: ${v.rating ?? "N/A"} | Commission: ${v.commission_percentage ?? "N/A"}% | Owner: ${v.owner_name || "N/A"}`
  ).join("\n");

  // ── MOUs summary ──
  const mouLines = (mous || []).map(m =>
    `• "${m.title}" | Vendor: ${(m.vendor as any)?.name || "N/A"} | Status: ${m.status} | Start: ${m.start_date || "N/A"} | End: ${m.end_date || "N/A"} | Has Doc: ${m.document_url ? "Yes" : "No"}`
  ).join("\n");

  // ── Vault Items summary ──
  const vaultLines = (vaultItems || []).map(v => {
    const terms = v.extracted_terms as any;
    return [
      `• "${v.document_name}" | Vendor: ${v.vendor?.name || "N/A"}`,
      `  - Extraction: ${v.extraction_status} (confidence: ${v.extraction_confidence ? Math.round(v.extraction_confidence * 100) + "%" : "N/A"})`,
      `  - Type: ${v.document_type} | Signed: ${v.signed_date || "Not recorded"}`,
      `  - Effective: ${v.effective_start_date || "N/A"} → ${v.effective_end_date || "N/A"}`,
      `  - Termination Notice: ${v.termination_notice_days ?? "N/A"} days`,
      `  - Auto-Renewal: ${v.has_auto_renewal ? "Yes" : "No"} | Renewal Period: ${v.renewal_period_days ?? "N/A"} days`,
      `  - Party 1: ${v.party_1_name || "N/A"} (${v.party_1_business || "N/A"})`,
      `  - Party 2: ${v.party_2_name || "N/A"} (${v.party_2_business || "N/A"})`,
      `  - Purpose: ${v.mou_purpose || "N/A"}`,
      terms ? `  - Extracted Terms: ${JSON.stringify(terms).substring(0, 400)}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  return `You are "MOU Agent", the AI assistant for the Lazeez Events vendor and MOU management platform.

You have REAL-TIME ACCESS to the following live database data. Use it to answer questions accurately and helpfully.

══════════════════════════════════════════
VENDORS IN SYSTEM (${(vendors || []).length} total):
══════════════════════════════════════════
${vendorLines || "No vendors found."}

══════════════════════════════════════════
MOUs (${(mous || []).length} total):
══════════════════════════════════════════
${mouLines || "No MOUs found."}

══════════════════════════════════════════
MOU VAULT - UPLOADED DOCUMENTS (${(vaultItems || []).length} total):
══════════════════════════════════════════
${vaultLines || "No vault documents found."}

══════════════════════════════════════════
INSTRUCTIONS:
══════════════════════════════════════════
1. Answer questions using the real data above. Never say "I don't have access" — you DO have access through the data above.
2. When asked about a vendor or MOU, find the matching entry in the data above and report it accurately.
3. If a Vault document extraction is "completed", report the extracted fields (dates, parties, purpose, etc.) directly.
4. If asked about a document not yet extracted, tell the user to go to MOU Vault tab → click AI Extract on the document card.
5. If the signed_date is missing/null, say "Signed date was not recorded or not extracted from the document yet."
6. Format dates as readable (e.g. "January 15, 2025"). Use bullet points for multiple items.
7. Be concise, friendly, and professional. Never return raw JSON.
8. Today's date is ${new Date().toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}.`;
}

// ── Offline fallback ───────────────────────────────────────────────────────────
function offlineReply(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("vault")) return "The MOU Vault stores all your uploaded MOU PDFs with AI-extracted terms. Switch to the 'MOU Vault & AI Extractions' tab to view them.";
  if (q.includes("extract") || q.includes("parse")) return "To extract data from an MOU PDF, go to the **MOU Vault** tab, upload the document, and click **AI Extract** on the document card.";
  if (q.includes("vendor")) return "All vendors are listed in the **Vendors** section of the sidebar. Each vendor can have MOUs and issues linked to them.";
  if (q.includes("expir") || q.includes("renew")) return "Check the **Expiration Tracker** tab inside MOU Vault to see documents expiring within 30 days.";
  return "I'm the MOU Agent. I can tell you about your vendors, MOUs, vault documents, and extracted contract details. What would you like to know?";
}

// ── Speech recognition types ──────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: { length: number; [i: number]: { [i: number]: { transcript: string } } };
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onstart: (e: Event) => void; onend: (e: Event) => void;
  onerror: (e: any) => void; onresult: (e: SpeechRecognitionEvent) => void;
}
declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
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
      content: "👋 Hi! I'm your **MOU Agent** with live access to all your vendors, MOUs, and vault documents.\n\nAsk me anything — vendor details, MOU terms, expiry dates, extracted contract info, and more!",
      timestamp: new Date(),
    },
  ]);

  // Live data
  const { data: vendors = [] } = useVendors();
  const { data: vaultItems = [] } = useMOUVault();
  const { mous = [] } = useMOUs();

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Focus on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Speech recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (e: SpeechRecognitionEvent) => {
      const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join("");
      setQuery(t);
    };
    recognitionRef.current.onerror = (e: any) => {
      setIsListening(false);
      if (e.error !== "no-speech") toast.error("Voice error: " + e.error);
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) { toast.error("Voice not supported"); return; }
    isListening ? recognitionRef.current.stop() : (setQuery(""), recognitionRef.current.start());
  };

  const handleSend = async () => {
    const text = query.trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setIsProcessing(true);

    // Build history for Groq (exclude welcome msg)
    const history = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: text });

    try {
      let reply: string;

      if (isGroqConfigured()) {
        // Build live context system prompt
        const systemPrompt = buildSystemPrompt(vendors, mous, vaultItems as MOUVaultItem[]);
        reply = await chatWithGroq(systemPrompt, history, false);
      } else {
        await new Promise(r => setTimeout(r, 400));
        reply = offlineReply(text);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      }]);
      onSuccess?.({ type: "chat_response", reply });
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Error: ${err?.message || "Something went wrong"}. Please try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearChat = () => setMessages([{
    id: "welcome-2",
    role: "assistant",
    content: "🔄 Chat cleared! I still have full access to all your vendor and MOU data. What would you like to know?",
    timestamp: new Date(),
  }]);

  // Render formatted message (bold, bullets, newlines)
  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i} className={line.startsWith("•") ? "block pl-2" : "block"}>
          {parts.map((p, j) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={j}>{p.slice(2, -2)}</strong>
              : <span key={j}>{p}</span>
          )}
        </span>
      );
    });
  };

  const dataReady = vendors.length > 0 || vaultItems.length > 0 || mous.length > 0;

  return (
    <div className={cn("relative w-full", className)}>
      {/* ── Trigger Bar ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
          "bg-white/70 dark:bg-card/70 backdrop-blur-md shadow-md text-left",
          isOpen
            ? "border-primary/50 shadow-primary/10"
            : "border-border/40 hover:border-primary/30 hover:shadow-lg"
        )}
      >
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary transition-all flex-shrink-0",
          !isOpen && "animate-pulse"
        )}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">MOU Agent</p>
          <p className="text-xs text-muted-foreground truncate">
            {isOpen
              ? `Live data: ${vendors.length} vendors · ${mous.length} MOUs · ${vaultItems.length} vault docs`
              : "Ask anything about vendors, MOUs, contract terms, extraction results..."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dataReady && (
            <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-full font-medium border border-success/20">
              ● Live
            </span>
          )}
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
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <Card className="flex flex-col shadow-2xl border-primary/20 bg-white/98 dark:bg-card/98 backdrop-blur-xl overflow-hidden"
            style={{ height: "500px" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">MOU Agent</p>
                  <p className="text-[10px] text-success">
                    ● {isGroqConfigured() ? `Groq AI · ${vendors.length} vendors · ${vaultItems.length} vault docs` : "Offline Mode"}
                  </p>
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2.5 animate-fade-in",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary border border-primary/20"
                  )}>
                    {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={cn(
                    "max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/50 text-foreground rounded-tl-sm border border-border/30"
                  )}>
                    <div className="space-y-0.5">{renderContent(msg.content)}</div>
                    <p className={cn(
                      "text-[10px] mt-1.5",
                      msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing dots */}
              {isProcessing && (
                <div className="flex gap-2.5 animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/50 border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts (shown only at start) */}
            {messages.length <= 2 && !isProcessing && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
                {[
                  "What vendors do we have?",
                  "Show MOUs in vault",
                  "Any expiring soon?",
                  "Haider Kitchen MOU details",
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setQuery(prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-muted/40 hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-3 border-t border-border/40 bg-background/50 flex-shrink-0">
              <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-1.5 border border-border/30 focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-card transition-all">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={isListening ? "🎙 Listening..." : "Ask about vendors, MOUs, extracted terms..."}
                  className={cn(
                    "flex-1 border-none bg-transparent focus-visible:ring-0 text-sm h-8 px-0",
                    isListening && "placeholder:text-primary"
                  )}
                  disabled={isProcessing}
                />
                <Button size="icon" variant="ghost" onClick={toggleListening}
                  className={cn("h-7 w-7 rounded-lg transition-all",
                    isListening ? "text-destructive bg-destructive/10 animate-pulse" : "text-muted-foreground hover:text-primary")}>
                  {isListening ? <StopCircle className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" disabled={!query.trim() || isProcessing} onClick={handleSend}
                  className={cn("h-7 w-7 rounded-lg transition-all",
                    query.trim() && !isProcessing ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground")}>
                  {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                Enter to send · Live data context · Session memory only
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
