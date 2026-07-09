import { ChevronRight, Building2, Users, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DepartmentCardData {
    id: string;
    name: string;
    performance: number;
    output: number;
    efficiency: number;
    quality: number;
    reliability: number;
    employees: number;
}

interface DepartmentCardsProps {
    departments: DepartmentCardData[];
    onDeptSelect: (id: string) => void;
}

export function DepartmentCards({ departments, onDeptSelect }: DepartmentCardsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept, i) => (
                <Card
                    key={dept.id}
                    className="group cursor-pointer hover:shadow-2xl transition-all duration-500 border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm border border-border/20 animate-stagger-fade-in relative"
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => onDeptSelect(dept.id)}
                >
                    <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700",
                        dept.performance > 75 ? "bg-emerald-500" :
                            dept.performance > 50 ? "bg-blue-500" : "bg-amber-500")}
                    />
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-xl font-bold text-foreground/90 font-montserrat tracking-tight group-hover:text-primary transition-colors">{dept.name}</CardTitle>
                                <CardDescription className="text-[10px] font-medium text-primary/40 mt-1">Operational strategic unit</CardDescription>
                            </div>
                            <div className="p-2 bg-primary/5 rounded-xl text-primary border border-primary/10">
                                <Building2 className="w-5 h-5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-2">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-3">
                                <Users className="w-5 h-5 text-primary/60" />
                                <div>
                                    <p className="text-2xl font-bold text-foreground font-poppins tabular-nums">{dept.employees}</p>
                                    <p className="text-[9px] font-medium text-muted-foreground">Members</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <p className="text-[9px] font-medium text-muted-foreground mb-0.5">Output</p>
                                    <p className="text-sm font-bold text-foreground">{dept.output}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-medium text-muted-foreground mb-0.5">Efficiency</p>
                                    <p className="text-sm font-bold text-foreground">{dept.efficiency}%</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-1.5 font-medium text-[10px] text-muted-foreground/70">
                                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                                    Performance index
                                </div>
                                <span className="text-xs font-bold text-foreground">{dept.performance}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden ring-1 ring-inset ring-black/5">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        dept.performance > 75 ? "bg-emerald-500" :
                                            dept.performance > 50 ? "bg-blue-500" : "bg-rose-500"
                                    )}
                                    style={{ width: `${dept.performance}%` }}
                                />
                            </div>
                        </div>

                        <div className="pt-1 flex items-center justify-center gap-2 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
                            Explore intel <ChevronRight className="w-3 h-3" />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
