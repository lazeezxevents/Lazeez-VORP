import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Eye, Send, Ban, DollarSign, Calendar, AlertCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInvoices, useUpdateInvoiceStatus, useDeleteInvoice } from '@/components/hooks/useInvoices';
import usePostInvoiceToLedger from '@/components/hooks/usePostInvoiceToLedger';
import { InvoiceDetail } from './InvoiceDetail';
import { InvoiceForm } from './InvoiceForm';
import type { Invoice } from '@/components/hooks/useInvoices';

type InvoiceStatus = Invoice['status'];

const statusConfig: Record<InvoiceStatus, { color: string; label: string; icon: any }> = {
  draft: { color: 'bg-gray-500/10 text-gray-500', label: 'Draft', icon: FileText },
  sent: { color: 'bg-blue-500/10 text-blue-500', label: 'Sent', icon: Send },
  paid: { color: 'bg-green-500/10 text-green-500', label: 'Paid', icon: DollarSign },
  overdue: { color: 'bg-red-500/10 text-red-500', label: 'Overdue', icon: AlertCircle },
  void: { color: 'bg-gray-400/10 text-gray-400', label: 'Void', icon: Ban },
};

export function InvoiceList() {
  const { data: invoices, isLoading } = useInvoices();
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const { data: vendors } = useQuery({
    queryKey: ['vendors-for-invoice'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendors').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const postInvoice = usePostInvoiceToLedger();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const handleSend = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateStatus.mutateAsync({ invoiceId: id, status: 'sent' });
  };

  const handleVoid = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to void this invoice? This action cannot be undone.')) {
      await updateStatus.mutateAsync({ invoiceId: id, status: 'cancelled' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return (
      <>
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowCreateInvoice(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New invoice
          </Button>
        </div>

        <div className="text-center py-6 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-lg">No invoices found</p>
          <p className="text-sm mt-2">Create your first invoice to get started</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <InvoiceForm vendors={vendors || []} onSuccess={() => { /* invoice created -> list will refresh via hook */ }} onCancel={() => {}} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowCreateInvoice(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New invoice
        </Button>
      </div>
      <motion.div
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Issue date</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => {
              const StatusIcon = statusConfig[invoice.status].icon;
              const daysOverdue = invoice.status === 'overdue' 
                ? Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <motion.tr
                  key={invoice.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.vendor?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(invoice.issue_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                      {daysOverdue > 0 && (
                        <span className="text-xs text-destructive">
                          ({daysOverdue}d overdue)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₨{invoice.total_amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ₨{invoice.amount_paid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₨{invoice.amount_due.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[invoice.status].color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig[invoice.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(invoice);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {invoice.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleSend(invoice.id, e)}
                          disabled={updateStatus.isPending}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      {invoice.journal_entry_id == null && invoice.status !== 'void' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await postInvoice.mutateAsync(invoice.id);
                          }}
                          disabled={postInvoice.isLoading}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                      {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleVoid(invoice.id, e)}
                          disabled={updateStatus.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </motion.div>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <InvoiceForm vendors={vendors || []} onSuccess={() => setShowCreateInvoice(false)} onCancel={() => setShowCreateInvoice(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <InvoiceDetail
              invoice={selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
