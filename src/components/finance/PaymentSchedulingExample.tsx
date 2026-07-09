import { motion } from "framer-motion";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, List, AlertTriangle, Plus } from "lucide-react";
import { PaymentScheduleForm } from "./PaymentScheduleForm";
import { PaymentScheduleList } from "./PaymentScheduleList";
import { PaymentScheduleCalendar } from "./PaymentScheduleCalendar";
import { UpcomingPaymentAlerts } from "./UpcomingPaymentAlerts";

/**
 * Payment Scheduling Example Component
 * 
 * Demonstrates the complete payment scheduling system with:
 * - Payment scheduling form
 * - Payment schedule calendar view
 * - Payment schedule list with filters
 * - Upcoming payment alerts
 * 
 * This component serves as both an example and a ready-to-use page
 * for the payment scheduling feature.
 * 
 * Requirements: 8.3, 8.6, 8.10
 * Task: 17.4 Implement payment scheduling
 */

// =====================================================
// ANIMATION VARIANTS
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// =====================================================
// COMPONENT
// =====================================================

export function PaymentSchedulingExample() {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("alerts");

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payment scheduling</h1>
            <p className="text-muted-foreground mt-1">
              Manage and schedule vendor payments
            </p>
          </div>
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Schedule payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule a payment</DialogTitle>
              </DialogHeader>
              <PaymentScheduleForm
                onSuccess={() => setShowScheduleDialog(false)}
                onCancel={() => setShowScheduleDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List
            </TabsTrigger>
          </TabsList>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6 mt-6">
            <UpcomingPaymentAlerts />
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-6">
            <PaymentScheduleCalendar />
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list" className="mt-6">
            <PaymentScheduleList />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Usage Instructions (for development/documentation) */}
      <motion.div variants={itemVariants}>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Usage instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Components included:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">PaymentScheduleForm</code> - 
                  Schedule new payments with date, method, and notes
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">PaymentScheduleCalendar</code> - 
                  Monthly calendar view with payment indicators
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">PaymentScheduleList</code> - 
                  Filterable table with sort and search
                </li>
                <li>
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">UpcomingPaymentAlerts</code> - 
                  Alert panel for payments due in next 7 days
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Features:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Schedule payments based on due dates (Requirement 8.3)</li>
                <li>Generate payment schedule reports (Requirement 8.6)</li>
                <li>Alert on upcoming large payments &gt; ₨10,000 (Requirement 8.10)</li>
                <li>Filter by date range, vendor, amount, and status</li>
                <li>View, edit, and cancel scheduled payments</li>
                <li>Real-time updates via Supabase subscriptions</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">Integration:</h4>
              <p>
                This component integrates with the <code className="text-xs bg-muted px-1 py-0.5 rounded">AccountsPayableService</code> 
                {" "}to schedule payments. Scheduled payments are tracked in the audit log system until a dedicated 
                table is created. The system validates that payment dates are not in the past and supports 
                multiple payment methods (bank transfer, check, wire, cash, online).
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs">
                <strong>Note:</strong> This example page can be removed in production. 
                Individual components can be imported and used separately as needed.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
