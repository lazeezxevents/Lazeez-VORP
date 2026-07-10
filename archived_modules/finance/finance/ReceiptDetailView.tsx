import { useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Edit,
  Link as LinkIcon,
  Tag,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  CreditCard,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useReceiptVault } from "@/components/hooks/useReceiptVault";
import type { Receipt, ReceiptStatus } from "@/types/receipt";
import { ReceiptVault } from "@/services/ReceiptVault";

interface ReceiptDetailViewProps {
  receiptId: string;
  onClose: () => void;
}

export const ReceiptDetailView = ({ receiptId, onClose }: ReceiptDetailViewProps) => {
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<any>({});

  const { useReceipt, updateReceipt, extractReceiptData } = useReceiptVault();
  const { data: receipt, isLoading } = useReceipt(receiptId);

  const [imageUrl, setImageUrl] = useState<string>("");

  // Load image URL
  useState(() => {
    if (receipt?.file_path) {
      ReceiptVault.getReceiptFileUrl(receipt.file_path).then(setImageUrl);
    }
  });

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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  const handleSaveEdits = () => {
    if (receipt) {
      updateReceipt.mutate({
        receiptId: receipt.id,
        updates: {
          extracted_data: {
            ...receipt.extracted_data,
            ...editedData,
          },
        },
      });
      setIsEditing(false);
      setEditedData({});
    }
  };

  const handleExtractData = () => {
    extractReceiptData.mutate(receiptId);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-96 w-full" />
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!receipt) {
    return null;
  }

  const confidence = receipt.extracted_data?.confidence_score || 0;
  const needsReview = receipt.status === "manual_review";

  return (
    <motion.div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                Receipt details
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{receipt.file_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(receipt.status)} variant="secondary">
                {receipt.status.replace("_", " ")}
              </Badge>
              {confidence > 0 && (
                <Badge
                  variant="outline"
                  className={confidence >= 70 ? "border-success text-success" : "border-warning text-warning"}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {confidence}% confidence
                </Badge>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receipt image preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Receipt image</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleZoomOut}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
                    <Button variant="outline" size="sm" onClick={handleZoomIn}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-auto bg-muted/30 p-4 max-h-[600px]">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={receipt.file_name}
                      style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                      className="transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-96">
                      <p className="text-muted-foreground">Loading image...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted data */}
              <div className="space-y-6">
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {receipt.status === "pending" && (
                    <Button onClick={handleExtractData} disabled={extractReceiptData.isPending}>
                      {extractReceiptData.isPending ? "Extracting..." : "Extract data"}
                    </Button>
                  )}
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit data
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleSaveEdits} disabled={updateReceipt.isPending}>
                        Save changes
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button variant="outline">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Link
                  </Button>
                  <Button variant="outline">
                    <Tag className="w-4 h-4 mr-2" />
                    Tags
                  </Button>
                </div>

                {needsReview && (
                  <Card className="border-warning bg-warning/5">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">Manual review required</p>
                          <p className="text-sm text-muted-foreground">
                            Low confidence or validation issues detected. Please review and correct the extracted data.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Extracted fields */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Extracted data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Merchant name */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Merchant name
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editedData.merchant_name ?? receipt.extracted_data?.merchant_name ?? ""}
                          onChange={(e) =>
                            setEditedData({ ...editedData, merchant_name: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-sm">
                          {receipt.extracted_data?.merchant_name || (
                            <span className="text-muted-foreground">Not extracted</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Transaction date */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Transaction date
                      </Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedData.transaction_date ?? receipt.extracted_data?.transaction_date ?? ""}
                          onChange={(e) =>
                            setEditedData({ ...editedData, transaction_date: e.target.value })
                          }
                        />
                      ) : (
                        <p className="text-sm">
                          {receipt.extracted_data?.transaction_date || (
                            <span className="text-muted-foreground">Not extracted</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Total amount */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Total amount
                      </Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedData.total_amount ?? receipt.extracted_data?.total_amount ?? ""}
                          onChange={(e) =>
                            setEditedData({ ...editedData, total_amount: parseFloat(e.target.value) })
                          }
                        />
                      ) : (
                        <p className="text-sm">
                          {receipt.extracted_data?.total_amount ? (
                            <>PKR {receipt.extracted_data.total_amount.toLocaleString()}</>
                          ) : (
                            <span className="text-muted-foreground">Not extracted</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Tax amount */}
                    {receipt.extracted_data?.tax_amount && (
                      <div className="space-y-2">
                        <Label>Tax amount</Label>
                        <p className="text-sm">PKR {receipt.extracted_data.tax_amount.toLocaleString()}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Optional fields */}
                    {receipt.extracted_data?.merchant_address && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Merchant address
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {receipt.extracted_data.merchant_address}
                        </p>
                      </div>
                    )}

                    {receipt.extracted_data?.payment_method && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Payment method
                        </Label>
                        <p className="text-sm">{receipt.extracted_data.payment_method}</p>
                      </div>
                    )}

                    {receipt.extracted_data?.invoice_number && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          Invoice number
                        </Label>
                        <p className="text-sm font-mono">{receipt.extracted_data.invoice_number}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Line items */}
                {receipt.extracted_data?.line_items && receipt.extracted_data.line_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Line items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {receipt.extracted_data.line_items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{item.description}</span>
                            <span className="font-medium">PKR {item.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Linked entities */}
                {receipt.linked_entity_type && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Linked to</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{receipt.linked_entity_type}</Badge>
                        <span className="text-sm text-muted-foreground font-mono">
                          {receipt.linked_entity_id}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
