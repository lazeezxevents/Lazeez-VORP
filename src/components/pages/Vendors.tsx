import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout";
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Building2,
  Mail,
  MapPin,
  TrendingUp,
  AlertCircle,
  Loader2,
  Phone
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVendors, useDeleteVendor, Vendor, VendorStatus } from "@/hooks/useVendors";
import { VendorForm } from "@/components/vendors/VendorForm";
import { VendorExportButton } from "@/components/vendors/VendorExportButton";
import { useAuth } from "@/contexts/AuthContext";
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

const statusColors: Record<VendorStatus, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-muted",
  pending: "bg-warning/10 text-warning border-warning/20",
  blacklisted: "bg-destructive/10 text-destructive border-destructive/20",
  onboarded: "bg-success/10 text-success border-success/20",
  terminated: "bg-destructive/10 text-destructive border-destructive/20",
  left: "bg-muted text-muted-foreground border-muted",
  new: "bg-info/10 text-info border-info/20",
  legacy: "bg-muted text-muted-foreground border-dashed border-2",
};

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

export default function Vendors() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);


  const { data: vendors, isLoading } = useVendors();
  const deleteVendorMutation = useDeleteVendor();
  const { isStaff, isAdmin } = useAuth();

  const filteredVendors = vendors?.filter((vendor) => {
    const matchesSearch =
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (vendor.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const activeCount = vendors?.filter(v => v.status === "active").length || 0;
  const avgRating = vendors?.length
    ? (vendors.reduce((acc, v) => acc + (v.rating || 0), 0) / vendors.filter(v => v.rating).length || 0).toFixed(1)
    : "0.0";

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (deleteVendor) {
      await deleteVendorMutation.mutateAsync(deleteVendor.id);
      setDeleteVendor(null);
    }
  };

  return (
    <DashboardLayout title="Vendors" subtitle="Manage your vendor ecosystem">
      <div className="space-y-6 animate-fade-in">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="onboarded">Onboarded</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <VendorExportButton vendors={vendors || []} variant="bulk" />
            {isStaff && (
              <Button className="gap-2 font-poppins" onClick={() => { setEditingVendor(null); setFormOpen(true); }}>
                <Plus className="w-4 h-4" />
                Add Vendor
              </Button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="animate-stagger-fade-in" style={{ animationDelay: '0ms' }}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Vendors</p>
              <p className="text-2xl font-bold">{vendors?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="animate-stagger-fade-in" style={{ animationDelay: '80ms' }}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-success">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="animate-stagger-fade-in" style={{ animationDelay: '160ms' }}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-warning">
                {vendors?.filter(v => v.status === "pending").length || 0}
              </p>
            </CardContent>
          </Card>
          <Card className="animate-stagger-fade-in" style={{ animationDelay: '240ms' }}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Rating</p>
              <p className="text-2xl font-bold">{avgRating}</p>
            </CardContent>
          </Card>
        </div>

        {/* Vendors Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No vendors found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first vendor"}
              </p>
              {isStaff && !searchQuery && statusFilter === "all" && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vendor
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredVendors.map((vendor, index) => (
              <Card
                key={vendor.id}
                className="cursor-pointer group animate-stagger-fade-in"
                style={{ animationDelay: `${index * 60}ms` }}
                onClick={() => navigate(`/vendors/${vendor.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {vendor.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {categoryLabels[vendor.category]}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/vendors/${vendor.id}`);
                        }}>
                          View Details
                        </DropdownMenuItem>
                        {isStaff && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(vendor);
                          }}>
                            Edit Vendor
                          </DropdownMenuItem>
                        )}
                        {isAdmin && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteVendor(vendor);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 mb-4">
                    {vendor.contact_person && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{vendor.contact_person}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.city && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{vendor.city}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <Badge variant="outline" className={statusColors[vendor.status]}>
                      {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
                    </Badge>
                    <div className="flex items-center gap-4 text-sm">
                      {vendor.rating && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground font-medium">{vendor.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>


      <VendorForm
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={editingVendor}
      />

      <AlertDialog open={!!deleteVendor} onOpenChange={() => setDeleteVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteVendor?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
