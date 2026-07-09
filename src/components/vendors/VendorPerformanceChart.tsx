import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, DollarSign, ShoppingCart, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { useVendorRevenueTrend } from "@/components/hooks/useVendorPayments";
import { useVendorStats } from "@/components/hooks/useVendors";
import { Skeleton } from "@/components/ui/skeleton";

interface VendorPerformanceChartProps {
    vendorId: string;
}

export function VendorPerformanceChart({ vendorId }: VendorPerformanceChartProps) {
    const { data: trend, isLoading: trendLoading } = useVendorRevenueTrend(vendorId);
    const { data: stats, isLoading: statsLoading } = useVendorStats(vendorId);

    if (trendLoading || statsLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm md:col-span-2">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[250px] w-full" />
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full" />
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasTrendData = trend && trend.some(d => d.revenue > 0 || d.orders > 0);
    const hasIssueData = stats && stats.totalIssues > 0;

    const issueData = [
        { name: "Open/Progress", value: stats?.openIssues || 0, fill: "hsl(var(--warning))" },
        { name: "Resolved/Closed", value: stats?.resolvedIssues || 0, fill: "hsl(var(--success))" }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm overflow-hidden md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            Revenue Trend
                        </CardTitle>
                        <CardDescription className="text-xs">Net monthly revenue for the last 6 months</CardDescription>
                    </div>
                    <div className="p-2 bg-primary/10 rounded-full">
                        <DollarSign className="w-4 h-4 text-primary" />
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[250px] w-full">
                        {hasTrendData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trend}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        tickFormatter={(value) => `₨${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value: number) => [`₨ ${value.toLocaleString()}`, 'Net Revenue']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRev)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-50">
                                <TrendingUp className="w-10 h-10" />
                                <p className="text-sm italic">No payment history found to generate trend.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-emerald-500" />
                            Monthly Orders
                        </CardTitle>
                        <CardDescription className="text-xs">Order volume for the last 6 months</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[200px] w-full">
                        {hasTrendData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                        dy={10}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                        formatter={(value: number) => [value, 'Orders']}
                                    />
                                    <Bar dataKey="orders" fill="hsl(var(--emerald-500))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-50">
                                <ShoppingCart className="w-8 h-8" />
                                <p className="text-sm italic">No order data available.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30">
                    <div className="space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-warning" />
                            Issue Status
                        </CardTitle>
                        <CardDescription className="text-xs">Distribution of vendor issue statuses</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[200px] w-full">
                        {hasIssueData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={issueData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={70}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {issueData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--background))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 opacity-50">
                                <Activity className="w-8 h-8" />
                                <p className="text-sm italic">No issue data mapped to this vendor.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
