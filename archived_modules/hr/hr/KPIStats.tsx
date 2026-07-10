import { Users, TrendingUp, Award, Clock, Target, UserCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KPIStatsProps {
    totalEmployees: number;
    avgPerformance: number;
    avgOutput: number;
    avgEfficiency: number;
    avgQuality: number;
    avgReliability: number;
}

export function KPIStats({
    totalEmployees,
    avgPerformance,
    avgOutput,
    avgEfficiency,
    avgQuality,
    avgReliability
}: KPIStatsProps) {
    const kpiCards = [
        { title: "Headcount", value: totalEmployees, label: "Total Workforce", icon: Users, color: "text-slate-600", bg: "bg-slate-900/5" },
        { title: "VORP Score", value: `${Math.round(avgPerformance * 1.05)}%`, label: "AI & Intelligence", icon: Target, color: "text-primary", bg: "bg-primary/5" },
        { title: "HR Performance", value: `${avgPerformance}%`, label: "Success Index", icon: Award, color: "text-blue-600", bg: "bg-blue-500/5" },
        { title: "Output", value: `${avgOutput}%`, label: "Task Execution", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/5" },
        { title: "Efficiency", value: `${avgEfficiency}%`, label: "Time Intel", icon: Clock, color: "text-amber-600", bg: "bg-amber-500/5" },
        { title: "Reliability", value: `${avgReliability}%`, label: "Attendance", icon: UserCheck, color: "text-indigo-600", bg: "bg-indigo-500/5" },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpiCards.map((stat, i) => (
                <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all animate-stagger-fade-in bg-card/40 backdrop-blur-sm border border-border/20" style={{ animationDelay: `${i * 50}ms` }}>
                    <CardContent className="p-4">
                        <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} w-fit mb-4 shadow-sm ring-1 ring-inset ring-black/5`}>
                            <stat.icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-2xl font-bold text-foreground font-montserrat tracking-tight">{stat.value}</h3>
                        <p className="text-[10px] font-medium text-muted-foreground tracking-wide mt-1.5 font-poppins">{stat.title}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-medium font-poppins mt-0.5">{stat.label}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
