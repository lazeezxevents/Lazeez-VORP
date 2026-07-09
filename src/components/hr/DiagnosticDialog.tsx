import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Database,
    Mail,
    Zap,
    HardDrive,
    ShieldAlert,
    RefreshCw,
    AlertCircle,
    AlertTriangle,
    TrendingUp,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemHealth, DiagnosticStep, HealthStatus } from "@/hooks/useSystemHealth";
import { useNotificationUIPreferences } from "@/hooks/useNotificationUIPreferences";
import { playSound } from "@/components/utils/soundEffects";
import { motion } from "framer-motion";

interface DiagnosticDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DiagnosticDialog({ open, onOpenChange }: DiagnosticDialogProps) {
    const { status, steps, lastCheck, runCheck, metrics } = useSystemHealth();
    const { preferences: uiPrefs } = useNotificationUIPreferences();
    const [localProgress, setLocalProgress] = useState(0);

    // Play sound when dialog opens
    useEffect(() => {
        if (open && uiPrefs.enable_system_sounds) {
            playSound("diagnostic", { volume: uiPrefs.sound_volume });
        }
    }, [open, uiPrefs.enable_system_sounds, uiPrefs.sound_volume]);

    useEffect(() => {
        if (status === "checking") {
            setLocalProgress(prev => Math.min(prev + 10, 90));
        } else if (status === "healthy" || status === "error" || status === "degraded") {
            setLocalProgress(100);
        } else {
            setLocalProgress(0);
        }
    }, [status]);

    const allFinished = status === "healthy" || status === "error" || status === "degraded";
    const hasError = status === "error";
    const hasDegraded = status === "degraded";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] max-h-[90vh] bg-background/95 backdrop-blur-xl border-border/20 p-0 overflow-hidden rounded-[24px] flex flex-col">
                <div className="p-6 flex-1 overflow-y-auto">
                    <DialogHeader className="mb-6">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-primary/10">
                                    <ShieldAlert className="w-5 h-5 text-primary" />
                                </div>
                                <DialogTitle className="text-xl font-bold">System diagnostics</DialogTitle>
                            </div>
                            {allFinished && (
                                <Badge 
                                    variant="outline" 
                                    className={cn(
                                        "text-xs font-bold",
                                        hasError ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                        hasDegraded ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                        "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    )}
                                >
                                    {hasError ? "Critical" : hasDegraded ? "Degraded" : "Healthy"}
                                </Badge>
                            )}
                        </div>
                        <DialogDescription className="text-sm font-medium text-muted-foreground">
                             Health monitoring across all system components
                        </DialogDescription>
                    </DialogHeader>

                    {/* System Metrics */}
                    {allFinished && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid grid-cols-4 gap-3 mb-6 p-4 rounded-2xl bg-muted/30"
                        >
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                                    <span className="text-lg font-bold text-emerald-500">{metrics.uptime}%</span>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Uptime</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <Clock className="w-3 h-3 text-blue-500" />
                                    <span className="text-lg font-bold text-blue-500">{metrics.avgResponseTime}ms</span>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Latency</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <AlertCircle className="w-3 h-3 text-amber-500" />
                                    <span className="text-lg font-bold text-amber-500">{metrics.errorRate}%</span>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Errors</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <CheckCircle2 className="w-3 h-3 text-primary" />
                                    <span className="text-lg font-bold text-primary">{steps.filter(s => s.status === "success").length}/{steps.length}</span>
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Services</p>
                            </div>
                        </motion.div>
                    )}

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Analysis Progress</span>
                            <span className="text-xs font-bold text-primary">{localProgress}%</span>
                        </div>
                        <Progress value={localProgress} className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${localProgress}%` }} />
                        </Progress>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
                        {steps.map((step, idx) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.03 }}
                                className={cn(
                                    "p-3 rounded-xl border transition-all duration-300 flex flex-col",
                                    step.status === "success" ? "bg-emerald-500/5 border-emerald-500/10" :
                                        step.status === "error" ? "bg-rose-500/5 border-rose-500/10" :
                                            step.status === "warning" ? "bg-amber-500/5 border-amber-500/10" :
                                                step.status === "running" ? "bg-primary/5 border-primary/10 animate-pulse" :
                                                    "bg-muted/30 border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn(
                                        "p-1.5 rounded-lg shrink-0",
                                        step.status === "success" ? "bg-emerald-500/10 text-emerald-500" :
                                            step.status === "error" ? "bg-rose-500/10 text-rose-500" :
                                                step.status === "warning" ? "bg-amber-500/10 text-amber-500" :
                                                    "bg-muted text-muted-foreground"
                                    )}>
                                        <step.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <h4 className="text-xs font-bold text-foreground flex-1 truncate">{step.label}</h4>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {step.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                                        {step.status === "success" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                        {step.status === "error" && <XCircle className="w-3 h-3 text-rose-500" />}
                                        {step.status === "warning" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed mb-1">
                                    {step.errorMsg || step.description}
                                </p>
                                {step.details && (
                                    <p className="text-[9px] text-muted-foreground/70 font-medium">
                                        {step.details}
                                    </p>
                                )}
                                {step.responseTime && (
                                    <p className="text-[9px] font-bold text-muted-foreground mt-auto pt-2">
                                        {Math.round(step.responseTime)}ms
                                    </p>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="bg-muted/30 p-4 gap-2 flex sm:justify-between items-center px-6 border-t border-border/20 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {allFinished && !hasError && !hasDegraded && (
                            <div className="flex items-center gap-1.5 text-emerald-500">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">All systems operational</span>
                            </div>
                        )}
                        {hasDegraded && (
                            <div className="flex items-center gap-1.5 text-amber-500">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Performance degraded</span>
                            </div>
                        )}
                        {hasError && (
                            <div className="flex items-center gap-1.5 text-rose-500">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Critical issues detected</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!allFinished}
                            onClick={() => {
                                if (uiPrefs.enable_system_sounds) {
                                    playSound("refresh", { volume: uiPrefs.sound_volume });
                                }
                                runCheck();
                            }}
                            className="rounded-xl font-bold text-xs h-9 gap-2"
                        >
                            <RefreshCw className={cn("w-3 h-3", !allFinished && "animate-spin")} />
                            Re-run
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                if (uiPrefs.enable_system_sounds) {
                                    playSound("success", { volume: uiPrefs.sound_volume });
                                }
                                onOpenChange(false);
                            }}
                            className="rounded-xl font-bold text-xs h-9 px-6"
                        >
                            Done
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
