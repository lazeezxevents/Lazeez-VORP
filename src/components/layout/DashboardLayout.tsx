import { ReactNode, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { 
  Search, User, Settings, LogOut, UserCheck, PlusCircle, FilePlus, AlertCircle, 
  Building, FileText, Layout, Settings as SettingsIcon, ShieldCheck, Users, 
  Briefcase, CheckSquare, Target, TrendingUp, Zap
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useVendors } from "@/hooks/useVendors";
import { useIssues } from "@/hooks/useIssues";
import { useMOUs } from "@/hooks/useMOUs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { user, profile, signOut, isAdmin, isStaff, isManager } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Check if the user is a manager or leader
  const canSeeInternalLogs = isAdmin || isStaff || isManager;

  const { data: vendors } = useVendors();
  const { data: issues } = useIssues();
  const { mous, isLoading: mousLoading } = useMOUs();

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


  // Filter data based on search query
  const filteredVendors = useMemo(() => {
    if (!vendors || !searchQuery) return vendors || [];
    return vendors.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vendors, searchQuery]);

  const filteredIssues = useMemo(() => {
    if (!issues || !searchQuery) return issues || [];
    return issues.filter(i => 
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [issues, searchQuery]);

  const filteredMOUs = useMemo(() => {
    if (!mous || !searchQuery) return mous || [];
    return mous.filter((m: any) => 
      m.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [mous, searchQuery]);

  const filteredProjects = useMemo(() => {
    if (!projects || !searchQuery) return projects || [];
    return projects.filter((p: any) => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!tasks || !searchQuery) return tasks || [];
    return tasks.filter((t: any) => 
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);


  // Fetch pending users count for the badge
  const { data: pendingUsersCount = 0 } = useQuery({
    queryKey: ["pending-approvals-count"],
    queryFn: async () => {
      const { count, error } = await (supabase
        .from("profiles")
        .select("*", { count: "exact", head: true }) as any)
        .eq("is_approved", false);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user && isAdmin,
    refetchInterval: 30000, // Refetch every 30 seconds
  } as any);

  const handleSignOut = async () => {
    await signOut();
    // Safety fallback if signOut takes too long
    setTimeout(() => {
      window.location.href = "/";
    }, 100);
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  // Open issues count for notification badge
  const openIssuesCount = issues?.filter(i => i.status === "open").length || 0;

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={setSidebarCollapsed}
      />

      {/* Main Content */}
      <div className={cn(
        "flex-1 min-h-screen transition-all duration-300 w-full",
        "lg:pl-64 md:pl-16",
        sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 md:h-18 lg:h-20 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-2 sm:px-3 md:px-4 lg:px-6 w-full overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 min-w-0 flex-1">
            {title && (
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-foreground font-montserrat tracking-tight leading-none truncate">{title}</h1>
                {subtitle && <p className="text-xs sm:text-xs md:text-sm font-medium text-muted-foreground font-poppins mt-0.5 md:mt-1 lg:mt-1.5 opacity-80 truncate hidden sm:block">{subtitle}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0">
            {/* Search - Hidden on mobile, shown on md+ */}
            <div className="relative hidden md:block">
              <Button
                variant="outline"
                className="w-[200px] lg:w-[400px] justify-start text-muted-foreground transition-all duration-300 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/30"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="mr-2 h-4 w-4" />
                <span className="hidden lg:inline">Search vendors, issues...</span>
                <span className="lg:hidden">Search...</span>
                <kbd className="ml-auto pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </div>

            {/* Mobile Search Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </Button>

            {/* Notifications */}
            <NotificationBell />

            {/* Audit Logs Quick Access - Hidden on mobile */}
            {canSeeInternalLogs && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/audit-logs")}
                title="Audit Logs"
                className="hidden sm:flex"
              >
                <FileText className="w-5 h-5 text-muted-foreground" />
              </Button>
            )}

            {/* User Approvals Quick Access (Admin Only) - Hidden on mobile */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/user-approvals")}
                title="User Approvals"
                className="relative hidden sm:flex"
              >
                <UserCheck className="w-5 h-5 text-muted-foreground" />
                {(pendingUsersCount as number) > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-amber-500 hover:bg-amber-600">
                    {((pendingUsersCount as number) > 9 ? "9+" : pendingUsersCount) as any as ReactNode}
                  </Badge>
                )}
              </Button>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-7 w-7 md:h-8 md:w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="gradient-primary text-primary-foreground text-xs">
                      {getInitials(profile?.full_name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium truncate">
                      {(profile?.full_name && profile.full_name !== "User")
                        ? profile.full_name
                        : (isAdmin ? "Administrator" : (profile?.full_name || "User"))}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                
                {/* Mobile-only menu items */}
                {canSeeInternalLogs && (
                  <DropdownMenuItem onClick={() => navigate("/audit-logs")} className="sm:hidden">
                    <FileText className="mr-2 h-4 w-4" />
                    Audit Logs
                  </DropdownMenuItem>
                )}
                
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/user-approvals")} className="sm:hidden">
                    <UserCheck className="mr-2 h-4 w-4" />
                    User Approvals
                    {(pendingUsersCount as number) > 0 && (
                      <Badge className="ml-auto h-5 px-1.5 text-xs bg-amber-500">
                        {(pendingUsersCount as number) > 9 ? "9+" : pendingUsersCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                )}
                
                <div className="mt-1">
                  <ThemeToggle variant="dropdown" />
                </div>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-2 sm:p-3 md:p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
          <div className="container-responsive">
            {children}
          </div>
        </main>
      </div>

      {/* Command Palette / Global Search */}
      <AnimatePresence>
        {searchOpen && (
          <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
            <CommandInput 
              placeholder="Search vendors, issues, MOUs, projects, tasks..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <CommandEmpty>
                <div className="text-center py-8">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="font-medium text-sm">No results found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search</p>
                </div>
              </CommandEmpty>

              {/* Quick Actions Section */}
              <CommandGroup heading="Quick actions">
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                >
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 }
                    }}
                  >
                    <CommandItem 
                      onSelect={() => { navigate("/vendors"); setSearchOpen(false); }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-all group cursor-pointer"
                    >
                      <motion.div 
                        className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <PlusCircle className="w-5 h-5 text-primary" />
                      </motion.div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Add new vendor</span>
                        <span className="text-xs text-muted-foreground">Create vendor profile</span>
                      </div>
                    </CommandItem>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 }
                    }}
                  >
                    <CommandItem 
                      onSelect={() => { navigate("/issues"); setSearchOpen(false); }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-amber-500/5 transition-all group cursor-pointer"
                    >
                      <motion.div 
                        className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center"
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      </motion.div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Log new issue</span>
                        <span className="text-xs text-muted-foreground">Report a problem</span>
                      </div>
                    </CommandItem>
                  </motion.div>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 }
                    }}
                  >
                    <CommandItem 
                      onSelect={() => { navigate("/mous"); setSearchOpen(false); }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-500/5 transition-all group cursor-pointer"
                    >
                      <motion.div 
                        className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <FilePlus className="w-5 h-5 text-indigo-600" />
                      </motion.div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">Create new MOU</span>
                        <span className="text-xs text-muted-foreground">Draft agreement</span>
                      </div>
                    </CommandItem>
                  </motion.div>

                  {isAdmin && (
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 }
                      }}
                    >
                      <CommandItem 
                        onSelect={() => { navigate("/user-approvals"); setSearchOpen(false); }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-500/5 transition-all group cursor-pointer"
                      >
                        <motion.div 
                          className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center relative"
                          whileHover={{ scale: 1.1, rotate: -5 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <ShieldCheck className="w-5 h-5 text-emerald-600" />
                          {(pendingUsersCount as number) > 0 && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <span className="text-[9px] text-white font-bold">
                                {(pendingUsersCount as number) > 9 ? "9+" : pendingUsersCount}
                              </span>
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">User approvals</span>
                          <span className="text-xs text-muted-foreground">Manage pending users</span>
                        </div>
                      </CommandItem>
                    </motion.div>
                  )}
                </motion.div>
              </CommandGroup>

              {/* Vendors Section - ALL VENDORS */}
              {filteredVendors && filteredVendors.length > 0 && (
                <CommandGroup heading={`Vendors (${filteredVendors.length})`}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.03
                        }
                      }
                    }}
                  >
                    {filteredVendors.map((vendor) => (
                      <motion.div
                        key={vendor.id}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 }
                        }}
                      >
                        <CommandItem
                          value={vendor.name}
                          onSelect={() => {
                            navigate(`/vendors/${vendor.id}`);
                            setSearchOpen(false);
                          }}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <motion.div 
                              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0"
                              whileHover={{ scale: 1.1 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              {vendor.name.slice(0, 1).toUpperCase()}
                            </motion.div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold truncate">{vendor.name}</span>
                              <span className="text-xs text-muted-foreground capitalize">{vendor.category}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-xs h-6 px-2 font-medium capitalize transition-all",
                                vendor.status === "active" && "bg-success/10 text-success border-success/20",
                                vendor.status === "inactive" && "bg-muted text-muted-foreground",
                                vendor.status === "pending" && "bg-warning/10 text-warning border-warning/20"
                              )}
                            >
                              {vendor.status}
                            </Badge>
                            <Building className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </CommandItem>
                      </motion.div>
                    ))}
                  </motion.div>
                </CommandGroup>
              )}

              {/* Issues Section - ALL ISSUES */}
              {filteredIssues && filteredIssues.length > 0 && (
                <CommandGroup heading={`Issues (${filteredIssues.length})`}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.03
                        }
                      }
                    }}
                  >
                    {filteredIssues.map((issue) => {
                      const priorityConfig = {
                        low: { color: "bg-priority-low", icon: AlertCircle, textColor: "text-priority-low" },
                        medium: { color: "bg-priority-medium", icon: AlertCircle, textColor: "text-priority-medium" },
                        high: { color: "bg-priority-high", icon: AlertCircle, textColor: "text-priority-high" },
                        critical: { color: "bg-priority-critical", icon: AlertCircle, textColor: "text-priority-critical" }
                      };
                      const config = priorityConfig[issue.priority as keyof typeof priorityConfig];
                      const Icon = config.icon;

                      return (
                        <motion.div
                          key={issue.id}
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0 }
                          }}
                        >
                          <CommandItem
                            value={issue.title}
                            onSelect={() => {
                              navigate("/issues");
                              setSearchOpen(false);
                            }}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <motion.div 
                                className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm flex-shrink-0",
                                  config.color
                                )}
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 400 }}
                              >
                                <Icon className="w-5 h-5" />
                              </motion.div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-semibold truncate">{issue.title}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {issue.vendor?.name || "No vendor"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs h-6 px-2 font-medium capitalize",
                                  `${config.color}/10 ${config.textColor} border-current/20`
                                )}
                              >
                                {issue.priority}
                              </Badge>
                            </div>
                          </CommandItem>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </CommandGroup>
              )}

              {/* MOUs Section - ALL MOUs */}
              {filteredMOUs && filteredMOUs.length > 0 && (
                <CommandGroup heading={`Agreements (${filteredMOUs.length})`}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.03
                        }
                      }
                    }}
                  >
                    {filteredMOUs.map((mou: any) => (
                      <motion.div
                        key={mou.id}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 }
                        }}
                      >
                        <CommandItem
                          value={mou.title}
                          onSelect={() => {
                            navigate("/mous");
                            setSearchOpen(false);
                          }}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <motion.div 
                              className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 flex-shrink-0"
                              whileHover={{ scale: 1.1, rotate: -5 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <FileText className="w-5 h-5" />
                            </motion.div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold truncate">{mou.title}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {mou.vendor?.name || "No vendor"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              className={cn(
                                "text-xs h-6 px-2 font-medium capitalize",
                                mou.status === "active" && "bg-success/10 text-success border-success/20",
                                mou.status === "draft" && "bg-muted text-muted-foreground",
                                mou.status === "expired" && "bg-destructive/10 text-destructive border-destructive/20",
                                mou.status === "pending" && "bg-warning/10 text-warning border-warning/20"
                              )}
                            >
                              {mou.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </CommandItem>
                      </motion.div>
                    ))}
                  </motion.div>
                </CommandGroup>
              )}

              {/* Projects Section */}
              {filteredProjects && filteredProjects.length > 0 && (
                <CommandGroup heading={`Projects (${filteredProjects.length})`}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.03
                        }
                      }
                    }}
                  >
                    {filteredProjects.map((project: any) => (
                      <motion.div
                        key={project.id}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 }
                        }}
                      >
                        <CommandItem
                          value={project.name}
                          onSelect={() => {
                            navigate("/projects");
                            setSearchOpen(false);
                          }}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <motion.div 
                              className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 flex-shrink-0"
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <Briefcase className="w-5 h-5" />
                            </motion.div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-semibold truncate">{project.name}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {project.description || "No description"}
                              </span>
                            </div>
                          </div>
                          {project.status && (
                            <Badge className="ml-2 capitalize">{project.status}</Badge>
                          )}
                        </CommandItem>
                      </motion.div>
                    ))}
                  </motion.div>
                </CommandGroup>
              )}

              {/* Tasks Section */}
              {filteredTasks && filteredTasks.length > 0 && (
                <CommandGroup heading={`Tasks (${filteredTasks.length})`}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: {
                        transition: {
                          staggerChildren: 0.03
                        }
                      }
                    }}
                  >
                    {filteredTasks.map((task: any) => (
                      <motion.div
                        key={task.id}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 }
                        }}
                      >
                        <CommandItem
                          value={task.title}
                          onSelect={() => {
                            navigate("/projects");
                            setSearchOpen(false);
                          }}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-all cursor-pointer group"
                        >
                          <motion.div 
                            className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 flex-shrink-0"
                            whileHover={{ scale: 1.1, rotate: -5 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <CheckSquare className="w-5 h-5" />
                          </motion.div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold truncate">{task.title}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {task.description || "No description"}
                            </span>
                          </div>
                        </CommandItem>
                      </motion.div>
                    ))}
                  </motion.div>
                </CommandGroup>
              )}


              {/* System Navigation */}
              <CommandGroup heading="System navigation">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                  <CommandItem 
                    onSelect={() => { navigate("/dashboard"); setSearchOpen(false); }} 
                    className="flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-primary hover:bg-accent/50 rounded-md transition-all cursor-pointer"
                  >
                    <Layout className="w-4 h-4" /> Dashboard
                  </CommandItem>
                  <CommandItem 
                    onSelect={() => { navigate("/settings"); setSearchOpen(false); }} 
                    className="flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-primary hover:bg-accent/50 rounded-md transition-all cursor-pointer"
                  >
                    <SettingsIcon className="w-4 h-4" /> Settings
                  </CommandItem>
                  {canSeeInternalLogs && (
                    <CommandItem 
                      onSelect={() => { navigate("/audit-logs"); setSearchOpen(false); }} 
                      className="flex items-center gap-2 p-2 text-xs text-muted-foreground hover:text-primary hover:bg-accent/50 rounded-md transition-all cursor-pointer"
                    >
                      <FileText className="w-4 h-4" /> Audit logs
                    </CommandItem>
                  )}
                </div>
              </CommandGroup>
            </CommandList>
          </CommandDialog>
        )}
      </AnimatePresence>
    </div>
  );
}
