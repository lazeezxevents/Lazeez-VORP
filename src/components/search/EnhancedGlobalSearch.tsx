import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building, AlertCircle, FileText, Users, Target,
  Calendar, DollarSign, Briefcase, CheckSquare, TrendingUp,
  PlusCircle, FilePlus, ShieldCheck, Zap, Clock, Filter
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useVendors } from "@/hooks/useVendors";
import { useIssues } from "@/hooks/useIssues";
import { useMOUs } from "@/hooks/useMOUs";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedGlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedGlobalSearch({ open, onOpenChange }: EnhancedGlobalSearchProps) {
  const navigate = useNavigate();
  const { isAdmin, isStaff, isHR } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: vendors } = useVendors();
  const { data: issues } = useIssues();
  const { mous } = useMOUs();

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch tasks
  const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch teams (HR)
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("*, department:departments(name)").order("name");
      return data || [];
    },
    enabled: isHR || isAdmin,
  });

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
    enabled: isHR || isAdmin,
  });

  // Filter data based on search query
  const filteredVendors = useMemo(() => {
    if (!vendors || !searchQuery) return vendors?.slice(0, 10) || [];
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [vendors, searchQuery]);

  const filteredIssues = useMemo(() => {
    if (!issues || !searchQuery) return issues?.slice(0, 10) || [];
    return issues.filter(i => 
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.status?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [issues, searchQuery]);

  const filteredMOUs = useMemo(() => {
    if (!mous || !searchQuery) return mous?.slice(0, 10) || [];
    return mous.filter((m: any) => 
      m.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [mous, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!projects || !searchQuery) return projects?.slice(0, 10) || [];
    return projects.filter((p: any) => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [projects, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!tasks || !searchQuery) return tasks?.slice(0, 10) || [];
    return tasks.filter((t: any) => 
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [tasks, searchQuery]);

  const filteredTeams = useMemo(() => {
    if (!teams || !searchQuery) return teams?.slice(0, 10) || [];
    return teams.filter((t: any) => 
      t.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [teams, searchQuery]);

  const filteredDepartments = useMemo(() => {
    if (!departments || !searchQuery) return departments?.slice(0, 10) || [];
    return departments.filter((d: any) => 
      d.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [departments, searchQuery]);

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: 0.03
      }
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search everything: vendors, issues, projects, tasks, teams..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-[600px] overflow-y-auto">
        <CommandEmpty>
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
            <p className="font-semibold text-base">No results found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your search terms</p>
          </motion.div>
        </CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick actions">
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <QuickAction
              icon={PlusCircle}
              title="Add new vendor"
              subtitle="Create vendor profile"
              color="primary"
              onClick={() => { navigate("/vendors"); onOpenChange(false); }}
            />
            <QuickAction
              icon={AlertCircle}
              title="Log new issue"
              subtitle="Report a problem"
              color="amber"
              onClick={() => { navigate("/issues"); onOpenChange(false); }}
            />
            <QuickAction
              icon={FilePlus}
              title="Create new MOU"
              subtitle="Draft agreement"
              color="indigo"
              onClick={() => { navigate("/mous"); onOpenChange(false); }}
            />
            {isAdmin && (
              <QuickAction
                icon={ShieldCheck}
                title="User approvals"
                subtitle="Manage pending users"
                color="emerald"
                onClick={() => { navigate("/user-approvals"); onOpenChange(false); }}
              />
            )}
          </motion.div>
        </CommandGroup>

        {/* Vendors */}
        {filteredVendors && filteredVendors.length > 0 && (
          <CommandGroup heading={`Vendors (${filteredVendors.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredVendors.map((vendor) => (
                <SearchResultItem
                  key={vendor.id}
                  icon={Building}
                  title={vendor.name}
                  subtitle={vendor.category}
                  badge={vendor.status}
                  badgeColor={
                    vendor.status === "active" ? "success" :
                    vendor.status === "pending" ? "warning" : "muted"
                  }
                  onClick={() => { navigate(`/vendors/${vendor.id}`); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* Issues */}
        {filteredIssues && filteredIssues.length > 0 && (
          <CommandGroup heading={`Issues (${filteredIssues.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredIssues.map((issue) => (
                <SearchResultItem
                  key={issue.id}
                  icon={AlertCircle}
                  title={issue.title}
                  subtitle={issue.vendor?.name || "No vendor"}
                  badge={issue.priority}
                  badgeColor={
                    issue.priority === "critical" ? "destructive" :
                    issue.priority === "high" ? "warning" :
                    issue.priority === "medium" ? "info" : "success"
                  }
                  onClick={() => { navigate("/issues"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* Projects */}
        {filteredProjects && filteredProjects.length > 0 && (
          <CommandGroup heading={`Projects (${filteredProjects.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredProjects.map((project: any) => (
                <SearchResultItem
                  key={project.id}
                  icon={Briefcase}
                  title={project.name}
                  subtitle={project.description || "No description"}
                  badge={project.status}
                  badgeColor="info"
                  onClick={() => { navigate("/projects"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* Tasks */}
        {filteredTasks && filteredTasks.length > 0 && (
          <CommandGroup heading={`Tasks (${filteredTasks.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredTasks.map((task: any) => (
                <SearchResultItem
                  key={task.id}
                  icon={CheckSquare}
                  title={task.title}
                  subtitle={task.description || "No description"}
                  badge={task.status}
                  badgeColor="info"
                  onClick={() => { navigate("/projects"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* Teams (HR/Admin only) */}
        {(isHR || isAdmin) && filteredTeams && filteredTeams.length > 0 && (
          <CommandGroup heading={`Teams (${filteredTeams.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredTeams.map((team: any) => (
                <SearchResultItem
                  key={team.id}
                  icon={Users}
                  title={team.name}
                  subtitle={team.department?.name || "No department"}
                  onClick={() => { navigate("/hr-performance"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* Departments (HR/Admin only) */}
        {(isHR || isAdmin) && filteredDepartments && filteredDepartments.length > 0 && (
          <CommandGroup heading={`Departments (${filteredDepartments.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredDepartments.map((dept: any) => (
                <SearchResultItem
                  key={dept.id}
                  icon={Building}
                  title={dept.name}
                  subtitle={`${dept.employee_count || 0} employees`}
                  onClick={() => { navigate("/hr-performance"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}

        {/* MOUs */}
        {filteredMOUs && filteredMOUs.length > 0 && (
          <CommandGroup heading={`Agreements (${filteredMOUs.length})`}>
            <motion.div initial="hidden" animate="visible" variants={containerVariants}>
              {filteredMOUs.map((mou: any) => (
                <SearchResultItem
                  key={mou.id}
                  icon={FileText}
                  title={mou.title}
                  subtitle={mou.vendor?.name || "No vendor"}
                  badge={mou.status}
                  badgeColor={
                    mou.status === "active" ? "success" :
                    mou.status === "expired" ? "destructive" : "warning"
                  }
                  onClick={() => { navigate("/mous"); onOpenChange(false); }}
                />
              ))}
            </motion.div>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Quick Action Component
function QuickAction({ icon: Icon, title, subtitle, color, onClick }: any) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary hover:bg-primary/20",
    amber: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
    indigo: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 }
      }}
    >
      <CommandItem 
        onSelect={onClick}
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-all group cursor-pointer"
      >
        <motion.div 
          className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colorClasses[color as keyof typeof colorClasses])}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold truncate">{title}</span>
          <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
        </div>
      </CommandItem>
    </motion.div>
  );
}

// Search Result Item Component
function SearchResultItem({ icon: Icon, title, subtitle, badge, badgeColor, onClick }: any) {
  const badgeColorClasses = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    info: "bg-info/10 text-info border-info/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 }
      }}
    >
      <CommandItem
        onSelect={onClick}
        className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.div 
            className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Icon className="w-5 h-5" />
          </motion.div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold truncate">{title}</span>
            <span className="text-xs text-muted-foreground truncate">{subtitle}</span>
          </div>
        </div>
        {badge && (
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs h-6 px-2 font-medium capitalize flex-shrink-0 ml-2",
              badgeColorClasses[badgeColor as keyof typeof badgeColorClasses]
            )}
          >
            {badge}
          </Badge>
        )}
      </CommandItem>
    </motion.div>
  );
}
