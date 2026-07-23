import { useState, useMemo } from "react";
import { format, differenceInDays, isPast } from "date-fns";
import { AlertTriangle, Clock, CheckCircle2, CalendarDays, Search, ExternalLink, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MOUVaultItem } from "@/hooks/useMOUVault";
import { Link } from "react-router-dom";

interface MOUExpirationTrackerProps {
  items: MOUVaultItem[];
}

interface GroupedItem {
  item: MOUVaultItem;
  daysUntilExpiry: number | null;
  daysUntilTermination: number | null;
  status: "expired" | "critical" | "warning" | "active";
}

export function MOUExpirationTracker({ items }: MOUExpirationTrackerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const trackedItems = useMemo(() => {
    return items.map((item) => {
      let daysUntilExpiry: number | null = null;
      let status: "expired" | "critical" | "warning" | "active" = "active";

      if (item.effective_end_date) {
        const endDate = new Date(item.effective_end_date);
        daysUntilExpiry = differenceInDays(endDate, new Date());
        if (isPast(endDate)) {
          status = "expired";
        } else if (daysUntilExpiry <= 30) {
          status = "critical";
        } else if (daysUntilExpiry <= 90) {
          status = "warning";
        }
      }

      let daysUntilTermination: number | null = null;
      if (item.termination_deadline) {
        daysUntilTermination = differenceInDays(new Date(item.termination_deadline), new Date());
      }

      return { item, daysUntilExpiry, daysUntilTermination, status };
    }).sort((a, b) => {
      if (a.daysUntilExpiry === null) return 1;
      if (b.daysUntilExpiry === null) return -1;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
  }, [items]);

  const stats = useMemo(() => {
    return {
      total: trackedItems.length,
      expired: trackedItems.filter(i => i.status === "expired").length,
      critical: trackedItems.filter(i => i.status === "critical").length,
      warning: trackedItems.filter(i => i.status === "warning").length,
      active: trackedItems.filter(i => i.status === "active").length,
    };
  }, [trackedItems]);

  const filteredItems = useMemo(() => {
    return trackedItems.filter(entry => {
      const nameMatch = entry.item.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.item.vendor?.name || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (!nameMatch) return false;

      if (activeTab === "expired") return entry.status === "expired";
      if (activeTab === "critical") return entry.status === "critical";
      if (activeTab === "warning") return entry.status === "warning";
      if (activeTab === "active") return entry.status === "active";
      return true;
    });
  }, [trackedItems, searchQuery, activeTab]);

  const TimelineItem = ({ data }: { data: GroupedItem }) => {
    const { item, daysUntilExpiry, daysUntilTermination, status } = data;

    const getProgressValue = () => {
      if (status === "expired") return 100;
      if (!item.effective_start_date || !item.effective_end_date) return 20; // Default active indicator
      
      const start = new Date(item.effective_start_date);
      const end = new Date(item.effective_end_date);
      const total = differenceInDays(end, start);
      const elapsed = differenceInDays(new Date(), start);
      
      return Math.min(100, Math.max(0, (elapsed / total) * 100));
    };

    return (
      <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{item.document_name}</p>
            {item.vendor && (
              <Link 
                to={`/vendors/${item.vendor_id}`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mt-0.5"
              >
                {item.vendor.name}
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          <Badge 
            className={
              status === "expired" ? "bg-destructive/10 text-destructive border-destructive/20" :
              status === "critical" ? "bg-destructive/10 text-destructive border-destructive/20" :
              status === "warning" ? "bg-warning/10 text-warning border-warning/20" :
              "bg-success/10 text-success border-success/20"
            }
          >
            {status === "expired" ? "Expired" : daysUntilExpiry !== null ? `${daysUntilExpiry}d remaining` : "Active (Ongoing)"}
          </Badge>
        </div>
        
        <div className="mt-3">
          <Progress value={getProgressValue()} className="h-2" />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            Start: {item.effective_start_date ? format(new Date(item.effective_start_date), "MMM d, yyyy") : (item.signed_date ? format(new Date(item.signed_date), "MMM d, yyyy") : "N/A")}
          </span>
          <span>
            End: {item.effective_end_date ? format(new Date(item.effective_end_date), "MMM d, yyyy") : "Active (Ongoing)"}
          </span>
        </div>

        {daysUntilTermination !== null && daysUntilTermination > 0 && daysUntilTermination <= 30 && (
          <div className="flex items-center gap-1.5 mt-2.5 p-2 rounded-lg bg-warning/10 text-xs text-warning">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Termination notice deadline in <strong>{daysUntilTermination} days</strong></span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setActiveTab("expired")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Expired</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.expired}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setActiveTab("critical")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Critical (≤30d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.critical}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setActiveTab("warning")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning">
              <CalendarDays className="w-4 h-4" />
              <span className="text-sm font-medium">Warning (30-90d)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.warning}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-success/50 transition-colors" onClick={() => setActiveTab("active")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Active (90d+)</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.active}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="expired">Expired ({stats.expired})</TabsTrigger>
            <TabsTrigger value="critical">Critical ({stats.critical})</TabsTrigger>
            <TabsTrigger value="warning">Warning ({stats.warning})</TabsTrigger>
            <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter tracker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map(data => (
            <TimelineItem key={data.item.id} data={data} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/60" />
            <h3 className="text-base font-semibold text-foreground">No documents found in this status</h3>
            <p className="text-sm mt-1">Try switching tabs or searching for another vendor</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
