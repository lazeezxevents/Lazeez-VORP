
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardSplashScreenProps {
    onStart: () => void;
}

export const WizardSplashScreen: React.FC<WizardSplashScreenProps> = ({ onStart }) => {
    const [loading, setLoading] = useState(true);
    const [textIndex, setTextIndex] = useState(0);

    const loadingTexts = [
        "Initializing AI Agent...",
        "Loading Knowledge Base...",
        "Connecting to MOU Vault...",
        "System Ready."
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setTextIndex((prev) => {
                if (prev < loadingTexts.length - 1) return prev + 1;
                clearInterval(timer);
                setLoading(false);
                return prev;
            });
        }, 800);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950/50 to-zinc-950 animate-spin-slow duration-[20s]" />
            </div>

            <div className="relative z-10 flex flex-col items-center space-y-8 animate-fade-in">
                {/* Logo / Icon */}
                <div className="relative">
                    <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative bg-zinc-900 border border-indigo-500/30 p-6 rounded-2xl shadow-2xl">
                        <Sparkles className="w-12 h-12 text-indigo-400" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-indigo-200">
                        Lazeez <span className="text-indigo-500">AI</span> Architect
                    </h1>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto">
                        The next generation of contract generation.
                    </p>
                </div>

                {/* Status / Button */}
                <div className="h-16 flex items-center justify-center">
                    {loading ? (
                        <div className="flex items-center space-x-3 text-indigo-300 font-mono">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{loadingTexts[textIndex]}</span>
                        </div>
                    ) : (
                        <Button
                            onClick={onStart}
                            size="lg"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-8 py-6 text-lg font-medium shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(79,70,229,0.6)] animate-in fade-in zoom-in duration-300"
                        >
                            Initialize Wizard
                            <ChevronRight className="w-5 h-5 ml-2" />
                        </Button>
                    )}
                </div>

                {/* Terminal decorative footer */}
                <div className="absolute bottom-8 text-xs text-zinc-600 font-poppins flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                    <span>Secure Management Channel Active</span>
                </div>
            </div>
        </div>
    );
};
