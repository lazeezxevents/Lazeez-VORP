import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Play, Pause, Square, Timer, Clock, Coffee,
    Activity, Zap, Users, CircleDot
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTimeLogs, useTeamTimeLogs, useStartTimeEntry, useStopTimeEntry, TimeSummary } from "@/hooks/useTimeTracking";
import { useAuth } from "@/contexts/AuthContext";

interface TimeTrackingPanelProps {
    isStaff: boolean;
    isManager: boolean;
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function LiveTimer({ startTime }: { startTime: string }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startTime).getTime();
        const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;

    return (
        <span className="font-mono text-2xl font-bold text-primary tabular-nums tracking-wider">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </span>
    );
}

export function TimeTrackingPanel({ isStaff, isManager }: TimeTrackingPanelProps) {
    const { user } = useAuth();
    const { data: timeData, isLoading } = useTimeLogs();
    const { data: teamData } = useTeamTimeLogs(isManager && user?.id ? user.id : "");
    const startEntry = useStartTimeEntry();
    const stopEntry = useStopTimeEntry();

    const [description, setDescription] = useState("");
    const [logType, setLogType] = useState<"work" | "break" | "meeting" | "review">("work");

    const summary = timeData?.summary;
    const currentSession = summary?.currentSession;
    const isActive = !!currentSession;

    const handleStart = () => {
        startEntry.mutate({
            description: description || undefined,
            log_type: logType,
        });
        setDescription("");
    };

    const handleStop = () => {
        if (currentSession?.id) {
            stopEntry.mutate(currentSession.id);
        }
    };

    const summaryCards = [
        { label: "Total Time", value: formatDuration(summary?.totalMinutesToday || 0), icon: Clock, color: "text-primary bg-primary/10" },
        { label: "Active Work", value: formatDuration(summary?.activeMinutesToday || 0), icon: Activity, color: "text-emerald-500 bg-emerald-500/10" },
        { label: "Idle Time", value: formatDuration(summary?.idleMinutesToday || 0), icon: Zap, color: "text-amber-500 bg-amber-500/10" },
        { label: "Breaks", value: formatDuration(summary?.breakMinutesToday || 0), icon: Coffee, color: "text-blue-500 bg-blue-500/10" },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Timer className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg font-montserrat tracking-tight">Time Tracking</h3>
                        <p className="text-xs text-muted-foreground font-medium">Track work sessions, breaks, and meetings</p>
                    </div>
                </div>
                {isActive && (
                    <Badge variant="secondary" className="text-[10px] font-bold h-6 gap-1 bg-emerald-500/10 text-emerald-500 border-none animate-pulse">
                        <CircleDot className="w-3 h-3" /> Session Active
                    </Badge>
                )}
            </div>

            {/* Live Timer Card */}
            <Card className="border-none shadow-sm overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Timer Display */}
                        <div className="flex-1 flex flex-col items-center gap-4">
                            <div className={cn(
                                "w-32 h-32 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                                isActive
                                    ? "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
                                    : "border-muted-foreground/10 bg-muted/20"
                            )}>
                                {isActive && currentSession ? (
                                    <LiveTimer startTime={currentSession.start_time} />
                                ) : (
                                    <span className="font-mono text-2xl font-bold text-muted-foreground/40 tabular-nums">00:00:00</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {!isActive ? (
                                    <Button
                                        onClick={handleStart}
                                        disabled={startEntry.isPending}
                                        className="rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 px-6"
                                    >
                                        <Play className="w-4 h-4" />
                                        {startEntry.isPending ? "Starting..." : "Start Timer"}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleStop}
                                        disabled={stopEntry.isPending}
                                        variant="destructive"
                                        className="rounded-xl gap-2 shadow-lg shadow-rose-500/20 px-6"
                                    >
                                        <Square className="w-4 h-4" />
                                        {stopEntry.isPending ? "Stopping..." : "Stop Timer"}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Entry Form */}
                        <div className="flex-1 space-y-4 w-full md:w-auto">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Activity Type</Label>
                                <Select value={logType} onValueChange={(v: any) => setLogType(v)} disabled={isActive}>
                                    <SelectTrigger className="rounded-xl border-muted-foreground/20 h-10 text-xs font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="work">🏗️ Work</SelectItem>
                                        <SelectItem value="meeting">📅 Meeting</SelectItem>
                                        <SelectItem value="review">📝 Review</SelectItem>
                                        <SelectItem value="break">☕ Break</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">Description</Label>
                                <Input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="What are you working on?"
                                    className="rounded-xl border-muted-foreground/20 h-10 text-xs"
                                    disabled={isActive}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Today's Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summaryCards.map((card, i) => (
                    <Card key={i} className="border-none shadow-sm animate-stagger-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", card.color)}>
                                    <card.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-lg font-bold">{card.value}</p>
                                    <p className="text-[10px] text-muted-foreground font-medium">{card.label}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Time Entries */}
            <Card className="border-none shadow-sm">
                <CardContent className="p-0">
                    <div className="p-4 border-b border-border/50">
                        <h4 className="text-sm font-bold">Today's Entries</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground">
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Description</th>
                                    <th className="px-6 py-3">Start</th>
                                    <th className="px-6 py-3">End</th>
                                    <th className="px-6 py-3">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {(timeData?.logs || []).slice(0, 20).map(log => (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-3">
                                            <Badge variant="secondary" className="text-[10px] font-bold capitalize">
                                                {log.log_type}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-3 text-xs font-medium">{log.description || "—"}</td>
                                        <td className="px-6 py-3 text-xs text-muted-foreground">
                                            {new Date(log.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </td>
                                        <td className="px-6 py-3 text-xs">
                                            {log.end_time
                                                ? new Date(log.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                                : <Badge variant="outline" className="text-[9px] font-bold text-emerald-500 border-emerald-200 bg-emerald-50/50">Active</Badge>
                                            }
                                        </td>
                                        <td className="px-6 py-3 text-xs font-bold">
                                            {log.duration_minutes ? formatDuration(log.duration_minutes) : "—"}
                                        </td>
                                    </tr>
                                ))}
                                {(!timeData?.logs?.length) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm italic">
                                            No time entries for today. Start tracking!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Manager View: Team Time */}
            {isManager && teamData && teamData.length > 0 && (
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-4 border-b border-border/50 flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <h4 className="text-sm font-bold">Team Activity</h4>
                        </div>
                        <div className="divide-y divide-border/50">
                            {(teamData || []).map((member: any) => (
                                <div key={member.employee_id} className="p-4 flex items-center gap-4 hover:bg-muted/10 transition-colors">
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={member.employee_avatar || ""} />
                                        <AvatarFallback className="text-[10px]">{member.employee_name?.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">{member.employee_name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] text-muted-foreground">
                                                Total: <b className="text-foreground">{formatDuration(member.totalMinutesToday)}</b>
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                Idle: <b className="text-amber-500">{formatDuration(member.idleMinutesToday)}</b>
                                            </span>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className={cn(
                                        "text-[10px] font-bold",
                                        member.isOnline
                                            ? "bg-emerald-500/10 text-emerald-500"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        {member.isOnline ? "Online" : "Offline"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
