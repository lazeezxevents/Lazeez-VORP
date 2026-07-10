import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorPayoutDashboard } from "./VendorPayoutDashboard";
import { PayoutHistoryView } from "./PayoutHistoryView";
import { DollarSign, History, LayoutDashboard } from "lucide-react";

/**
 * Vendor Payout Example Component
 * 
 * Demonstrates integration of vendor payout components:
 * - VendorPayoutDashboard: Shows pending payouts with processing actions
 * - PayoutHistoryView: Shows completed payout history with filtering
 * 
 * This component can be integrated into the Finance page or used as a standalone page.
 * 
 * Task: 17.3 Implement vendor payout processing UI
 */

export function VendorPayoutExample() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Vendor payouts</h1>
        <p className="text-muted-foreground mt-2">
          Process vendor payouts and view payout history
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Payout dashboard
              </CardTitle>
              <CardDescription>
                View pending payouts and process vendor payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VendorPayoutDashboard />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Payout history
              </CardTitle>
              <CardDescription>
                View completed payouts and filter by vendor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayoutHistoryView />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration Notes */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Integration notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">Dashboard Component:</p>
            <p>
              The VendorPayoutDashboard shows pending payouts with summary cards and action buttons.
              It automatically refreshes every minute to show the latest data.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">History Component:</p>
            <p>
              The PayoutHistoryView displays completed payouts with vendor filtering.
              Click any row to view detailed payout breakdown.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Real-time Updates:</p>
            <p>
              Both components use TanStack Query with real-time subscriptions to automatically
              update when payouts are processed.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Payout Processing:</p>
            <p>
              When processing a payout, the system calculates net payout (remaining amount - commission),
              creates journal entries, updates vendor balances, and sends notifications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
