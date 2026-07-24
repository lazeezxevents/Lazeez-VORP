
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User as UserIcon, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { chatWithGroq } from "@/lib/groqClient";
import { useAuth } from "@/contexts/AuthContext";

interface AICollectionLayerProps {
    onNext: (data: { conversation: Message[], rawData: any }) => void;
    category: string;
    template?: any;
}

export interface Message {
    id: string;
    sender: 'ai' | 'user';
    text: string;
}

const buildSystemPrompt = (category: string, template?: any): string => {
    let templateContext = "";
    if (template?.structure_json) {
        templateContext = `
        I have "LEARNED" this specific template structure from a sample upload:
        - Placeholders identified: ${JSON.stringify(template.structure_json)}
        - Text Context: ${(template.raw_text || "").substring(0, 500)}...
        PLEASE MAP THE USER DETAILS TO THESE IDENTIFIED PLACEHOLDERS.`;
    }

    return `You are a Conversational Legal Assistant for Lazeez Events.
    Your goal is to talk to the user naturally and collect/extract data for an MOU.
    
    Category: ${category}
    ${templateContext}

    MANDATORY FIELDS TO TRACK:
    1. owner_name
    2. cnic
    3. business_name
    4. phone (contact number)
    5. bank_details {title, iban, bank_name}
    6. menu (Array of products with name, quantity, price)
    7. address (complete physical address including city)
    8. city (extract from address if mentioned, e.g., "Karachi", "Lahore", "Islamabad")
    9. commission OR subscription {cost, threshold_orders}

    CRITICAL RULES:
    1. ALWAYS review the ENTIRE conversation history to extract ALL data mentioned so far.
    2. MERGE new information with previously extracted data - NEVER lose old data.
    3. When user asks to update a value (e.g., "change 5k to 4k"), identify what field they're referring to based on context and update ONLY that field.
    4. Record one final agreed price per menu item. Do not collect, calculate, or mention discounts.
    5. Be conversational but precise. Acknowledge updates clearly (e.g., "Updated subscription cost from 5000 to 4000").
    6. If user asks "what changed?", tell them specifically what you updated.
    7. Track commission as a percentage (e.g., 14 for 14%) and subscription as {cost: number, threshold_orders: number}.
    8. Extract city from address automatically (look for city names like Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, etc.)
    9. Phone number is MANDATORY - always ask for it if not provided.

    YOUR RESPONSE MUST:
    - Acknowledge what the user just said/asked
    - Confirm any updates made
    - Ask for next missing field OR confirm completion if all fields are filled
    - Be natural and professional (no robotic repetition)

    RESPONSE FORMAT (JSON ONLY):
    {
      "extracted_data": {
        "owner_name": "string or null",
        "cnic": "string or null",
        "business_name": "string or null",
        "phone": "string or null",
        "bank_details": {"title": "string or null", "iban": "string or null", "bank_name": "string or null"},
        "menu": [{"name": "string", "quantity": "string", "price": "string"}],
        "address": "string or null",
        "city": "string or null",
        "commission": "number or null",
        "subscription": {"cost": "number or null", "threshold_orders": "number or null"}
      },
      "response": "Your natural, helpful response to the user"
    }`;
};

