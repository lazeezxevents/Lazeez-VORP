
import React from 'react';
import { Bot, MessageSquare } from "lucide-react";

export const MOUAgentInterface = () => {
    return (
        <div className="bg-white border-l border-zinc-100 p-8 flex flex-col h-full w-96 text-zinc-900 font-poppins shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Bot className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-xl font-montserrat">Lazeez AI</h3>
                    <p className="text-xs text-zinc-400 font-medium tracking-wider uppercase font-poppins">Legal Architect</p>
                </div>
            </div>

            <div className="space-y-6 flex-1">
                <div className="bg-zinc-50 p-6 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm">
                    <p className="text-sm text-zinc-600 leading-relaxed font-poppins">
                        Hello! I'm here to help you craft the perfect MOU. Let's start by selecting the vendor category.
                        I'll guide you through every step to ensure legal compliance and professional branding.
                    </p>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-zinc-100">
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium font-poppins">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="tracking-wide">AI Agent System Ready</span>
                </div>
            </div>
        </div>
    );
};
