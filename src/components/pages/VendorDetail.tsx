import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Star,
  FileText, Users, Ticket, Calendar, Download, Eye,
  Edit, Clock, CheckCircle2, DollarSign, TrendingUp,
  MessageSquare, History, BarChart3, Archive, Plus,
  Trash2, AlertCircle, Loader2
} from "lucide-react";
import { useVendor, useDeleteVendor } from "@/hooks/useVendors";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { VendorForm } from "@/components/vendors/VendorForm";
import { VendorDocumentUpload, useDeleteDocument } from "@/components/vendors/VendorDocumentUpload";
import { VendorPaymentTimeline } from "@/components/vendors/VendorPaymentTimeline";
import { VendorPerformanceChart } from "@/components/vendors/VendorPerformanceChart";
import { VendorTimeline } from "@/components/vendors/VendorTimeline";
import { VendorKPICard } from "@/components/vendors/VendorKPICard";
import { VendorRemarks } from "@/components/vendors/VendorRemarks";
import { VendorExportButton } from "@/components/vendors/VendorExportButton";
import { useMOUVaultByVendor } from "@/hooks/useMOUVault";
import { MOUVaultCard } from "@/components/mous/MOUVaultCard";
import { MOUVaultUpload } from "@/components/mous/MOUVaultUpload";
import { MOUDocumentViewer } from "@/components/mous/MOUDocumentViewer";
import { MOURenewalTimeline } from "@/components/mous/MOURenewalTimeline";
import { MOUVaultItem } from "@/hooks/useMOUVault";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-muted",
  pending: "bg-warning/10 text-warning border-warning/20",
  blacklisted: "bg-destructive/10 text-destructive border-destructive/20",
  onboarded: "bg-success/10 text-success border-success/20",
  new: "bg-info/10 text-info border-info/20",
  terminated: "bg-destructive/10 text-destructive border-destructive/20",
  left: "bg-muted text-muted-foreground border-muted",
};

const mouStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  signed: "bg-success/10 text-success",
  expired: "bg-destructive/10 text-destructive",
  terminated: "bg-destructive/10 text-destructive",
};

