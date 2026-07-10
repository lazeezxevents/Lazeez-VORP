import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Calendar,
  Settings,
  AlertCircle,
} from "lucide-react";
import { useVendorFinancialProfile } from "@/components/hooks/useVendorFinancialProfile";
import { CommissionRulesDialog } from "./CommissionRulesDialog";
import { useState } from "react";

interface VendorFinancialProfileCardProps {
  vendorId: string;
}

export function VendorFinancialProfileCard({ vendorId }: VendorFinancialProfileCardProps) {
  const { profile, isLoading, initializeProfile, isInitializing } = useVendorFinancialProfile(vendorId);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Financial profile not set up
          </CardTitle>
          <CardDescription>
            Initialize the financial profile to manage commission rules and track vendor finances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => initializeProfile()}
            disabled={isInitializing}
          >
            {isInitializing ? "Initializing..." : "Initialize financial profile"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const subscriptionStatusColors = {
    active: "bg-success/10 text-success",
    suspended: "bg-warning/10 text-warning",
    cancelled: "bg-destructive/10 text-destructive",
    pending: "bg-info/10 text-info",
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Financial profile</CardTitle>
                <CardDescription>
                  Commission rules, subscription status, and financial summary
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommissionDialog(true)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Commission Configuration */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Commission configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="font-medium capitalize">{profile.commission_model.replace('_', ' ')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-medium">
                    {profile.commission_rate ? `${profile.commission_rate}%` : "Variable"}
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription Status */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Subscription status</h3>
              <div className="flex items-center justify-between">
                <Badge className={subscriptionStatusColors[profile.subscription_status]}>
                  {profile.subscription_status}
                </Badge>
                {profile.threshold_limit && (
                  <div className="text-sm text-muted-foreground">
                    {profile.current_threshold} / {profile.threshold_limit} orders
                  </div>
                )}
              </div>
              {profile.next_billing_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Next billing: {new Date(profile.next_billing_date).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Financial summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  className="p-3 rounded-lg bg-accent/50"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">Total revenue</p>
                  </div>
                  <p className="text-lg font-bold">
                    ${profile.total_revenue.toLocaleString()}
                  </p>
                </motion.div>

                <motion.div
                  className="p-3 rounded-lg bg-accent/50"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-info" />
                    <p className="text-xs text-muted-foreground">Commission paid</p>
                  </div>
                  <p className="text-lg font-bold">
                    ${profile.total_commission_paid.toLocaleString()}
                  </p>
                </motion.div>

                <motion.div
                  className="p-3 rounded-lg bg-accent/50"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-warning" />
                    <p className="text-xs text-muted-foreground">Total payouts</p>
                  </div>
                  <p className="text-lg font-bold">
                    ${profile.total_payouts.toLocaleString()}
                  </p>
                </motion.div>

                <motion.div
                  className="p-3 rounded-lg bg-accent/50"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-destructive" />
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                  </div>
                  <p className="text-lg font-bold">
                    ${profile.outstanding_balance.toLocaleString()}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Payment Configuration */}
            {(profile.payment_terms || profile.preferred_payment_method) && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Payment configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  {profile.payment_terms && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Payment terms</p>
                      <p className="font-medium">{profile.payment_terms}</p>
                    </div>
                  )}
                  {profile.preferred_payment_method && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Preferred method</p>
                      <p className="font-medium capitalize">{profile.preferred_payment_method}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <CommissionRulesDialog
        vendorId={vendorId}
        open={showCommissionDialog}
        onOpenChange={setShowCommissionDialog}
      />
    </>
  );
}
