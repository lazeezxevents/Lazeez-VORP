import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  LayoutGrid,
  Loader2,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Archive
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMOUVault, MOUVaultItem } from "@/hooks/useMOUVault";
import { useVendors } from "@/hooks/useVendors";
import { MOUVaultUpload } from "@/components/mous/MOUVaultUpload";
import { MOUVaultCard } from "@/components/mous/MOUVaultCard";
import { MOUExtractionStatus } from "@/components/mous/MOUExtractionStatus";
import { MOUExpirationTracker } from "@/components/mous/MOUExpirationTracker";
import { MOUDocumentViewer } from "@/components/mous/MOUDocumentViewer";
import { MOUAgentBar } from "@/components/mous/MOUAgentBar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SortOption = "recent" | "expiration" | "vendor";

export default function MOUVaultContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MOUVaultItem | null>(null);
  const [viewerItem, setViewerItem] = useState<MOUVaultItem | null>(null);

  const { data: vaultItems, isLoading } = useMOUVault();
  const { data: vendors } = useVendors();

  const filteredItems = useMemo(() => {
    if (!vaultItems) return [];

    let filtered = vaultItems.filter((item) => {
      const matchesSearch =
        item.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesVendor = vendorFilter === "all" || item.vendor_id === vendorFilter;
      const matchesStatus = statusFilter === "all" || item.extraction_status === statusFilter;

      return matchesSearch && matchesVendor && matchesStatus;
    });

    switch (sortBy) {
      case "expiration":
        filtered = filtered.sort((a, b) => {
          if (!a.effective_end_date) return 1;
          if (!b.effective_end_date) return -1;
          return new Date(a.effective_end_date).getTime() - new Date(b.effective_end_date).getTime();
        });
        break;
      case "vendor":
        filtered = filtered.sort((a, b) =>
          (a.vendor?.name || "").localeCompare(b.vendor?.name || "")
        );
        break;
      default:
        break;
    }

    return filtered;
  }, [vaultItems, searchQuery, vendorFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    if (!vaultItems) return { total: 0, pending: 0, completed: 0, expiringSoon: 0 };

    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      total: vaultItems.length,
      pending: vaultItems.filter((i) => i.extraction_status === "pending" || i.extraction_status === "processing").length,
      completed: vaultItems.filter((i) => i.extraction_status === "completed").length,
      expiringSoon: vaultItems.filter((i) =>
        i.effective_end_date && new Date(i.effective_end_date) <= thirtyDays
      ).length,
    };
  }, [vaultItems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Archive className="w-4 h-4" />
              <span className="text-sm">Total Documents</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-info">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending Extraction</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Extracted</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Expiring Soon</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.expiringSoon}</p>
          </CardContent>
        </Card>
      </div>

      <MOUAgentBar className="mb-8" />

      {/* Tabs */}
      <Tabs defaultValue="vault">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="vault" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              Vault View
            </TabsTrigger>
            <TabsTrigger value="tracker" className="gap-2">
              <Clock className="w-4 h-4" />
              Expiration Tracker
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Upload Document
          </Button>
        </div>

        <TabsContent value="vault" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Vendors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors?.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="expiration">Expiration Date</SelectItem>
                <SelectItem value="vendor">Vendor Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid with Branching Tree Support */}
          {filteredItems.length > 0 ? (
            <div className="space-y-6">
              {(() => {
                // Build a map: parentId -> daughter items
                const daughterMap = new Map<string, MOUVaultItem[]>();
                filteredItems.forEach((item) => {
                  if (item.parent_vault_id) {
                    const existing = daughterMap.get(item.parent_vault_id) || [];
                    existing.push(item);
                    daughterMap.set(item.parent_vault_id, existing);
                  }
                });

                // IDs that are daughters of some parent
                const daughterIds = new Set(
                  filteredItems.filter((i) => !!i.parent_vault_id).map((i) => i.id)
                );

                // Root items = items that are NOT a daughter of another item in the current view
                const rootItems = filteredItems.filter((item) => !daughterIds.has(item.id));

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rootItems.map((item) => {
                      const daughters = daughterMap.get(item.id) || [];
                      return (
                        <MOUVaultCard
                          key={item.id}
                          item={item}
                          daughters={daughters}
                          onViewDetails={setSelectedItem}
                          onViewDocument={setViewerItem}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No documents found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || vendorFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Upload your first MOU document to get started"}
                </p>
                {!searchQuery && vendorFilter === "all" && statusFilter === "all" && (
                  <Button onClick={() => setUploadOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tracker">
          <MOUExpirationTracker items={vaultItems || []} />
        </TabsContent>
      </Tabs>

      <MOUVaultUpload open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Document Viewer */}
      <MOUDocumentViewer
        item={viewerItem}
        open={!!viewerItem}
        onOpenChange={(open) => !open && setViewerItem(null)}
      />

      {/* Extraction Details Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedItem?.document_name}</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <ScrollArea className="h-[calc(100vh-8rem)] mt-6 pr-4">
              <MOUExtractionStatus item={selectedItem} onClose={() => setSelectedItem(null)} />
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