const issueStatusColors: Record<string, string> = {
  open: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high: "bg-orange-500/10 text-orange-500",
  critical: "bg-destructive/10 text-destructive",
};

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isStaff, isAdmin } = useAuth();
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [vaultUploadOpen, setVaultUploadOpen] = useState(false);
  const [viewerVaultItem, setViewerVaultItem] = useState<MOUVaultItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string; isImage: boolean; isPdf: boolean } | null>(null);

  const { data: vendor, isLoading: vendorLoading } = useVendor(id || "");
  const { data: vaultItems, isLoading: vaultLoading } = useMOUVaultByVendor(id);
  const deleteVendorMutation = useDeleteVendor();

  // Fetch assigned employees
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["vendor-assignments", id],
    queryFn: async () => {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("employee_vendor_assignments")
        .select("*")
        .eq("vendor_id", id);

      if (assignmentError) throw assignmentError;

      const employeeIds = assignmentData?.map(a => a.employee_id) || [];
      if (employeeIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", employeeIds);

      if (profilesError) throw profilesError;

      return assignmentData.map(assignment => ({
        ...assignment,
        employee: profiles?.find(p => p.id === assignment.employee_id) || null,
      }));
    },
    enabled: !!id,
  });

  // Fetch vendor documents
  const { data: documents, isLoading: documentsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ["vendor-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("vendor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch related MOUs
  const { data: mous, isLoading: mousLoading } = useQuery({
    queryKey: ["vendor-mous", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mous")
        .select("*")
        .eq("vendor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch related issues
  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ["vendor-issues", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("vendor_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const deleteDocument = useDeleteDocument();

  const handleDeleteVendor = async () => {
    if (!id) return;
    try {
      await deleteVendorMutation.mutateAsync(id);
      navigate("/vendors");
    } catch (error) {
      // Error is handled by mutation
    }
  };

  // Calculate KPI stats
  const resolvedIssues = issues?.filter(i => i.status === "resolved" || i.status === "closed") || [];

  // Compute average resolution time in days from resolved issues that have resolved_at set
  const avgResolutionTime = (() => {
    const timedIssues = resolvedIssues.filter(
      i => i.resolved_at && i.created_at
    );
    if (timedIssues.length === 0) return 0;
    const totalMs = timedIssues.reduce((sum, i) => {
      return sum + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime());
    }, 0);
    const avgDays = totalMs / timedIssues.length / (1000 * 60 * 60 * 24);
    return Math.round(avgDays * 10) / 10; // one decimal place
  })();

  const kpiStats = {
    totalIssues: issues?.length || 0,
    openIssues: issues?.filter(i => i.status === "open").length || 0,
    resolvedIssues: resolvedIssues.length,
    criticalIssues: issues?.filter(i => i.priority === "critical").length || 0,
    avgResolutionTime,
    totalMous: mous?.length || 0,
    // Active MOUs: signed or approved, and not expired by date
    activeMous: mous?.filter(m => {
      const isActiveStatus = m.status === "signed" || m.status === "approved";
      const isNotExpiredByDate = !m.end_date || new Date(m.end_date) >= new Date();
      return isActiveStatus && isNotExpiredByDate;
    }).length || 0,
    assignedEmployees: assignments?.length || 0,
    resolutionRate: issues?.length
      ? Math.round((resolvedIssues.length / issues.length) * 100)
      : 0,
  };

  const isLoading = vendorLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Vendor Details" subtitle="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Skeleton className="h-[400px]" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-[400px]" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!vendor) {
    return (
      <DashboardLayout title="Vendor Not Found" subtitle="">
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vendor not found</h2>
            <p className="text-muted-foreground mb-4">
              The vendor you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate("/vendors")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Vendors
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const categoryLabels: Record<string, string> = {
    home_chef: "Home Chef",
    home_baker: "Home Baker",
    bakery: "Bakery",
    catering: "Catering",
    restaurant: "Restaurant",
    decoration: "Decoration",
    photography: "Photography",
    entertainment: "Entertainment",
    venue: "Venue",
    logistics: "Logistics",
    other: "Other",
  };

  return (
    <DashboardLayout
      title={vendor.name}
      subtitle={categoryLabels[vendor.category]}
    >
      <div className="space-y-6 animate-fade-in">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/vendors")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendors
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vendor Profile Card */}
          <Card className="lg:col-span-1 animate-fade-in">
            <CardHeader className="text-center pb-2 relative">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleteVendorMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-10 h-10 text-primary-foreground" />
              </div>
              <CardTitle className="text-xl">{vendor.name}</CardTitle>
              <Badge variant="outline" className={cn("mt-2", statusColors[vendor.status])}>
                {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Rating */}
              {vendor.rating && (
                <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Star className="w-4 h-4 text-warning fill-warning" />
                  <span className="text-lg font-bold">{vendor.rating}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
              )}

              {/* Contact Info */}
              <div className="space-y-3 pt-4 border-t">
                {vendor.contact_person && (
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{vendor.contact_person}</span>
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">
                      {vendor.email}
                    </a>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${vendor.phone}`} className="text-foreground hover:underline">
                      {vendor.phone}
                    </a>
                  </div>
                )}
                {(vendor.address || vendor.city) && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-foreground">
                      {[vendor.address, vendor.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Bank Details */}
              {(vendor.bank_name || vendor.bank_account_number) && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Bank Details
                  </h4>
                  <div className="space-y-1 text-sm">
                    {vendor.bank_title && (
                      <p className="text-muted-foreground">Title: <span className="text-foreground">{vendor.bank_title}</span></p>
                    )}
                    {vendor.bank_name && (
                      <p className="text-muted-foreground">Bank: <span className="text-foreground">{vendor.bank_name}</span></p>
                    )}
                    {vendor.bank_account_number && (
                      <p className="text-muted-foreground">Account: <span className="text-foreground font-mono">{vendor.bank_account_number}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Commission & Subscription Info */}
              <div className="pt-4 border-t space-y-2 text-sm">
                {vendor.commission_percentage !== null && vendor.commission_percentage > 0 && (
                  <p className="text-muted-foreground">
                    Commission: <span className="text-foreground font-medium">{vendor.commission_percentage}%</span>
                  </p>
                )}
                {vendor.subscription_amount !== null && vendor.subscription_amount > 0 && (
                  <p className="text-muted-foreground">
                    Subscription Amount: <span className="text-foreground font-medium">PKR {vendor.subscription_amount.toLocaleString()}</span>
                  </p>
                )}
                {vendor.subscription_after_orders !== null && vendor.subscription_after_orders > 0 && (
                  <p className="text-muted-foreground">
                    Subscription Starts: <span className="text-foreground font-medium">After {vendor.subscription_after_orders} orders</span>
                  </p>
                )}
              </div>

              {/* Description */}
              {vendor.description && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">{vendor.description}</p>
                </div>
              )}

              {/* Actions */}
              {isStaff && (
                <div className="pt-4 border-t space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => setEditFormOpen(true)}
                  >
                    <Edit className="w-4 h-4" />
                    Edit Vendor
                  </Button>
                  <VendorExportButton
                    vendor={vendor}
                    stats={{
                      totalIssues: kpiStats.totalIssues,
                      openIssues: kpiStats.openIssues,
                      resolvedIssues: kpiStats.resolvedIssues,
                    }}
                    fullWidth
                  />
                </div>
              )}

              {/* Meta Info */}
              <div className="pt-4 border-t text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {format(new Date(vendor.created_at), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Updated {formatDistanceToNow(new Date(vendor.updated_at), { addSuffix: true })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="kpis" className="space-y-4">
              <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full h-auto gap-1">
                <TabsTrigger value="kpis" className="gap-1 text-xs px-2">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">KPIs</span>
                </TabsTrigger>
                <TabsTrigger value="payments" className="gap-1 text-xs px-2">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Payments</span>
                </TabsTrigger>
                <TabsTrigger value="mous" className="gap-1 text-xs px-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">MOUs</span>
                </TabsTrigger>
                <TabsTrigger value="issues" className="gap-1 text-xs px-2">
                  <Ticket className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Issues</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1 text-xs px-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Docs</span>
                </TabsTrigger>
                <TabsTrigger value="remarks" className="gap-1 text-xs px-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remarks</span>
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-1 text-xs px-2">
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Team</span>
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1 text-xs px-2">
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Timeline</span>
                </TabsTrigger>
              </TabsList>

              {/* KPIs Tab */}
              <TabsContent value="kpis">
                <div className="space-y-6">
                  <VendorKPICard stats={kpiStats} />
                  <VendorPerformanceChart vendorId={id!} />
                </div>
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments">
                <VendorPaymentTimeline vendorId={id!} />
              </TabsContent>

              {/* MOUs Tab (Combined: Vault + Generated MOUs) */}
              <TabsContent value="mous">
                <div className="space-y-6">
                  {/* Vault Documents Section */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Archive className="w-5 h-5" />
                        Vault Documents
                      </CardTitle>
                      {isStaff && (
                        <Button size="sm" onClick={() => setVaultUploadOpen(true)} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Upload
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      {vaultLoading ? (
                        <div className="space-y-3">
                          {[1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
                        </div>
                      ) : vaultItems && vaultItems.length > 0 ? (
                        <div className="grid gap-3">
                          {vaultItems.map((vaultItem) => (
                            <div key={vaultItem.id} className="space-y-3">
                              <MOUVaultCard
                                item={vaultItem}
                                showVendor={false}
                                vendorStatus={vendor.status}
                                onViewDocument={(vi) => {
                                  setViewerVaultItem(vi);
                                  setViewerOpen(true);
                                }}
                                onViewDetails={(vi) => {
                                  setViewerVaultItem(vi);
                                  setViewerOpen(true);
                                }}
                              />
                              {vaultItem.effective_start_date && (
                                <div className="ml-4">
                                  <MOURenewalTimeline
                                    item={vaultItem}
                                    vendorStatus={vendor.status}
                                    compact
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Archive className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p>No vault documents for this vendor</p>
                          {isStaff && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => setVaultUploadOpen(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Upload Document
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Generated MOUs Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Generated MOUs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {mousLoading ? (
                        <div className="space-y-3">
                          {[1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : mous && mous.length > 0 ? (
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-3">
                            {mous.map((mou) => (
                              <div
                                key={mou.id}
                                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => navigate("/mous")}
                              >
                                <div>
                                  <p className="font-medium text-foreground">{mou.title}</p>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {mou.start_date && mou.end_date ? (
                                      <span>
                                        {format(new Date(mou.start_date), "MMM d, yyyy")} - {format(new Date(mou.end_date), "MMM d, yyyy")}
                                      </span>
                                    ) : (
                                      <span>No dates set</span>
                                    )}
                                  </div>
                                </div>
                                <Badge className={mouStatusColors[mou.status]}>
                                  {mou.status.replace("_", " ")}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                          <p>No generated MOUs for this vendor</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>


              {/* Issues Tab */}
              <TabsContent value="issues">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Ticket className="w-5 h-5" />
                      Issue History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {issuesLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : issues && issues.length > 0 ? (
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-3">
                          {issues.map((issue) => (
                            <div
                              key={issue.id}
                              className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => navigate("/issues")}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{issue.title}</p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={priorityColors[issue.priority]}>
                                  {issue.priority}
                                </Badge>
                                <Badge className={issueStatusColors[issue.status]}>
                                  {issue.status.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No issues reported for this vendor</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Documents
                    </CardTitle>
                    {isStaff && (
                      <VendorDocumentUpload vendorId={id!} onUploadComplete={() => refetchDocs()} />
                    )}
                  </CardHeader>
                  <CardContent>
                    {documentsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : documents && documents.length > 0 ? (
                      <div className="space-y-3">
                        {documents.map((doc) => {
                          const isImage = doc.file_url?.startsWith("data:image/") || doc.file_url?.match(/\.(jpg|jpeg|png|webp)/i);
                          const isPdf = doc.file_url?.startsWith("data:application/pdf") || doc.file_url?.match(/\.pdf/i);
                          const isDataUrl = doc.file_url?.startsWith("data:");

                          const handlePreview = () => {
                            setPreviewDoc({ name: doc.name, url: doc.file_url, isImage: !!isImage, isPdf: !!isPdf });
                          };

                          const handleDownload = () => {
                            const a = document.createElement("a");
                            a.href = doc.file_url;
                            a.download = doc.name || "document";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          };

                          return (
                            <div
                              key={doc.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/40 gap-3"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                {isImage ? (
                                  <div
                                    className="w-12 h-12 rounded-lg border bg-background overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={handlePreview}
                                  >
                                    <img src={doc.file_url} alt={doc.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                  </div>
                                ) : isPdf ? (
                                  <div
                                    className="w-12 h-12 rounded-lg bg-red-500/10 border border-red-200 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={handlePreview}
                                  >
                                    <FileText className="w-6 h-6 text-red-500" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-6 h-6 text-primary" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-foreground truncate">{doc.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">
                                      {doc.file_type.replace("_", " ")}
                                    </span>
                                    {doc.file_size && (
                                      <span className="text-xs text-muted-foreground">
                                        {(doc.file_size / 1024).toFixed(1)} KB
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-end sm:self-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={handlePreview}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Preview
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={handleDownload}
                                  title="Download Document"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </Button>
                                {isStaff && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={async () => {
                                      await deleteDocument.mutateAsync({
                                        id: doc.id,
                                        vendorId: id!,
                                        fileUrl: doc.file_url,
                                      });
                                      refetchDocs();
                                    }}
                                    title="Delete Document"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No documents uploaded for this vendor</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Remarks Tab */}
              <TabsContent value="remarks">
                <VendorRemarks vendorId={id!} />
              </TabsContent>

              {/* Inline Document Preview Dialog */}
              <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0">
                  <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-primary" />
                      {previewDoc?.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-hidden">
                    {previewDoc?.isImage ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/20 p-4">
                        <img
                          src={previewDoc.url}
                          alt={previewDoc.name}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={previewDoc?.url}
                        className="w-full h-full border-0"
                        title={previewDoc?.name}
                      />
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              {/* Team Tab */}
              <TabsContent value="team">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Assigned Team Members
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {assignmentsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : assignments && assignments.length > 0 ? (
                      <div className="space-y-3">
                        {assignments.map((assignment) => {
                          const employee = assignment.employee as {
                            id: string;
                            full_name: string | null;
                            email: string;
                            department: string | null;
                          } | null;

                          const getInitials = (name: string | null, email: string) => {
                            if (name) {
                              return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                            }
                            return email.slice(0, 2).toUpperCase();
                          };

                          return (
                            <div
                              key={assignment.id}
                              className="flex items-center gap-4 p-4 rounded-lg bg-muted/30"
                            >
                              <Avatar>
                                <AvatarFallback className="gradient-primary text-primary-foreground">
                                  {getInitials(employee?.full_name || null, employee?.email || "")}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">
                                  {employee?.full_name || "Unknown Employee"}
                                </p>
                                <p className="text-sm text-muted-foreground">{employee?.email}</p>
                              </div>
                              {employee?.department && (
                                <Badge variant="outline">{employee.department}</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No team members assigned to this vendor</p>
                        {isStaff && (
                          <Button
                            variant="link"
                            className="mt-2"
                            onClick={() => navigate(`/hr-performance?tab=assignments&vendorId=${id}`)}
                          >
                            Manage Assignments
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VendorTimeline vendorId={id!} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Form Dialog */}
      <VendorForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        vendor={vendor}
      />

      {/* MOU Vault Upload Dialog */}
      <MOUVaultUpload
        open={vaultUploadOpen}
        onOpenChange={setVaultUploadOpen}
        preselectedVendorId={id}
      />

      {/* MOU Document Viewer */}
      <MOUDocumentViewer
        item={viewerVaultItem}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        vendorStatus={vendor.status}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Vendor
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-bold text-foreground">"{vendor.name}"</span>?
              This action is permanent and will remove all associated data including MOUs, documents, and records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVendor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteVendorMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
