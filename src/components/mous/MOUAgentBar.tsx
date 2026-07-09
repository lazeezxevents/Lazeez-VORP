import { useState, useRef, useEffect } from "react";
import { Mic, Send, Sparkles, X, Loader2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callGroq, isGroqConfigured } from "@/lib/groqClient";

const AGENT_INTENT_PROMPT = `You are an intent classifier for the Lazeez Events MOU Management System.
Classify the user's query into one of these categories:
- "extraction_intent" → User wants to extract/parse data from an MOU document
- "tracking_intent" → User wants to track MOU status, expiry, renewals
- "suggestion" → User wants advice, recommendations, or has a general question
- "vendor_intent" → User wants to look up, add, or manage a vendor

Return ONLY this JSON:
{
  "type": "extraction_intent | tracking_intent | suggestion | vendor_intent",
  "message": "A helpful, concise response to the user's query",
  "suggested_action": "What the system should do next (brief)"
}`;

function offlineFallback(query: string): any {
  const lower = query.toLowerCase();
  if (lower.includes("extract") || lower.includes("parse") || lower.includes("read")) {
    return { type: "extraction_intent", message: "I'll extract the MOU data for you.", suggested_action: "open_extractor" };
  } else if (lower.includes("track") || lower.includes("expir") || lower.includes("status") || lower.includes("renew")) {
    return { type: "tracking_intent", message: "Let me check the MOU tracking dashboard.", suggested_action: "open_tracker" };
  } else if (lower.includes("vendor") || lower.includes("add") || lower.includes("create")) {
    return { type: "vendor_intent", message: "I'll help you manage vendors.", suggested_action: "open_vendors" };
  }
  return { type: "suggestion", message: "I can help with MOU extraction, tracking, and vendor management. Try asking about those!", suggested_action: "none" };
}

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
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
  onerror: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
}

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

interface MOUAgentBarProps {
  onSuccess?: (data: any) => void;
  className?: string;
}

export function MOUAgentBar({ onSuccess, className }: MOUAgentBarProps) {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recentAction, setRecentAction] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");
        setQuery(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          toast.error("Voice input failed: " + event.error);
        }
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setQuery("");
      recognitionRef.current.start();
    }
  };

  const handleProcess = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    setRecentAction("Analyzing your request...");

    try {
      let data: any;

      // Check if Groq is configured, otherwise use offline fallback
      if (isGroqConfigured()) {
        data = await callGroq(AGENT_INTENT_PROMPT, query, true);
      } else {
        // Offline keyword-based fallback
        data = offlineFallback(query);
      }

      if (data.type === "extraction_intent") {
        toast.success("MOU data parsed successfully!");
        onSuccess?.(data);
      } else if (data.type === "suggestion") {
        toast.info("Agent: " + data.message);
      } else if (data.type === "tracking_intent") {
        toast.info("Agent: " + data.message);
      } else if (data.type === "vendor_intent") {
        toast.info("Agent: " + data.message);
      }

      setQuery("");
      setRecentAction(null);
    } catch (error: any) {
      console.error("Agent error:", error);
      toast.error(error?.message || "Agent failed to process request");
      setRecentAction(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={cn("relative group w-full max-w-3xl mx-auto", className)}>
      <Card className="p-1 px-2 flex items-center gap-2 bg-white/70 backdrop-blur-md border-primary/20 shadow-lg group-focus-within:border-primary transition-all duration-300">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary animate-pulse-subtle">
          <Sparkles className="w-5 h-5" />
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleProcess()}
          placeholder={isListening ? "Listening..." : "Ask the MOU Agent (e.g., 'Extract terms from the new Mafhh PDF')"}
          className={cn(
            "flex-1 border-none bg-transparent focus-visible:ring-0 text-foreground placeholder:text-muted-foreground/60 h-12 text-base",
            isListening && "placeholder:text-primary animate-pulse"
          )}
          disabled={isProcessing}
        />

        <div className="flex items-center gap-1 pr-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setQuery("")}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleListening}
            className={cn(
              "h-9 w-9 transition-all duration-300",
              isListening ? "text-destructive bg-destructive/10 animate-pulse" : "text-muted-foreground hover:text-primary"
            )}
            title={isListening ? "Stop Listening" : "Voice Input"}
          >
            {isListening ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            disabled={!query.trim() || isProcessing}
            onClick={handleProcess}
            className={cn(
              "h-9 w-9 rounded-full transition-all duration-300 shadow-sm",
              query.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <Send className={cn("w-4 h-4", isProcessing && "animate-spin")} />
          </Button>
        </div>
      </Card>

      {/* Processing Status / Magic Labels */}
      <div className="absolute -bottom-7 left-4 flex gap-2">
        {isProcessing ? (
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] animate-fade-in py-0.5">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Agent is thinking...
          </Badge>
        ) : query.length > 5 ? (
          <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted animate-fade-in py-0.5">
            Press Enter to Magic-Process
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
