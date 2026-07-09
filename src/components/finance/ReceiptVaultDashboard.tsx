import { useState } from "react";
import { motion } from "framer-motion";
import { Receipt, FileText, Image, Filter, Grid, List, Search, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useReceiptVault } from "@/components/hooks/useReceiptVault";
import type { ReceiptFilters, ReceiptCategory, ReceiptStatus } from "@/types/receipt";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const ReceiptVaultDashboard = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [searchQuery, setSearchQuery] = useState("");

  const { useReceipts } = useReceiptVault();
  const { data: receipts, isLoading } = useReceipts(filters);

  // Calculate category breakdown
  const categoryBreakdown = receipts?.reduce(
    (acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + 1;
      return acc;
    },
    {} as Record<ReceiptCategory, number>
  );

  const handleFilterChange = (key: keyof ReceiptFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      search_query: searchQuery || undefined,
    }));
  };

  const getStatusColor = (status: ReceiptStatus) => {
    switch (status) {
      case "processed":
        return "bg-success/10 text-success";
      case "pending":
        return "bg-warning/10 text-warning";
      case "manual_review":
        return "bg-info/10 text-info";
      case "archived":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryIcon = (category: ReceiptCategory) => {
    switch (category) {
      case "riders":
        return Receipt;
      case "vendors":
        return FileText;
      case "general":
        return Image;
      default:
        return Receipt;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receipt vault</h2>
          <p className="text-sm text-muted-foreground">
            Manage and organize your receipts with AI-powered extraction
          </p>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload receipt
        </Button>
      </div>

      {/* Category breakdown */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {["riders", "vendors", "general"].map((category) => {
          const Icon = getCategoryIcon(category as ReceiptCategory);
          const count = categoryBreakdown?.[category as ReceiptCategory] || 0;

          return (
            <motion.div key={category} variants={itemVariants}>
              <Card className="hover-lift transition-all duration-300 cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground capitalize">{category}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filters and search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search receipts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Category filter */}
            <Select
              value={filters.category || "all"}
              onValueChange={(value) =>
                handleFilterChange("category", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="riders">Riders</SelectItem>
                <SelectItem value="vendors">Vendors</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                handleFilterChange("status", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="manual_review">Manual review</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* View mode toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {receipts?.length || 0} receipt{receipts?.length !== 1 ? "s" : ""} found
        </p>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Receipts grid/list */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "space-y-3"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : receipts && receipts.length > 0 ? (
        <motion.div
          className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-3 gap-4" : "space-y-3"}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {receipts.map((receipt) => {
            const Icon = getCategoryIcon(receipt.category);

            return (
              <motion.div key={receipt.id} variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300 cursor-pointer group">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:scale-105 transition-transform">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">
                            {receipt.file_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(receipt.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {receipt.extracted_data?.merchant_name && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Merchant:</span>{" "}
                          {receipt.extracted_data.merchant_name}
                        </p>
                      )}
                      {receipt.extracted_data?.total_amount && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Amount:</span> PKR{" "}
                          {receipt.extracted_data.total_amount.toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Badge className={getStatusColor(receipt.status)} variant="secondary">
                        {receipt.status.replace("_", " ")}
                      </Badge>
                      {receipt.extracted_data?.confidence_score && (
                        <Badge variant="outline" className="text-xs">
                          {receipt.extracted_data.confidence_score}% confidence
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No receipts found</p>
          <p className="text-sm">Upload your first receipt to get started</p>
        </div>
      )}
    </div>
  );
};
