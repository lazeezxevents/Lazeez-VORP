import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGeneralLedger } from "@/components/hooks/useGeneralLedger";
import { useAuth } from "@/components/contexts/AuthContext";
import type { JournalEntryWithLines } from "./types";
import { format } from "date-fns";

/**
 * Journal Entry List Component
 * 
 * Displays all journal entries with ability to view details and post entries
 */
export function JournalEntryList() {
  const { journalEntries, isLoading, postJournalEntry, isPosting } = useGeneralLedger();
  const { user } = useAuth();
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryWithLines | null>(null);

  const handlePost = (entryId: string) => {
    if (!user?.id) return;
    postJournalEntry({ journalEntryId: entryId, userId: user.id });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Posted
          </Badge>
        );
      case "void":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Void
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Draft
          </Badge>
        );
    }
  };

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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journal entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Journal entries</CardTitle>
        </CardHeader>
        <CardContent>
          {journalEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No journal entries found</p>
              <p className="text-sm">Create your first journal entry to get started</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalEntries.map((entry) => (
                    <motion.tr
                      key={entry.id}
                      variants={itemVariants}
                      className="group"
                    >
                      <TableCell className="font-mono text-sm">
                        {entry.entry_number}
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.entry_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.description || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.reference || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEntry(entry)}
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                          {entry.status === "draft" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePost(entry.id)}
                              disabled={isPosting}
                              className="gap-2"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Post
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Journal entry details</DialogTitle>
            <DialogDescription>
              Entry {selectedEntry?.entry_number} -{" "}
              {selectedEntry?.entry_date &&
                format(new Date(selectedEntry.entry_date), "MMMM dd, yyyy")}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedEntry.description || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reference</p>
                  <p className="font-medium font-mono">{selectedEntry.reference || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(selectedEntry.created_at), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
              </div>

              {/* Ledger Entries */}
              <div>
                <h4 className="font-semibold mb-3">Ledger entries</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedEntry.ledger_entries.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-medium">{line.account_id}</TableCell>
                        <TableCell>{line.description || "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {line.debit > 0 ? `Rs. ${line.debit.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {line.credit > 0 ? `Rs. ${line.credit.toFixed(2)}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        Rs. {selectedEntry.ledger_entries
                          .reduce((sum, line) => sum + line.debit, 0)
                          .toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        Rs. {selectedEntry.ledger_entries
                          .reduce((sum, line) => sum + line.credit, 0)
                          .toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Actions */}
              {selectedEntry.status === "draft" && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedEntry(null)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      handlePost(selectedEntry.id);
                      setSelectedEntry(null);
                    }}
                    disabled={isPosting}
                    className="gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Post entry
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
