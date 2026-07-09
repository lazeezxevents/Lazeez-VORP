import { useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell, FileText, Ticket, AlertTriangle, Clock, RefreshCw, DollarSign,
  AlertCircle, Calendar, Building2, ChevronRight, ChevronDown, BarChart3,
  Filter, Download, Archive, Eye, EyeOff, SortAsc, SortDesc, Trash2,
  CheckCheck, MoreVertical, Zap, Settings, Check
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DiagnosticDialog } from "@/components/hr/DiagnosticDialog";
import { useNotifications, Notification as NotificationType } from "@/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/components/utils/soundEffects";

const categoryIcons: Record<string, React.ElementType> = {
  mou: FileText,
  issue: Ticket,
  payment: DollarSign,
  vendor: Settings,
  system: Bell,
  performance: BarChart3,
  project: Building2,
  finance: DollarSign,
  delivery: AlertTriangle,
  attendance: Clock,
  leave: Calendar,
  appraisal: BarChart3,
  hr: Building2,
};

const categoryColors: Record<string, string> = {
  mou: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  issue: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  payment: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  vendor: "bg-primary/10 text-primary border-primary/20",
  system: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  performance: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  project: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  finance: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  delivery: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  attendance: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  leave: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  appraisal: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  hr: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const categoryLabels: Record<string, string> = {
  mou: "MOUs",
  issue: "Issues",
  payment: "Payments",
  performance: "Performance",
  project: "Projects",
  finance: "Finance",
  delivery: "Delivery",
  attendance: "Attendance",
  leave: "Leave",
  appraisal: "Appraisals",
  hr: "HR Operations"
};

const typeStyles: Record<string, string> = {
  success: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-500",
  error: "border-l-4 border-l-rose-500",
  info: "border-l-4 border-l-blue-500",
};

export default function Notifications() {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    handleMarkAsRead, 
    handleMarkAllAsRead, 
    handleDelete,
    handleDeleteAll,
    handleMarkCategoryAsRead,
    handleArchiveCategory,
    handleExportCategory,
    handleExportAll,
    handleArchiveOld,
    manualRefresh,
    readItems
  } = useNotifications();
  
  const { isAdmin, isStaff } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diagnosticDialogOpen, setDiagnosticDialogOpen] = useState(false);
  const [showRead, setShowRead] = useState(true);
  const navigate = useNavigate();

  const toggleCategory = useCallback((category: string) => {
    playSound("click");
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; unread: number; notifications: NotificationType[] }> = {};
    
    notifications.forEach(n => {
      if (!counts[n.category]) {
        counts[n.category] = { total: 0, unread: 0, notifications: [] };
      }
      counts[n.category].total++;
      counts[n.category].notifications.push(n);
      if (!readItems.has(n.id)) {
        counts[n.category].unread++;
      }
    });
    
    return counts;
  }, [notifications, readItems]);

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleSelectAll = useCallback(() => {
    const visibleNotificationIds = notifications
      .filter(n => showRead || !readItems.has(n.id))
      .map(n => n.id);
    
    if (selectedIds.size === visibleNotificationIds.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible
      setSelectedIds(new Set(visibleNotificationIds));
    }
  }, [notifications, showRead, readItems, selectedIds.size]);

  const isAllSelected = useMemo(() => {
    const visibleNotificationIds = notifications
      .filter(n => showRead || !readItems.has(n.id))
      .map(n => n.id);
    return visibleNotificationIds.length > 0 && selectedIds.size === visibleNotificationIds.length;
  }, [notifications, showRead, readItems, selectedIds.size]);

  const isIndeterminate = useMemo(() => {
    const visibleNotificationIds = notifications
      .filter(n => showRead || !readItems.has(n.id))
      .map(n => n.id);
    return selectedIds.size > 0 && selectedIds.size < visibleNotificationIds.length;
  }, [notifications, showRead, readItems, selectedIds.size]);

  const handleBulkMarkRead = useCallback(() => {
    if (selectedIds.size === 0) return;
    playSound("success");
    handleMarkAllAsRead(Array.from(selectedIds));
    toast.success(`Marked ${selectedIds.size} notifications as read`, {
      icon: <Check className="w-4 h-4" />
    });
    setSelectedIds(new Set());
  }, [selectedIds, handleMarkAllAsRead]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    playSound("error");
    handleDeleteAll(Array.from(selectedIds));
    toast.success(`Deleted ${selectedIds.size} notifications`);
    setSelectedIds(new Set());
  }, [selectedIds, handleDeleteAll]);

  const handleBulkArchive = useCallback(() => {
    if (selectedIds.size === 0) return;
    playSound("warning");
    // Archive selected notifications (mark as archived in database)
    handleDeleteAll(Array.from(selectedIds)); // For now, delete acts as archive
    toast.success(`Archived ${selectedIds.size} notifications`);
    setSelectedIds(new Set());
  }, [selectedIds, handleDeleteAll]);

  const handleNavigate = useCallback((notification: NotificationType) => {
    playSound("click");
    handleMarkAsRead(notification.id);
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  }, [handleMarkAsRead, navigate]);

  const handleCategoryMarkAsRead = useCallback((category: string) => {
    playSound("success");
    handleMarkCategoryAsRead(category, notifications);
    toast.success(`Marked all ${categoryLabels[category]} as read`, {
      icon: <CheckCheck className="w-4 h-4" />
    });
  }, [handleMarkCategoryAsRead, notifications]);

  const handleCategoryArchive = useCallback((category: string) => {
    playSound("warning");
    handleArchiveCategory(category, notifications);
    toast.success(`Archived ${categoryLabels[category]} notifications`);
  }, [handleArchiveCategory, notifications]);

  const handleCategoryExport = useCallback((category: string) => {
    playSound("success");
    handleExportCategory(category, notifications);
    toast.success(`Exported ${categoryLabels[category]} notifications`);
  }, [handleExportCategory, notifications]);

  return (
    <DashboardLayout title="App Activity" subtitle="Real-time notifications and system alerts">
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">

        {/* Premium Category Statistics Strip - Horizontal Scrollable */}
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
          {Object.entries(categoryCounts)
            .filter(([cat]) => {
              if (cat === "finance" || cat === "delivery") return isStaff || isAdmin;
              return true;
            })
            .map(([category, data]) => {
              const Icon = categoryIcons[category];
              const colors = categoryColors[category];
              
              return (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleCategory(category)}
                  className="flex-shrink-0 w-40 cursor-pointer"
                >
                  <Card className="h-full hover:shadow-lg transition-all duration-300 border-none shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className={cn("p-2.5 rounded-xl", colors)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tracking-tight">{data.total}</p>
                        <p className="text-xs font-bold text-muted-foreground">{categoryLabels[category]}</p>
                      </div>
                      {data.unread > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                          {data.unread} unread
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 py-2">
          <div className="flex items-center gap-2 md:gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onCheckedChange={handleToggleSelectAll}
                className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary"
              />
              <h2 className="text-lg md:text-xl font-bold tracking-tight">Recent activity</h2>
            </div>
            <Badge variant="secondary" className="h-6 px-2">
              {unreadCount} unread
            </Badge>
            {selectedIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20"
              >
                <span className="text-xs font-bold text-primary">{selectedIds.size} selected</span>
                <div className="h-4 w-px bg-primary/30 mx-1" />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] font-bold text-primary hover:bg-transparent px-1"
                  onClick={handleBulkMarkRead}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark read
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] font-bold text-amber-500 hover:bg-transparent px-1"
                  onClick={handleBulkArchive}
                >
                  <Archive className="w-3 h-3 mr-1" />
                  Archive
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] font-bold text-rose-500 hover:bg-transparent px-1"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </motion.div>
            )}
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playSound("click");
                navigate("/archive");
              }}
              className="rounded-xl border-amber-500/20 text-amber-600 hover:bg-amber-50 font-bold h-8 md:h-9"
            >
              <Archive className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiagnosticDialogOpen(true)}
              className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold h-8 md:h-9 flex-1 md:flex-initial"
            >
              <Zap className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Diagnostics</span>
              <span className="sm:hidden">Diag</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                playSound("refresh");
                manualRefresh();
              }} 
              className="rounded-xl h-8 md:h-9 group flex-1 md:flex-initial"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2 transition-transform duration-500 group-hover:rotate-180", isLoading && "animate-spin")} />
              Sync
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-8 md:h-9">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-popover/95 backdrop-blur-xl border border-border/20 shadow-xl"
              >
                <DropdownMenuLabel className="text-xs font-bold">Global actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-xs"
                  onClick={() => {
                    playSound("success");
                    handleMarkAllAsRead(notifications.map(n => n.id));
                    toast.success("Marked all as read");
                  }}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all as read
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-xs"
                  onClick={() => setShowRead(!showRead)}
                >
                  {showRead ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showRead ? "Hide read" : "Show read"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-xs"
                  onClick={() => {
                    playSound("success");
                    handleExportAll(notifications);
                    toast.success("Exported all notifications");
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export all notifications
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-xs"
                  onClick={() => {
                    playSound("warning");
                    handleArchiveOld(notifications);
                  }}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive old notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Category Rows */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : Object.keys(categoryCounts).length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative py-24 flex flex-col items-center text-center overflow-hidden bg-card rounded-3xl border"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/20 to-primary/20 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-24 h-24 bg-card border border-emerald-500/20 rounded-[40px] flex items-center justify-center shadow-2xl mb-8 overflow-hidden">
                  {/* Continuous glow effect */}
                  <motion.div
                    className="absolute inset-0 rounded-[40px] bg-emerald-500/20"
                    animate={{
                      opacity: [0.2, 0.5, 0.2],
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  
                  {/* Continuous tick animation */}
                  <motion.div
                    className="relative z-10 text-emerald-500"
                    animate={{ 
                      scale: [1, 1.15, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{ 
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 0.5,
                      ease: "easeInOut"
                    }}
                  >
                    <CheckCheck className="w-12 h-12" />
                  </motion.div>
                </div>
              </div>

              <h3 className="text-2xl font-bold tracking-tight mb-2 bg-gradient-to-br from-emerald-600 to-emerald-400 bg-clip-text text-transparent font-montserrat">
                You are all caught up
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium leading-relaxed font-poppins">
                You've cleared your entire feed. Take a moment to relax or explore other insights.
              </p>
            </motion.div>
          ) : (
            Object.entries(categoryCounts)
              .filter(([cat]) => {
                if (cat === "finance" || cat === "delivery") return isStaff || isAdmin;
                return true;
              })
              .map(([category, data]) => {
                const Icon = categoryIcons[category];
                const isExpanded = expandedCategories.has(category);
                const visibleNotifications = showRead 
                  ? data.notifications 
                  : data.notifications.filter(n => !readItems.has(n.id));
                
                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border/40 overflow-hidden"
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border/40">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn("p-2.5 rounded-xl", categoryColors[category])}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base">{categoryLabels[category]}</h3>
                          <p className="text-xs text-muted-foreground">
                            {data.total} total • {data.unread} unread
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            className="w-48 bg-popover/95 backdrop-blur-xl border border-border/20 shadow-xl"
                          >
                            <DropdownMenuLabel className="text-xs font-bold">Category actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-xs"
                              onClick={() => handleCategoryMarkAsRead(category)}
                            >
                              <CheckCheck className="w-3.5 h-3.5 mr-2" />
                              Mark all as read
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-xs"
                              onClick={() => handleCategoryArchive(category)}
                            >
                              <Archive className="w-3.5 h-3.5 mr-2" />
                              Archive category
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-xs"
                              onClick={() => handleCategoryExport(category)}
                            >
                              <Download className="w-3.5 h-3.5 mr-2" />
                              Export notifications
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <motion.button
                          onClick={() => toggleCategory(category)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all",
                            "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span>{isExpanded ? "Show less" : "Show more"}</span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </motion.button>
                      </div>
                    </div>

                    {/* Expandable Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <ScrollArea className="max-h-[400px]">
                            <div className="p-2 space-y-1">
                              {visibleNotifications.map((notification, idx) => {
                                const isRead = readItems.has(notification.id);
                                const isSelected = selectedIds.has(notification.id);
                                
                                return (
                                  <motion.div
                                    key={notification.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    transition={{ 
                                      duration: 0.2,
                                      delay: idx * 0.03 
                                    }}
                                    className={cn(
                                      "group relative flex gap-3 p-3 rounded-xl transition-all duration-200 border",
                                      !isRead ? "bg-primary/5 hover:bg-primary/10 border-primary/20" : "hover:bg-muted/50 border-transparent",
                                      isSelected && "border-primary/30 bg-primary/10",
                                      typeStyles[notification.type]
                                    )}
                                    onClick={() => handleNavigate(notification)}
                                  >
                                    <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <Checkbox 
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleSelect(notification.id)}
                                        className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary transition-opacity group-hover:opacity-100 opacity-60"
                                      />
                                      {notification.metadata?.avatar_url ? (
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl shadow-sm transition-transform group-hover:scale-105 overflow-hidden border border-border/50 bg-muted/20">
                                          <img src={notification.metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                      ) : (
                                        <div className={cn(
                                          "flex items-center justify-center w-10 h-10 rounded-xl shadow-sm transition-transform group-hover:scale-105",
                                          categoryColors[notification.category]
                                        )}>
                                          <Icon className="w-5 h-5" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 py-0.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className={cn("text-sm font-bold truncate tracking-tight", !isRead ? "text-foreground" : "text-muted-foreground")}>
                                              {notification.title}
                                            </h4>
                                            {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
                                            {notification.type === "error" && (
                                              <Badge variant="destructive" className="h-4 px-1.5 text-[8px] font-bold uppercase rounded-md tracking-wider hidden sm:inline-flex">
                                                Urgent
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed font-medium">
                                            {notification.message}
                                          </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                          <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded-lg">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                      {!isRead && (
                                        <motion.button
                                          whileHover={{ scale: 1.1 }}
                                          whileTap={{ scale: 0.9 }}
                                          className="h-7 w-7 rounded-lg text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            playSound("success");
                                            handleMarkAsRead(notification.id);
                                            toast.success("Marked as read", {
                                              icon: <Check className="w-4 h-4" />
                                            });
                                          }}
                                        >
                                          <Check className="w-4 h-4" />
                                        </motion.button>
                                      )}
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="h-7 w-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 flex items-center justify-center"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playSound("warning");
                                          handleDelete(notification.id);
                                          toast.success("Notification archived", {
                                            icon: <Archive className="w-4 h-4" />,
                                            duration: 2000
                                          });
                                        }}
                                      >
                                        <Archive className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          playSound("error");
                                          handleDelete(notification.id);
                                          toast.success("Notification deleted");
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
          )}
        </div>
      </div>
      
      <DiagnosticDialog
        open={diagnosticDialogOpen}
        onOpenChange={setDiagnosticDialogOpen}
      />
    </DashboardLayout>
  );
}
