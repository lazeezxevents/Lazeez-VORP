import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Users,
  UserCircle2,
  Lock,
  Search
} from "lucide-react";
import { EmployeeKPI } from "@/hooks/useEmployeePerformance";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface OrgChartTabProps {
  employees: EmployeeKPI[];
  departments: any[];
  onEmployeeClick?: (employee: EmployeeKPI) => void;
}

export function OrgChartTab({ employees, departments, onEmployeeClick }: OrgChartTabProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["root"]));
  const [searchTerm, setSearchTerm] = useState("");

  const toggleNode = (id: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNodes(newSet);
  };

  // Build Hierarchy
  const hierarchy = departments.map(dept => {
    const deptEmployees = employees.filter(e => e.department === dept.name);
    const manager = employees.find(e => e.id === dept.manager_id);
    const regularEmployees = deptEmployees.filter(e => e.id !== dept.manager_id);
    
    return {
      id: dept.id,
      name: dept.name,
      manager: manager || null,
      employees: regularEmployees,
      totalCount: deptEmployees.length
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg font-montserrat tracking-tight">Organization Structure</h3>
            <p className="text-xs text-muted-foreground font-medium">Visualizing {employees.length} team members across {departments.length} departments</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search hierarchy..." 
            className="pl-9 rounded-xl border-border/50 focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="relative overflow-x-auto pb-12 pt-4">
        <div className="min-w-[800px] flex flex-col items-center">
            {/* Root Node */}
            <div className="flex flex-col items-center">
               <div className="p-4 px-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex items-center gap-4 z-10">
                 <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Lock className="w-6 h-6 text-primary-foreground" />
                 </div>
                 <div className="flex flex-col">
                   <h4 className="font-bold font-montserrat tracking-tight">Lazeez Events</h4>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Corporate Headquarters</p>
                 </div>
               </div>
               
               {/* Vertical Connector */}
               <div className="w-0.5 h-12 bg-gradient-to-b from-slate-800 to-slate-200 dark:to-slate-800" />
            </div>

            {/* Department Level */}
            <div className="flex gap-8 items-start relative px-12">
               {/* Horizontal Connector Line */}
               {hierarchy.length > 1 && (
                 <div className="absolute top-0 left-[150px] right-[150px] h-0.5 bg-slate-200 dark:bg-slate-800" />
               )}
               
               {hierarchy.map((dept, idx) => (
                 <div key={dept.id} className="flex flex-col items-center min-w-[300px]">
                    {/* Vertical connector to horizontal line */}
                    <div className="w-0.5 h-8 bg-slate-200 dark:bg-slate-800" />
                    
                    <motion.div 
                      layout
                      className={cn(
                        "w-full bg-card/80 backdrop-blur-md border rounded-3xl p-5 shadow-sm transition-all duration-300",
                        expandedNodes.has(dept.id) ? "border-primary/40 ring-1 ring-primary/5" : "border-border/50 hover:border-primary/20"
                      )}
                    >
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleNode(dept.id)}
                      >
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-border/50">
                             <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                           </div>
                           <div className="flex flex-col">
                             <h4 className="font-bold text-sm tracking-tight">{dept.name}</h4>
                             <Badge variant="secondary" className="text-[9px] h-4 py-0 w-fit">{dept.totalCount} members</Badge>
                           </div>
                        </div>
                        {expandedNodes.has(dept.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </div>

                      <AnimatePresence>
                        {expandedNodes.has(dept.id) && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-6 space-y-4">
                               {/* Manager */}
                               {dept.manager && (
                                 <div className="flex flex-col items-center">
                                   <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                                   <div 
                                     className="w-full flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-2xl cursor-pointer hover:bg-primary/10 transition-colors"
                                     onClick={() => onEmployeeClick?.(dept.manager!)}
                                   >
                                     <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                                       <AvatarImage src={dept.manager.avatarUrl || ""} />
                                       <AvatarFallback>{dept.manager.fullName?.substring(0,2)}</AvatarFallback>
                                     </Avatar>
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-xs font-bold truncate">{dept.manager.fullName}</span>
                                       <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">Department Head</span>
                                     </div>
                                   </div>
                                 </div>
                               )}

                               {/* Employees */}
                               <div className="grid grid-cols-1 gap-2 pt-2">
                                  {dept.employees.slice(0, 5).map(emp => (
                                    <div 
                                      key={emp.id}
                                      className="flex items-center gap-3 p-2 px-3 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors group"
                                      onClick={() => onEmployeeClick?.(emp)}
                                    >
                                      <Avatar className="w-7 h-7 border border-border/50 group-hover:border-primary/30 transition-colors">
                                        <AvatarImage src={emp.avatarUrl || ""} />
                                        <AvatarFallback className="text-[8px]">{emp.fullName?.substring(0,2)}</AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col min-w-0">
                                         <span className="text-[11px] font-semibold truncate group-hover:text-primary transition-colors">{emp.fullName}</span>
                                         <span className="text-[9px] text-muted-foreground truncate">{emp.designation || 'Specialist'}</span>
                                      </div>
                                    </div>
                                  ))}
                                  {dept.employees.length > 5 && (
                                    <div className="text-center pt-2">
                                      <Badge variant="outline" className="text-[8px] font-bold text-muted-foreground border-slate-800">+{dept.employees.length - 5} more members</Badge>
                                    </div>
                                  )}
                               </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                 </div>
               ))}
            </div>
        </div>
      </div>
    </div>
  );
}
