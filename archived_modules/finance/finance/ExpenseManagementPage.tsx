import { useState } from "react";
import { motion } from "framer-motion";
import { Receipt, CheckSquare, Plus, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpenseSubmissionForm } from "./ExpenseSubmissionForm";
import { ExpenseApprovalInterface } from "./ExpenseApprovalInterface";
import { useMyExpenses, usePendingApprovals } from "./useExpenses";
import { format } from "date-fns";

/**
 * Expense Management Page
 * 
 * Comprehensive expense management interface with:
 * - Expense submission form
 * - My expenses list
 * - Pending approvals (for approvers)
 * - Expense history
 * 
 * Requirements: 9.1, 9.2, 9.5, 9.6
 * Tasks: 18.5, 18.6
 */

export function ExpenseManagementPage() {
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const { data: myExpenses } = useMyExpenses();
  const { data: pendingApprovals } = usePendingApprovals();

  // Status badge configuration
  const getStatusBadge = (status: string) => {
    const config = {
      submitted: { color: "bg-blue-500/10 text-blue-500", label: "Submitted" },
      pending_approval: { color: "bg-yellow-500/10 text-yellow-500", label: "Pending" },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Expense management</h1>
          <p className="text-muted-foreground mt-1">
            Submit and manage organization expenses
          </p>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={() => setShowSubmissionForm(!showSubmissionForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Submit expense
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
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
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Organization expenses</p>
                  <p className="text-2xl font-bold mt-1">{myExpenses?.length || 0}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Receipt className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending approval</p>
                  <p className="text-2xl font-bold mt-1">
                    {myExpenses?.filter(e => e.status === 'pending_approval' || e.status === 'submitted').length || 0}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <CheckSquare className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Needs my approval</p>
                  <p className="text-2xl font-bold mt-1">{pendingApprovals?.length || 0}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <List className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Submission Form */}
      {showSubmissionForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ExpenseSubmissionForm />
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="my-expenses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-expenses">Organization expenses</TabsTrigger>
          {pendingApprovals && pendingApprovals.length > 0 && (
            <TabsTrigger value="approvals">
              Approvals
              <Badge className="ml-2 bg-yellow-500/10 text-yellow-500">
                {pendingApprovals.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* My Expenses Tab */}
        <TabsContent value="my-expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization expenses</CardTitle>
              <CardDescription>
                View and track organization submitted expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!myExpenses || myExpenses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No expenses yet</p>
                  <p className="text-sm">Submit your first expense to get started</p>
                </div>
              ) : (
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
                  {myExpenses.map((expense) => (
                    <motion.div
                      key={expense.id}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        visible: { opacity: 1, y: 0 },
                      }}
                    >
                      <Card className="hover-lift transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                  <Receipt className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{expense.category}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(expense.expense_date), 'MMM dd, yyyy')}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="font-bold">₨{expense.amount.toLocaleString()}</p>
                              {getStatusBadge(expense.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        {pendingApprovals && pendingApprovals.length > 0 && (
          <TabsContent value="approvals">
            <ExpenseApprovalInterface />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
