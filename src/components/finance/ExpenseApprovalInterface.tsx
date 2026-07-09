import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Receipt,
  Calendar,
  DollarSign,
  User,
  FileText,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePendingApprovals, useApproveExpense, useRejectExpense } from "./useExpenses";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Expense Approval Interface
 * 
 * Features:
 * - Show pending expenses for approver
 * - Display expense details and receipt
 * - Provide approve/reject actions
 * - Framer Motion animations
 * - Loading and empty states
 * 
 * Requirements: 9.5, 9.6
 * Task: 18.6 Build expense approval interface
 */

// =====================================================
// Component
// =====================================================

export function ExpenseApprovalInterface() {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  const { data: pendingExpenses, isLoading } = usePendingApprovals();
  const approveExpense = useApproveExpense();
  const rejectExpense = useRejectExpense();

  const selectedExpense = pendingExpenses?.find(e => e.id === selectedExpenseId);

  // Handle approve
  const handleApprove = async (expenseId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await approveExpense.mutateAsync({
      expenseId,
      approverId: user.id,
      notes: approvalNotes || undefined,
    });

    setSelectedExpenseId(null);
    setApprovalNotes("");
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedExpenseId || !rejectionReason.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await rejectExpense.mutateAsync({
      expenseId: selectedExpenseId,
      approverId: user.id,
      reason: rejectionReason,
    });

    setRejectDialogOpen(false);
    setSelectedExpenseId(null);
    setRejectionReason("");
  };

  // Status badge configuration
  const getStatusBadge = (status: string) => {
    const config = {
      submitted: { color: "bg-blue-500/10 text-blue-500", label: "Submitted" },
      pending_approval: { color: "bg-yellow-500/10 text-yellow-500", label: "Pending approval" },
      approved: { color: "bg-green-500/10 text-green-500", label: "Approved" },
      rejected: { color: "bg-red-500/10 text-red-500", label: "Rejected" },
      reimbursed: { color: "bg-purple-500/10 text-purple-500", label: "Reimbursed" },
    };

    const statusConfig = config[status as keyof typeof config] || config.submitted;

    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (!pendingExpenses || pendingExpenses.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12"
      >
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No pending approvals</h3>
        <p className="text-sm text-muted-foreground">
          All expenses have been reviewed
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Expense approvals</h2>
          <p className="text-sm text-muted-foreground">
            {pendingExpenses.length} expense{pendingExpenses.length !== 1 ? 's' : ''} pending your approval
          </p>
        </div>
      </div>

      {/* Expense List */}
      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
      >
        <AnimatePresence>
          {pendingExpenses.map((expense) => (
            <motion.div
              key={expense.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: { opacity: 1, y: 0 },
              }}
              exit={{ opacity: 0, x: -20 }}
              layout
            >
              <Card
                className="hover-lift transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedExpenseId(expense.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Expense Details */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Receipt className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{expense.category}</h3>
                          <p className="text-sm text-muted-foreground">
                            {expense.description?.substring(0, 100)}
                            {expense.description && expense.description.length > 100 ? '...' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{(expense as any).employee?.full_name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{format(new Date(expense.submitted_at), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>

                      {expense.policy_violation_flags && (
                        <div className="flex items-center gap-2 text-sm text-yellow-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Policy violations detected</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Amount and Status */}
                    <div className="text-right space-y-2">
                      <div className="text-2xl font-bold">
                        ₨{expense.amount.toLocaleString()}
                      </div>
                      {getStatusBadge(expense.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Expense Detail Dialog */}
      <Dialog open={!!selectedExpenseId} onOpenChange={(open) => !open && setSelectedExpenseId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedExpense && (
            <>
              <DialogHeader>
                <DialogTitle>Expense details</DialogTitle>
                <DialogDescription>
                  Review the expense details and approve or reject
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Employee Info */}
                <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg">
                  <User className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{(selectedExpense as any).employee?.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedExpense as any).employee?.email}
                    </p>
                  </div>
                </div>

                {/* Expense Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">{selectedExpense.category}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Amount</Label>
                    <p className="font-medium text-lg">₨{selectedExpense.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Expense date</Label>
                    <p className="font-medium">
                      {format(new Date(selectedExpense.expense_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Submitted</Label>
                    <p className="font-medium">
                      {format(new Date(selectedExpense.submitted_at), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 text-sm">{selectedExpense.description}</p>
                </div>

                {/* Receipt */}
                {selectedExpense.receipt_vault_id && (
                  <div>
                    <Label className="text-muted-foreground">Receipt</Label>
                    <div className="mt-2 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm">Receipt attached</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Policy Violations */}
                {selectedExpense.policy_violation_flags && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-600">Policy violations</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          This expense has been flagged for policy violations
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approval Notes */}
                <div>
                  <Label htmlFor="approval-notes">Notes (optional)</Label>
                  <Textarea
                    id="approval-notes"
                    placeholder="Add any notes about this approval..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectDialogOpen(true);
                  }}
                  disabled={approveExpense.isPending || rejectExpense.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => handleApprove(selectedExpense.id)}
                    disabled={approveExpense.isPending || rejectExpense.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {approveExpense.isPending ? 'Approving...' : 'Approve'}
                  </Button>
                </motion.div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject expense</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this expense
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Rejection reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this expense is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2 min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejectExpense.isPending}
            >
              {rejectExpense.isPending ? 'Rejecting...' : 'Reject expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
