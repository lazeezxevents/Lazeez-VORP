/**
 * Receipt Card Component
 * Displays receipt information in grid or list view
 */

import { motion } from "framer-motion";
import {
  FileText,
  Calendar,
  DollarSign,
  Tag,
  Link as LinkIcon,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Receipt } from "./types";

interface ReceiptCardProps {
  receipt: Receipt;
  viewMode: 'grid' | 'list';
  onClick?: (receiptId: string) => void;
}

export function ReceiptCard({ receipt, viewMode, onClick }: ReceiptCardProps) {
  // Status configuration
  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'bg-warning/10 text-warning',
      label: 'Pending',
    },
    processed: {
      icon: CheckCircle,
      color: 'bg-success/10 text-success',
      label: 'Processed',
    },
    verified: {
      icon: CheckCircle,
      color: 'bg-info/10 text-info',
      label: 'Verified',
    },
    failed: {
      icon: XCircle,
      color: 'bg-destructive/10 text-destructive',
      label: 'Failed',
    },
  };

  // Category colors
  const categoryColors = {
    riders: 'bg-blue-500/10 text-blue-500',
    vendors: 'bg-purple-500/10 text-purple-500',
    general: 'bg-gray-500/10 text-gray-500',
  };

  const status = statusConfig[receipt.status];
  const StatusIcon = status.icon;

  // Extract amount from extracted data
  const amount = receipt.extracted_data?.totalAmount;
  const merchantName = receipt.extracted_data?.merchantName;

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          className="hover-lift transition-all duration-300 cursor-pointer"
          onClick={() => onClick?.(receipt.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 flex-shrink-0">
                {receipt.file_type.startsWith('image/') ? (
                  <img
                    src={receipt.file_url}
                    alt={receipt.file_name}
                    className="w-full h-full object-cover rounded border"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted rounded border">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {merchantName || receipt.file_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {receipt.file_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={categoryColors[receipt.category]}>
                      {receipt.category}
                    </Badge>
                    <Badge className={status.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(receipt.uploaded_at), 'MMM d, yyyy')}
                  </div>

                  {amount && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      PKR {amount.toLocaleString()}
                    </div>
                  )}

                  {receipt.confidence_score && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs">
                        {receipt.confidence_score}% confidence
                      </span>
                    </div>
                  )}

                  {receipt.linked_entity_type && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="w-3 h-3" />
                      Linked
                    </div>
                  )}
                </div>

                {receipt.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <div className="flex flex-wrap gap-1">
                      {receipt.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {receipt.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{receipt.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Grid view
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className="hover-lift transition-all duration-300 cursor-pointer h-full"
        onClick={() => onClick?.(receipt.id)}
      >
        <CardContent className="p-4">
          {/* Image/Preview */}
          <div className="aspect-video mb-3 rounded-lg overflow-hidden bg-muted">
            {receipt.file_type.startsWith('image/') ? (
              <img
                src={receipt.file_url}
                alt={receipt.file_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {merchantName || receipt.file_name}
              </p>
              {merchantName && (
                <p className="text-xs text-muted-foreground truncate">
                  {receipt.file_name}
                </p>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <Badge className={categoryColors[receipt.category]}>
              {receipt.category}
            </Badge>
            <Badge className={status.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(receipt.uploaded_at), 'MMM d, yyyy')}
            </div>

            {amount && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-3 h-3" />
                PKR {amount.toLocaleString()}
              </div>
            )}

            {receipt.confidence_score && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">
                  {receipt.confidence_score}% confidence
                </span>
              </div>
            )}

            {receipt.linked_entity_type && (
              <div className="flex items-center gap-2 text-info">
                <LinkIcon className="w-3 h-3" />
                <span className="text-xs">Linked to {receipt.linked_entity_type}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {receipt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {receipt.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {receipt.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{receipt.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
