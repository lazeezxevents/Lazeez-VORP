import { TrendingUp, BarChart3, PieChart as PieChartIcon, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";

interface PerformanceTabProps {
    deptPerformanceData: {
        id: string;
        name: string;
        performance: number;
        output: number;
        efficiency: number;
        quality: number;
        reliability: number;
        employees: number;
    }[];
    perfDistribution: {
        name: string;
        value: number;
        fill: string;
    }[];
}

export function PerformanceTab({
    deptPerformanceData,
    perfDistribution
}: PerformanceTabProps) {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm border border-white/20">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg font-bold tracking-tight text-foreground">Department performance overview</CardTitle>
                        </div>
                        <CardDescription className="text-xs font-medium">Average performance scores by department</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 p-6">
                        <div className="h-[350px] w-full">
                            {deptPerformanceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={deptPerformanceData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 700 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fontWeight: 700 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800 }}
                                        />
                                        <Bar dataKey="performance" radius={[6, 6, 0, 0]} barSize={40}>
                                            {deptPerformanceData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.performance > 75 ? '#10b981' : entry.performance > 50 ? '#3b82f6' : '#ef4444'}
                                                    fillOpacity={0.8}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                    Insufficient data for performance tracking.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm border border-white/20">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <PieChartIcon className="w-5 h-5 text-primary" />
                            <CardTitle className="text-lg font-bold tracking-tight text-foreground">Performance distribution</CardTitle>
                        </div>
                        <CardDescription className="text-xs font-medium">Distribution of performance scores</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 p-6">
                        <div className="h-[300px] w-full">
                            {perfDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={perfDistribution}
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {perfDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                    Insufficient data for distribution analysis.
                                </div>
                            )}
                        </div>
                        <div className="mt-4 space-y-2">
                            {perfDistribution.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-[11px] font-bold">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                                        <span className="text-muted-foreground">{d.name}</span>
                                    </div>
                                    <span className="text-foreground">{d.value} Employees</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "Highest performance", value: "94%", label: "Dept avg", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    { title: "Performance growth", value: "1.2x", label: "vs previous month", icon: Award, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { title: "Performance stability", value: "98.2%", label: "Consistency", icon: PieChartIcon, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                    { title: "Growth potential", value: "High", label: "Future talent", icon: BarChart3, color: "text-amber-500", bg: "bg-amber-500/10" },
                ].map((s, i) => (
                    <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-card/50 border border-border/20">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className={cn("p-2.5 rounded-2xl group-hover:scale-110 transition-transform duration-500", s.bg, s.color)}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60">{s.title}</p>
                                <p className="text-xl font-bold text-foreground">{s.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
