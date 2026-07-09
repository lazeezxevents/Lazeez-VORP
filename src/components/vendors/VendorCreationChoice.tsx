import React, { useState, useEffect } from "react";
import { Bot, PenLine, Sparkles, ArrowRight, X, Zap, Shield, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VendorCreationChoiceProps {
    open: boolean;
    onClose: () => void;
    onChooseAI: () => void;
    onChooseManual: () => void;
}

export const VendorCreationChoice: React.FC<VendorCreationChoiceProps> = ({
    open,
    onClose,
    onChooseAI,
    onChooseManual,
}) => {
    const [mounted, setMounted] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => setMounted(true));
        } else {
            setMounted(false);
            setExiting(false);
        }
    }, [open]);

    const handleClose = () => {
        setExiting(true);
        setTimeout(() => {
            onClose();
            setExiting(false);
            setMounted(false);
        }, 300);
    };

    const handleChooseAI = () => {
        setExiting(true);
        setTimeout(() => {
            onChooseAI();
            setExiting(false);
            setMounted(false);
        }, 300);
    };

    const handleChooseManual = () => {
        setExiting(true);
        setTimeout(() => {
            onChooseManual();
            setExiting(false);
            setMounted(false);
        }, 300);
    };

    if (!open) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 flex items-center justify-center transition-all duration-500",
                mounted && !exiting ? "opacity-100" : "opacity-0"
            )}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={handleClose}
            />

            {/* Floating particles — uses app primary (hsl 342) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full opacity-20"
                        style={{
                            width: `${4 + i * 2}px`,
                            height: `${4 + i * 2}px`,
                            left: `${15 + i * 14}%`,
                            top: `${20 + (i % 3) * 25}%`,
                            background: i % 2 === 0
                                ? "linear-gradient(135deg, hsl(342 100% 47%), hsl(344 96% 55%))"
                                : "linear-gradient(135deg, hsl(342 100% 60%), hsl(344 96% 41%))",
                            animation: `float-particle ${3 + i * 0.5}s ease-in-out infinite alternate`,
                            animationDelay: `${i * 0.3}s`,
                        }}
                    />
                ))}
            </div>

            {/* Main Content */}
            <div
                className={cn(
                    "relative z-10 w-full max-w-3xl mx-4 transition-all duration-500",
                    mounted && !exiting
                        ? "scale-100 translate-y-0"
                        : "scale-95 translate-y-8"
                )}
            >
                {/* Close */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClose}
                    className="absolute -top-12 right-0 text-white/60 hover:text-white hover:bg-white/10 rounded-full z-20 transition-all hover:rotate-90 duration-300"
                >
                    <X className="w-5 h-5" />
                </Button>

                {/* Header */}
                <div
                    className={cn(
                        "text-center mb-8 transition-all duration-700 delay-100",
                        mounted && !exiting
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4"
                    )}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/70 text-xs font-medium tracking-wider uppercase mb-4 backdrop-blur-sm font-poppins">
                        <Sparkles className="w-3 h-3" />
                        New MOU Creation
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight font-poppins">
                        How would you like to{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-rose-400 to-primary">
                            create
                        </span>
                        ?
                    </h2>
                    <p className="text-white/50 mt-2 text-sm max-w-md mx-auto font-poppins">
                        Choose your preferred method to create a new MOU
                    </p>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* AI Card — Animated Glow Border */}
                    <button
                        onClick={handleChooseAI}
                        className={cn(
                            "group relative rounded-2xl p-[2px] transition-all duration-700 delay-200 text-left ai-glow-card",
                            mounted && !exiting
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-8",
                            "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        {/* Animated glowing border */}
                        <div className="absolute inset-0 rounded-2xl bg-[length:400%_400%] animate-[glowBorder_4s_ease-in-out_infinite] bg-gradient-to-r from-primary via-rose-400 via-fuchsia-500 via-primary to-rose-400 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                        {/* Outer glow */}
                        <div className="absolute -inset-1.5 rounded-[1.2rem] bg-[length:400%_400%] animate-[glowBorder_4s_ease-in-out_infinite] bg-gradient-to-r from-primary via-rose-400 via-fuchsia-500 via-primary to-rose-400 blur-xl opacity-30 group-hover:opacity-60 transition-all duration-500" />

                        <div className="relative rounded-2xl bg-white p-7 h-full shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
                            {/* Recommended Badge */}
                            <div className="absolute -top-3 left-6">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-rose-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-lg shadow-primary/30 font-poppins">
                                    <Zap className="w-3 h-3" />
                                    Recommended
                                </span>
                            </div>

                            {/* Icon */}
                            <div className="relative mb-5 mt-2">
                                <div className="absolute -inset-3 bg-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500" />
                                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/50 transition-all duration-300 group-hover:scale-110">
                                    <Bot className="w-7 h-7 text-white" />
                                </div>
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-bold text-zinc-900 mb-2 font-poppins group-hover:text-primary transition-colors">
                                Create with Assistant
                            </h3>
                            <p className="text-zinc-500 text-sm leading-relaxed mb-5 font-poppins">
                                Let our automated assistant guide you through MOU creation with a streamlined workflow.
                            </p>

                            {/* Features */}
                            <div className="space-y-2.5 mb-6">
                                {[
                                    { icon: FileText, text: "Auto-generates MOU documents" },
                                    { icon: Shield, text: "Legal compliance built-in" },
                                    { icon: Clock, text: "Saves 80% of your time" },
                                ].map(({ icon: Icon, text }, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2.5 text-zinc-500 group-hover:text-zinc-700 transition-colors"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-3 h-3 text-primary" />
                                        </div>
                                        <span className="text-xs font-medium font-poppins">{text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all duration-300 font-poppins">
                                Start Wizard
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>
                    </button>

                    {/* Manual Card — White 3D Elevated */}
                    <button
                        onClick={handleChooseManual}
                        className={cn(
                            "group relative rounded-2xl p-[1px] transition-all duration-700 delay-300 text-left",
                            mounted && !exiting
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-8",
                            "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                    >
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-zinc-300/20 via-zinc-200/20 to-zinc-300/20 blur-xl opacity-0 group-hover:opacity-60 transition-all duration-500" />

                        <div className="relative rounded-2xl bg-white p-7 h-full shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)]  transition-shadow duration-300">
                            {/* Icon */}
                            <div className="relative mb-5">
                                <div className="absolute -inset-3 bg-zinc-300/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500" />
                                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center shadow-lg shadow-zinc-500/20 group-hover:shadow-zinc-400/40 transition-all duration-300 group-hover:scale-110">
                                    <PenLine className="w-7 h-7 text-white" />
                                </div>
                            </div>

                            {/* Content */}
                            <h3 className="text-xl font-bold text-zinc-900 mb-2 font-poppins group-hover:text-zinc-700 transition-colors">
                                Create Manually
                            </h3>
                            <p className="text-zinc-500 text-sm leading-relaxed mb-5 font-poppins">
                                Fill out the MOU details form yourself with full control over every field.
                            </p>

                            {/* Features */}
                            <div className="space-y-2.5 mb-6">
                                {[
                                    { icon: PenLine, text: "Full control over all fields" },
                                    { icon: Shield, text: "Custom configuration" },
                                    { icon: FileText, text: "Quick form-based entry" },
                                ].map(({ icon: Icon, text }, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2.5 text-zinc-500 group-hover:text-zinc-700 transition-colors"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-zinc-100 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-3 h-3 text-zinc-500" />
                                        </div>
                                        <span className="text-xs font-medium font-poppins">{text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <div className="flex items-center gap-2 text-zinc-600 font-semibold text-sm group-hover:gap-3 transition-all duration-300 font-poppins">
                                Open Form
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div
                    className={cn(
                        "text-center mt-6 transition-all duration-700 delay-500",
                        mounted && !exiting
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4"
                    )}
                >
                    <p className="text-white/30 text-xs font-poppins">
                        You can always switch between methods or edit details later
                    </p>
                </div>
            </div>

            <style>{`
         @keyframes float-particle {
           0% { transform: translateY(0px) rotate(0deg); }
           100% { transform: translateY(-30px) rotate(180deg); }
         }
         @keyframes glowBorder {
           0% { background-position: 0% 50%; }
           50% { background-position: 100% 50%; }
           100% { background-position: 0% 50%; }
         }
       `}</style>
        </div>
    );
};
