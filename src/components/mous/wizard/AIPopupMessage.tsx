
import React, { useEffect, useState } from 'react';
import { Bot, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AIPopupMessageProps {
    message?: string;
}

export const AIPopupMessage: React.FC<AIPopupMessageProps> = ({ message }) => {
    const [isVisible, setIsVisible] = useState(false);
    const { profile, user } = useAuth();

    const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

    useEffect(() => {
        if (!message) return;

        // Show immediately when message changes
        setIsVisible(true);

        // Hide after 5 seconds
        const hideTimer = setTimeout(() => {
            setIsVisible(false);
        }, 5000);

        return () => {
            clearTimeout(hideTimer);
        };
    }, [message]);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 right-8 z-[60] animate-in fade-in slide-in-from-right-8 duration-700">
            <div className="relative bg-white rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-zinc-100 flex items-start gap-4 max-w-sm overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-secondary/10 blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />

                {/* AI Icon */}
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <Bot className="w-7 h-7 text-white" />
                </div>

                <div className="relative space-y-1">
                    <h3 className="font-bold text-zinc-900 font-montserrat flex items-center gap-2">
                        Lazeez Assistant
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed font-poppins">
                        {message}
                    </p>
                </div>

                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute top-4 right-4 text-zinc-300 hover:text-zinc-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
