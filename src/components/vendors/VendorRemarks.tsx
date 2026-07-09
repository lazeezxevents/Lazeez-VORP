import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquare, Plus, Trash2, AlertCircle, 
  CheckCircle, Info, Star, Clock
} from "lucide-react";
import { useVendorRemarks, useCreateRemark, useDeleteRemark, VendorRemark } from "@/hooks/useVendorRemarks";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface VendorRemarksProps {
  vendorId: string;
}

const remarkTypes = [
  { value: "general", label: "General", icon: MessageSquare, color: "bg-muted text-muted-foreground" },
  { value: "positive", label: "Positive", icon: CheckCircle, color: "bg-success/10 text-success" },
  { value: "concern", label: "Concern", icon: AlertCircle, color: "bg-warning/10 text-warning" },
  { value: "issue", label: "Issue", icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
  { value: "highlight", label: "Highlight", icon: Star, color: "bg-primary/10 text-primary" },
];

export function VendorRemarks({ vendorId }: VendorRemarksProps) {
  const { data: remarks, isLoading } = useVendorRemarks(vendorId);
  const createRemark = useCreateRemark();
  const deleteRemark = useDeleteRemark();
  const { isStaff, isAdmin, profile } = useAuth();
  
  const [newRemark, setNewRemark] = useState("");
  const [remarkType, setRemarkType] = useState("general");
  const [showForm, setShowForm] = useState(false);

  const handleAddRemark = async () => {
    if (!newRemark.trim()) return;
    
    await createRemark.mutateAsync({
      vendor_id: vendorId,
      remark: newRemark,
      remark_type: remarkType,
    });
    
    setNewRemark("");
    setRemarkType("general");
    setShowForm(false);
  };

  const getRemarkTypeConfig = (type: string | null) => {
    return remarkTypes.find(t => t.value === type) || remarkTypes[0];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Remark Section */}
      {isStaff && (
        <Card>
          <CardContent className="pt-4">
            {showForm ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Select value={remarkType} onValueChange={setRemarkType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {remarkTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="w-4 h-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Add a remark about this vendor..."
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddRemark} 
                    disabled={!newRemark.trim() || createRemark.isPending}
                  >
                    Add Remark
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full gap-2" 
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-4 h-4" />
                Add Remark
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remarks List */}
      {!remarks || remarks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Remarks Yet</h3>
            <p className="text-muted-foreground">
              Add remarks to track vendor interactions and observations
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {remarks.map((remark) => {
              const typeConfig = getRemarkTypeConfig(remark.remark_type);
              const TypeIcon = typeConfig.icon;
              
              return (
                <Card key={remark.id}>
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(remark.created_by_name || "U").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">
                              {remark.created_by_name || "Unknown User"}
                            </span>
                            <Badge variant="outline" className={cn("text-xs", typeConfig.color)}>
                              <TypeIcon className="w-3 h-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(remark.created_at), { addSuffix: true })}
                            </span>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteRemark.mutate(remark.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {remark.remark}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(remark.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