export const AICollectionLayer: React.FC<AICollectionLayerProps> = ({ onNext, category, template }) => {
    const auth = useAuth();
    const userProfilePic = auth?.user?.user_metadata?.avatar_url || auth?.profile?.avatar_url || null;
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            sender: 'ai',
            text: `Excellent choice! To create the MOU for a ${category.replace('_', ' ')} business, I need the following information:

1. Owner Full Name
2. CNIC Copy of the Owner (Number or scan text)
3. Business Name
4. Phone Number (Contact)
5. Bank Details (Title and IBAN/Account Number)
6. Menu + minimum quantity + final agreed price (you can add unlimited items)
7. Complete Physical Address (including city)
8. Business Terms (Commission %, Subscription Cost, and Order Threshold)

You can provide these details one by one or all at once. I'm listening!`
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [extractedData, setExtractedData] = useState<any>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isAnalyzing) return;

        const userText = inputValue;
        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: userText };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInputValue("");
        setIsAnalyzing(true);

        try {
            // Build Groq conversation from our messages
            const groqMessages = updatedMessages.map((m) => ({
                role: m.sender === 'user' ? 'user' as const : 'model' as const,
                content: m.text,
            }));

            const systemPrompt = buildSystemPrompt(category, template);
            const result = await chatWithGroq(systemPrompt, groqMessages, true);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai', // Keep internal key for now, map in UI
                text: result.response || "I've noted that. What else can you tell me?"
            };
            setMessages(prev => [...prev, aiMsg]);

            if (result.extracted_data) {
                setExtractedData(result.extracted_data);
            }
        } catch (err: any) {
            console.error("AI Chat Error:", err);
            toast.error(err.message || "I'm having trouble connecting. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const currentProgress = () => {
        return {
            name: !!extractedData.owner_name,
            business: !!extractedData.business_name,
            cnic: !!extractedData.cnic,
            phone: !!extractedData.phone,
            bank: !!extractedData.bank_details?.iban,
            menu: Array.isArray(extractedData.menu) && extractedData.menu.length > 0,
            address: !!extractedData.address,
            terms: !!extractedData.commission || !!extractedData.subscription?.cost
        };
    };

    const progress = currentProgress();
    const allDone = Object.values(progress).every(v => v);

    return (
        <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-zinc-100 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="bg-zinc-50/50 p-6 border-b border-zinc-100 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-xl text-zinc-900 font-montserrat tracking-tight">Data Collection Layer</h3>
                        <p className="text-zinc-500 text-sm font-poppins mt-0.5">
                            {allDone ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-widest">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> All Data Points Collected
                                </span>
                            ) : (
                                `Required: ${Object.values(progress).filter(Boolean).length}/7 Data Points Captured`
                            )}
                        </p>
                    </div>
                    <div className="flex -space-x-1">
                        {Object.entries(progress).map(([key, done], i) => (
                            <div
                                key={key}
                                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center transition-all duration-500 ${done ? 'bg-emerald-500 text-white shadow-lg' : 'bg-zinc-100 text-zinc-400'
                                    }`}
                                title={key}
                            >
                                {done ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <span className="text-[10px] font-bold">{i + 1}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin scrollbar-thumb-zinc-200 bg-zinc-50/20">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-start gap-4 max-w-[85%]">
                            {msg.sender === 'ai' && (
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                            )}
                            <div className={`p-5 rounded-2xl leading-relaxed font-poppins text-sm ${msg.sender === 'user'
                                ? 'bg-primary text-white rounded-tr-none shadow-xl'
                                : 'bg-white text-zinc-700 rounded-tl-none border border-zinc-100 shadow-sm'
                                }`}>
                                <div className="whitespace-pre-wrap">{msg.text}</div>
                            </div>
                            {msg.sender === 'user' && (
                                userProfilePic ? (
                                    <img
                                        src={userProfilePic}
                                        alt="User profile"
                                        className="w-10 h-10 rounded-2xl object-cover border-2 border-zinc-300 shadow"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-2xl bg-zinc-200 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-6 h-6 text-zinc-600" />
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-white border-t border-zinc-100">
                <div className="flex flex-col gap-4">
                    <div className="flex gap-3 relative">
                        <Textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type or paste vendor details here..."
                            className="bg-zinc-50 border-zinc-200 text-zinc-900 focus-visible:ring-primary min-h-[90px] rounded-2xl px-5 py-4 resize-none shadow-inner font-poppins"
                        />
                        <Button
                            onClick={handleSend}
                            disabled={isAnalyzing || !inputValue.trim()}
                            size="icon"
                            className="absolute right-3 bottom-3 h-10 w-10 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg transition-all active:scale-95"
                        >
                            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-bold font-mono tracking-widest uppercase">
                            <div className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAnalyzing ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isAnalyzing ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                            </div>
                            <span>{isAnalyzing ? "Lazeez Assistant Processing..." : "Lazeez System Active"}</span>
                        </div>

                        <Button
                            onClick={() => onNext({ conversation: messages, rawData: extractedData })}
                            disabled={!allDone || isAnalyzing}
                            className={`rounded-full px-10 py-2.5 font-bold transition-all font-montserrat ${allDone
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20'
                                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                }`}
                        >
                            {allDone ? "Generate Certified MOU" : "Pending Information..."}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
