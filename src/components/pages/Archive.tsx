import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Archive as ArchiveIcon, Search, Trash2, RotateCcw, Calendar,
  FileText, Ticket, DollarSign, Settings, Bell, BarChart3,
  Building2, AlertTriangle, Clock, Filter, Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useArchivedNotifications } from "@/hooks/useArchivedNotifications";
import { motion } from "framer-motion";

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
  hr: "HR Operations",
  vendor: "Vendors",
  system: "System"
};

export default function Archive() {
  const { 
    archivedNotifications, 
    isLoading,
    restoreNotification, 
    deleteNotification, 
    clearAll,
    isRestoring,
    isDeleting
  } = useArchivedNotifications();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredNotifications = useMemo(() => {
    let filtered = archivedNotifications;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }

    return filtered;
  }, [archivedNotifications, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(archivedNotifications.map(n => n.category));
    return Array.from(cats);
  }, [archivedNotifications]);

  const handleClearAll = () => {
    if (confirm("Are you sure you want to permanently delete all archived notifications? This cannot be undone.")) {
      clearAll();
    }
  };

  return (
    <DashboardLayout title="Notification Archive" subtitle="View and manage archived notifications">
      <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArchiveIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{archivedNotifications.length}</p>
                  <p className="text-sm text-muted-foreground">Archived items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Filter className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categories.length}</p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {archivedNotifications.length > 0 
                      ? formatDistanceToNow(new Date(archivedNotifications[0].archived_at), { addSuffix: true })
                      : "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground">Latest archived</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search archived notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium"
            >
              <option value="all">All categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
              ))}
            </select>

            {archivedNotifications.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                className="gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Archived Notifications */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative py-24 flex flex-col items-center text-center overflow-hidden bg-card rounded-3xl border"
          >
            <div className="relative w-24 h-24 bg-card border border-border/20 rounded-[40px] flex items-center justify-center shadow-2xl mb-8">
              <ArchiveIcon className="w-12 h-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2">No archived notifications</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium leading-relaxed">
              {searchTerm || selectedCategory !== "all" 
                ? "No notifications match your filters. Try adjusting your search."
                : "Archived notifications will appear here. Archive notifications from the main notifications page."}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => navigate("/notifications")}
            >
              Go to notifications
            </Button>
          </motion.div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredNotifications.map((notification, idx) => {
                const Icon = categoryIcons[notification.category];
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "group relative flex gap-3 p-4 rounded-xl transition-all duration-200 border bg-card hover:shadow-md",
                      categoryColors[notification.category]
                    )}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      {notification.metadata?.avatar_url ? (
                        <div className="w-10 h-10 rounded-xl shadow-sm overflow-hidden border border-border/50">
                          <img src={notification.metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={cn(
                          "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center",
                          categoryColors[notification.category]
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold truncate">{notification.title}</h4>
                          <Badge variant="outline" className="text-[9px] font-bold">
                            {categoryLabels[notification.category]}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                          {format(new Date(notification.original_created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {notification.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreNotification(notification.notification_id)}
                        className="gap-2"
                        disabled={isRestoring}
                      >
                        {isRestoring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteNotification(notification.id)}
                        className="text-destructive hover:bg-destructive/10"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </DashboardLayout>
  );
}
