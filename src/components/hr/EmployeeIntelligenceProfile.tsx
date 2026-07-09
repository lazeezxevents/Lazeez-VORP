import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  TrendingUp, 
  Award, 
  Clock, 
  Activity, 
  Target, 
  Zap, 
  ShieldCheck,
  BrainCircuit,
  Users
} from "lucide-react";
import { 
  ResponsiveContainer, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis 
} from "recharts";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";
import { cn } from "@/lib/utils";

interface EmployeeIntelligenceProfileProps {
  employee: EmployeeKPI | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeIntelligenceProfile({ 
  employee, 
  isOpen, 
  onOpenChange 
}: EmployeeIntelligenceProfileProps) {
  if (!employee) return null;

  const radarData = [
    { subject: 'Output', A: employee.outputScore, fullMark: 100 },
    { subject: 'Efficiency', A: employee.efficiencyScore, fullMark: 100 },
    { subject: 'Quality', A: employee.qualityScore, fullMark: 100 },
    { subject: 'Reliability', A: employee.reliabilityScore, fullMark: 100 },
    { subject: 'Behavioral', A: employee.behavioralScore, fullMark: 100 },
    { subject: 'Contextual', A: employee.contextualScore, fullMark: 100 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-slate-950/95 border-slate-800 text-slate-100 backdrop-blur-2xl p-0 overflow-hidden rounded-[32px]">
        <div className="relative">
          {/* Header Background Gradient */}
          <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent -z-10" />
          
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Profile Bar */}
              <div className="flex flex-col items-center gap-4 text-center md:text-left md:items-start shrink-0">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-emerald-500 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500" />
                  <Avatar className="w-32 h-32 border-4 border-slate-950 relative">
                    <AvatarImage src={employee.avatarUrl || ""} />
                    <AvatarFallback className="text-3xl bg-slate-900">{employee.fullName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold font-montserrat tracking-tight">{employee.fullName}</h2>
                  <p className="text-slate-400 font-medium">{employee.designation || "Staff Member"}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px] rounded-full px-3">
                      {employee.department}
                    </Badge>
                    <Badge variant="outline" className="border-slate-800 text-slate-400 text-[10px] rounded-full px-3">
                      {employee.role}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Intelligence Overview */}
                <Card className="bg-slate-900/50 border-slate-800/50 rounded-3xl overflow-hidden backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <BrainCircuit className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-sm tracking-widest uppercase text-slate-400">Intelligence Matrix</h3>
                    </div>
                    
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#334155" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="KPIs"
                            dataKey="A"
                            stroke="#ed004f"
                            fill="#ed004f"
                            fillOpacity={0.4}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Key Metrics */}
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <MetricIconCard 
                        icon={TrendingUp} 
                        label="Performance" 
                        value={`${employee.performanceScore}%`} 
                        trend={employee.trend} 
                      />
                      <MetricIconCard 
                        icon={Zap} 
                        label="Output" 
                        value={`${employee.outputScore}%`} 
                      />
                      <MetricIconCard 
                        icon={Target} 
                        label="Efficiency" 
                        value={`${employee.efficiencyScore}%`} 
                      />
                      <MetricIconCard 
                        icon={ShieldCheck} 
                        label="Quality" 
                        value={`${employee.qualityScore}%`} 
                      />
                   </div>

                   {/* Reporting Section */}
                   <Card className="bg-slate-900/40 border-slate-800/50 rounded-2xl border-dashed">
                     <CardContent className="p-4">
                       <div className="flex items-center gap-2 mb-3">
                         <Users className="w-4 h-4 text-emerald-500" />
                         <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Functional Reporting</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                           <Activity className="w-4 h-4 text-slate-400" />
                         </div>
                         <div className="flex flex-col">
                           <span className="text-sm font-bold">{employee.department} Manager</span>
                           <span className="text-[10px] text-slate-500 font-medium">Primary Supervisor</span>
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                </div>
              </div>
            </div>

            {/* AI Insights & History Placeholder */}
            <div className="mt-8 pt-8 border-t border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">AI Behavioral Insight</h4>
                  <p className="text-sm text-slate-400 leading-relaxed italic">
                    "Consistent high performance in task resolution with minimal revisions. Exhibits strong collaborative patterns particularly during peak MOU cycles."
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/80">Growth Retrospective</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Improvement in efficiency observed over the last quarter (+12%). Punctuality remains exceptional at 98.4%.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Recent Milestone</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Successfully completed the Vendor Audit Phase 2 with distinction from management.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricIconCard({ icon: Icon, label, value, trend }: any) {
  return (
    <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800/50 flex flex-col gap-2 group hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 transition-transform group-hover:scale-110">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        {trend && (
           <Badge variant="outline" className={cn(
             "text-[9px] h-4 px-1.5 border-none",
             trend === "up" ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
           )}>
             {trend === "up" ? "↑" : "↓"}
           </Badge>
        )}
      </div>
      <div className="mt-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-bold font-montserrat">{value}</p>
      </div>
    </div>
  );
}
