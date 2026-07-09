
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Send, Bot, User as UserIcon } from "lucide-react";

interface TermsNegotiationStepProps {
    onNext: (data: any) => void;
}

interface Message {
    id: string;
    sender: 'ai' | 'user';
    text: string;
    type?: 'text' | 'input';
    inputType?: 'number' | 'text' | 'select';
    field?: string;
}

export const TermsNegotiationStep: React.FC<TermsNegotiationStepProps> = ({ onNext }) => {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'ai', text: "Let's define the terms. First, what is the agreed commission percentage per order?", type: 'input', inputType: 'number', field: 'commission' }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [termsData, setTermsData] = useState<any>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputValue) return;

        // 1. Add User Message
        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputValue };
        const currentQuestion = messages[messages.length - 1];

        // Save data
        const newTermsData = { ...termsData, [currentQuestion.field || 'unknown']: inputValue };
        setTermsData(newTermsData);
        setMessages(prev => [...prev, userMsg]);
        setInputValue("");

        // 2. AI Response Logic (Simulation)
        setTimeout(() => {
            let nextQuestion: Message | null = null;

            if (currentQuestion.field === 'commission') {
                nextQuestion = {
                    id: Date.now().toString(),
                    sender: 'ai',
                    text: `Got it, ${inputValue}% commission. Now, what is the duration of this agreement (in months)?`,
                    type: 'input',
                    inputType: 'number',
                    field: 'duration'
                };
            } else if (currentQuestion.field === 'duration') {
                nextQuestion = {
                    id: Date.now().toString(),
                    sender: 'ai',
                    text: `Understood, ${inputValue} months. Just one last thing: Is there any upfront subscription fee? (Enter 0 if none)`,
                    type: 'input',
                    inputType: 'number',
                    field: 'subscription'
                };
            } else if (currentQuestion.field === 'subscription') {
                // Finished
                onNext({ terms: newTermsData }); // Proceed to next step immediately or show completion
                return;
            }

            if (nextQuestion) {
                setMessages(prev => [...prev, nextQuestion!]);
            }
        }, 800);
    };

    return (
        <div className="flex flex-col h-[500px] w-full max-w-2xl mx-auto bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="bg-zinc-900/50 p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">Terms Negotiation</h3>
                <div className="flex items-center gap-2 text-xs text-indigo-400">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    AI Agent Active
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex items-end gap-3 max-w-[80%]`}>
                            {msg.sender === 'ai' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`p-4 rounded-2xl ${msg.sender === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-zinc-800 text-zinc-200 rounded-bl-none border border-white/5'
                                }`}>
                                {msg.text}
                            </div>
                            {msg.sender === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                                    <UserIcon className="w-5 h-5 text-zinc-400" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-zinc-900 border-t border-white/10">
                <div className="flex gap-2 relative">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type your answer..."
                        className="bg-zinc-800 border-zinc-700 text-white focus-visible:ring-indigo-500 pr-12"
                        type={messages[messages.length - 1].inputType === 'number' ? "number" : "text"}
                        autoFocus
                    />
                    <Button
                        onClick={handleSend}
                        size="icon"
                        className="absolute right-1 top-1 h-8 w-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
