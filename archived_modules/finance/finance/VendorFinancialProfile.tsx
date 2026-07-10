import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { 
  DollarSign, 
  TrendingUp, 
  Wallet, 
  Settings, 
  Save,
  AlertCircle,
  Building2,
  CreditCard,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  useVendorFinancialProfile, 
  useUpdateVendorFinancialProfile,
  useInitializeVendorProfile 
} from "@/components/hooks/useVendorFinancialProfile";
import { 
  updateVendorFinancialProfileSchema,
  type UpdateVendorFinancialProfileInput,
  type CommissionModel,
  type SubscriptionStatus
} from "./types";

/**
 * Vendor Financial Profile Component
 * 
 * Displays and manages vendor financial configuration:
 * - Commission rules
 * - Subscription settings
 * - Payment terms
 * - Financial summary
 * 
 * Requirements: 3.7, 6.9
 */

interface VendorFinancialProfileProps {
  vendorId: string;
  vendorName: string;
}

export function VendorFinancialProfile({ vendorId, vendorName }: VendorFinancialProfileProps) {
  const { data: profile, isLoading } = useVendorFinancialProfile(vendorId);
  const updateProfile = useUpdateVendorFinancialProfile(vendorId);
  const initializeProfile = useInitializeVendorProfile();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<UpdateVendorFinancialProfileInput>({
    resolver: zodResolver(updateVendorFinancialProfileSchema),
    values: profile ? {
      commission_model: profile.commission_model,
      commission_rate: profile.commission_rate,
      subscription_status: profile.subscription_status,
      threshold_limit: profile.threshold_limit,
      payment_terms: profile.payment_terms,
      preferred_payment_method: profile.preferred_payment_method,
      tax_id: profile.tax_id,
    } : undefined,
  });

  const handleInitialize = () => {
    initializeProfile.mutate(vendorId);
  };

  const onSubmit = (data: UpdateVendorFinancialProfileInput) => {
    updateProfile.mutate(data, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial profile</CardTitle>
          <CardDescription>No financial profile found for {vendorName}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This vendor does not have a financial profile yet. Initialize one to start tracking
              commissions, subscriptions, and payments.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleInitialize} 
            className="mt-4"
            disabled={initializeProfile.isPending}
          >
            {initializeProfile.isPending ? "Initializing..." : "Initialize financial profile"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial profile</CardTitle>
            <CardDescription>{vendorName}</CardDescription>
          </div>
          <Button
            variant={isEditing ? "outline" : "default"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? "Cancel" : "Edit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="commission">Commission</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
            >
              <motion.div variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-success/10">
                        <TrendingUp className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total revenue</p>
                        <p className="text-2xl font-bold">₨{profile.total_revenue.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-warning/10">
                        <DollarSign className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Commission paid</p>
                        <p className="text-2xl font-bold">₨{profile.total_commission_paid.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-info/10">
                        <Wallet className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total payouts</p>
                        <p className="text-2xl font-bold">₨{profile.total_payouts.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="hover-lift transition-all duration-300">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-destructive/10">
                        <CreditCard className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Outstanding balance</p>
                        <p className="text-2xl font-bold">₨{profile.outstanding_balance.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Subscription status</span>
                <Badge variant={profile.subscription_status === 'active' ? 'default' : 'secondary'}>
                  {profile.subscription_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Commission model</span>
                <Badge variant="outline">{profile.commission_model}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Current threshold</span>
                <span className="text-sm font-mono">
                  {profile.current_threshold} / {profile.threshold_limit || 'N/A'}
                </span>
              </div>
            </div>
          </TabsContent>

          {/* Commission Tab */}
          <TabsContent value="commission">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="commission_model">Commission model</Label>
                  <Select
                    value={form.watch("commission_model")}
                    onValueChange={(value: CommissionModel) => 
                      form.setValue("commission_model", value)
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat rate</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="tiered">Tiered</SelectItem>
                      <SelectItem value="category_based">Category based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="commission_rate">Commission rate (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    step="0.01"
                    {...form.register("commission_rate", { valueAsNumber: true })}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>

              {isEditing && (
                <Button type="submit" disabled={updateProfile.isPending} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfile.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="subscription_status">Subscription status</Label>
                  <Select
                    value={form.watch("subscription_status")}
                    onValueChange={(value: SubscriptionStatus) => 
                      form.setValue("subscription_status", value)
                    }
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="threshold_limit">Threshold limit (orders)</Label>
                  <Input
                    id="threshold_limit"
                    type="number"
                    {...form.register("threshold_limit", { valueAsNumber: true })}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of orders before subscription billing triggers
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current progress</span>
                    <span className="text-sm font-mono">
                      {profile.current_threshold} / {profile.threshold_limit || 0}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(
                          (profile.current_threshold / (profile.threshold_limit || 1)) * 100, 
                          100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {isEditing && (
                <Button type="submit" disabled={updateProfile.isPending} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfile.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment_terms">Payment terms</Label>
                  <Input
                    id="payment_terms"
                    {...form.register("payment_terms")}
                    disabled={!isEditing}
                    placeholder="e.g., Net 30"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="preferred_payment_method">Preferred payment method</Label>
                  <Input
                    id="preferred_payment_method"
                    {...form.register("preferred_payment_method")}
                    disabled={!isEditing}
                    placeholder="e.g., Bank transfer"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    {...form.register("tax_id")}
                    disabled={!isEditing}
                    placeholder="Tax identification number"
                    className="mt-1"
                  />
                </div>

                {profile.last_payout_date && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-1">Last payout</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(profile.last_payout_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {isEditing && (
                <Button type="submit" disabled={updateProfile.isPending} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfile.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
