import {
    TrendingUp,
    History,
    Clock,
    ClipboardCheck,
    Wallet,
    Zap,
    Users,
    CalendarCheck,
    ShieldCheck,
    LineChart as LineChartIcon,
    PieChart as PieChartIcon,
    BarChart3,
    Target
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    ScatterChart,
    Scatter,
    ZAxis,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface DashboardTabProps {
    deptPerformanceData: any[];
    perfDistribution: any[];
    recentActivity: any[];
    totalEmployees: number;
    avgPerformance: number;
}

export function DashboardTab({
    deptPerformanceData,
    perfDistribution,
    recentActivity,
    totalEmployees,
    avgPerformance
}: DashboardTabProps) {

    const timeAgo = (date: string) => {
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch (e) {
            return "just now";
        }
    };

    // Advanced Dataset for Trend/Forecasting
    const trendData = [
        { name: "JAN", score: 65, forecast: 65, efficiency: 70 },
        { name: "FEB", score: 68, forecast: 68, efficiency: 72 },
        { name: "MAR", score: 75, forecast: 75, efficiency: 78 },
        { name: "APR", score: 82, forecast: 82, efficiency: 80 },
        { name: "MAY", score: 79, forecast: 79, efficiency: 85 },
        { name: "JUN", score: 88, forecast: 88, efficiency: 82 },
        { name: "JUL", score: 92, forecast: 92, efficiency: 90 },
        { name: "AUG", score: null, forecast: 95, efficiency: 92 }, // Future forecast
    ];

    // Scatter Plot Data: Output vs Efficiency
    const scatterData = deptPerformanceData.map(d => ({
        x: d.output || Math.random() * 40 + 60,
        y: d.efficiency || Math.random() * 40 + 60,
        z: d.employees * 10,
        name: d.name
    }));

    // Radar Data for Organization-wide Skills
    const radarData = [
        { subject: 'Execution', A: 85, B: 70, fullMark: 150 },
        { subject: 'Reliability', A: 90, B: 85, fullMark: 150 },
        { subject: 'Innovation', A: 75, B: 60, fullMark: 150 },
        { subject: 'Collaboration', A: 95, B: 80, fullMark: 150 },
        { subject: 'Technical', A: 80, B: 75, fullMark: 150 },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* High-Level Intelligence Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: "Attendance index", value: "98.2%", label: "System high", icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/5", subtext: "Punctuality: 94%" },
                    { title: "Appraisal cycle", value: "84%", label: "Completion", icon: ClipboardCheck, color: "text-blue-500", bg: "bg-blue-500/5", subtext: "12 pending reviews" },
                    { title: "Bonus allocation", value: "14.2M", label: "Estimated", icon: Wallet, color: "text-amber-500", bg: "bg-amber-500/5", subtext: "Next payout: Sept 30" },
                    { title: "Leave liquidity", value: "4.2%", label: "Active rate", icon: CalendarCheck, color: "text-rose-500", bg: "bg-rose-500/5", subtext: "8 staff on leave" },
                ].map((s, i) => (
                    <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white/40 backdrop-blur-sm border border-white/20">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className={cn("p-3 rounded-2xl group-hover:scale-110 transition-transform duration-500", s.bg, s.color)}>
                                    <s.icon className="w-5 h-5" />
                                </div>
                                <Badge variant="outline" className="text-[10px] font-bold border-muted-foreground/10 px-2">{s.label}</Badge>
                            </div>
                            <p className="text-[10px] font-medium text-muted-foreground tracking-wide mb-1 font-poppins">{s.title}</p>
                            <h3 className="text-3xl font-bold text-foreground font-montserrat tracking-tighter">{s.value}</h3>
                            <p className="text-[10px] mt-2 font-medium text-muted-foreground/60 flex items-center gap-1.5 font-poppins">
                                <Zap className="w-3 h-3 text-primary animate-pulse" /> {s.subtext}
                            </p>
                        </CardContent>
                    </Card>
                ))
                }
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Advanced Trend Chart - Corporate Growth Projection */}
                <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-md border border-white/20">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    <CardTitle className="text-2xl font-bold tracking-tight font-montserrat text-slate-900/90">Predictive performance index</CardTitle>
                                </div>
                                <CardDescription className="text-[10px] font-bold text-primary/40">Regression-based workforce analysis</CardDescription>
                            </div>
                            <div className="flex items-center gap-4 bg-muted/20 p-2 rounded-xl">
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary" /><span className="text-[10px] font-bold text-muted-foreground">Actual</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-primary/20" /><span className="text-[10px] font-bold text-muted-foreground/40">Forecast</span></div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ED004F" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#ED004F" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.03} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                        dy={15}
                                    />
                                    <YAxis hide domain={[50, 100]} />
                                    <Tooltip
                                        cursor={{ stroke: '#ED004F', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        contentStyle={{
                                            borderRadius: '20px',
                                            border: '1px solid rgba(237,0,79,0.1)',
                                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                                            padding: '16px',
                                            background: 'rgba(255,255,255,0.98)',
                                            backdropFilter: 'blur(8px)'
                                        }}
                                        itemStyle={{ fontWeight: 900, fontSize: '13px' }}
                                        labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.5 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke="#ED004F"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorActual)"
                                        animationDuration={2500}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="forecast"
                                        stroke="#ED004F"
                                        strokeWidth={2}
                                        strokeDasharray="8 8"
                                        fill="transparent"
                                        animationDuration={2500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Radar Chart - Skill Vector Distribution */}
                <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-md border border-border/20">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-primary" />
                            <CardTitle className="text-xl font-bold tracking-tight font-montserrat text-slate-900/90">Capability matrix</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold text-primary/40">Multi-vector force analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 flex items-center justify-center">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                    <PolarGrid strokeOpacity={0.1} />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
                                    />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} hide />
                                    <Radar
                                        name="Organization"
                                        dataKey="A"
                                        stroke="#ED004F"
                                        fill="#ED004F"
                                        fillOpacity={0.1}
                                        strokeWidth={3}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scatter Plot - Output vs Efficiency */}
                <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-md border border-border/20">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <CardTitle className="text-xl font-bold tracking-tight font-montserrat text-slate-900/90">Operational efficiency link</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold text-primary/40">Output vs internal efficiency correlation</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} opacity={0.03} />
                                    <XAxis
                                        type="number"
                                        dataKey="x"
                                        name="Output"
                                        unit="%"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="y"
                                        name="Efficiency"
                                        unit="%"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}
                                    />
                                    <ZAxis type="number" dataKey="z" range={[100, 1000]} name="Headcount" />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Scatter name="Departments" data={scatterData} fill="#ED004F" fillOpacity={0.6}>
                                        {scatterData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#ED004F', '#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#8b5cf6'][index % 6]} />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Intelligence Stream Activity */}
                <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-md border border-border/20">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-primary" />
                            <CardTitle className="text-xl font-bold tracking-tight font-montserrat text-foreground/90">Activity stream</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold text-primary/40">Real-time activity distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="space-y-6">
                            {recentActivity.length > 0 ? recentActivity.map((log, i) => (
                                <div key={log.id} className="flex items-center gap-4 transition-all group">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-900/5 flex items-center justify-center font-black text-xs text-slate-600 font-montserrat shadow-sm ring-1 ring-inset ring-black/5 group-hover:scale-105 transition-transform">
                                        {log.profiles?.full_name?.charAt(0) || "U"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <p className="text-xs font-bold text-foreground font-montserrat">{log.profiles?.full_name}</p>
                                            <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{timeAgo(log.logged_at)}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-medium truncate font-poppins">{log.action_details}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                    </div>
                                </div>
                            )) : (
                                <div className="p-8 text-center text-slate-400 italic text-sm font-bold font-poppins">No recent logs discovered.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Multi-Metric Force Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Execution Precision", value: "92%", color: "bg-emerald-500", icon: ShieldCheck },
                    { label: "Strategic Velocity", value: "88%", color: "bg-blue-500", icon: Target },
                    { label: "Resource Efficiency", value: "94%", color: "bg-amber-500", icon: Zap },
                    { label: "Talent Retention", value: "97%", color: "bg-primary", icon: Users },
                ].map((m, i) => (
                    <div key={i} className="bg-slate-900/5 p-5 rounded-[40px] border border-white/40 shadow-sm backdrop-blur-sm group hover:bg-white/60 transition-all">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] font-bold text-slate-400 font-poppins">{m.label}</span>
                            <m.icon className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-3xl font-bold text-slate-800 font-montserrat tracking-tighter">{m.value}</span>
                            <div className="w-16 h-1 w-full flex-1 ml-4 bg-slate-200 rounded-full overflow-hidden self-center">
                                <div className={cn("h-full rounded-full transition-all duration-1000", m.color)} style={{ width: m.value }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
