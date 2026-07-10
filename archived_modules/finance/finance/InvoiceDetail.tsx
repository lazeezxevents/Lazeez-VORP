import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Send,
  Ban,
  Download,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useRecordPayment, useUpdateInvoiceStatus } from '@/components/hooks/useInvoices';
import usePostInvoiceToLedger from '@/components/hooks/usePostInvoiceToLedger';
import type { Invoice } from '@/components/hooks/useInvoices';
import type { InvoiceLineItem } from '@/components/hooks/useInvoices';

type InvoiceStatus = Invoice['status'];

interface InvoiceWithLineItems {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
}

const statusConfig: Record<InvoiceStatus, { color: string; label: string }> = {
  draft: { color: 'bg-gray-500/10 text-gray-500', label: 'Draft' },
  sent: { color: 'bg-blue-500/10 text-blue-500', label: 'Sent' },
  paid: { color: 'bg-green-500/10 text-green-500', label: 'Paid' },
  overdue: { color: 'bg-red-500/10 text-red-500', label: 'Overdue' },
  void: { color: 'bg-gray-400/10 text-gray-400', label: 'Void' },
};

interface InvoiceDetailProps {
  invoice: InvoiceWithLineItems;
  onClose?: () => void;
}

export function InvoiceDetail({ invoice, onClose }: InvoiceDetailProps) {
  const updateStatus = useUpdateInvoiceStatus();
  const recordPayment = useRecordPayment();
  const postInvoice = usePostInvoiceToLedger();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(invoice.invoice.amount_due.toString());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSend = async () => {
    await updateStatus.mutateAsync({ invoiceId: invoice.invoice.id, status: 'sent' });
  };

  const handleVoid = async () => {
    if (confirm('Are you sure you want to void this invoice? This action cannot be undone.')) {
      await updateStatus.mutateAsync({ invoiceId: invoice.invoice.id, status: 'cancelled' });
      onClose?.();
    }
  };

  const handleRecordPayment = async () => {
    await recordPayment.mutateAsync({
      invoiceId: invoice.invoice.id,
      amount: parseFloat(paymentAmount),
      paymentDate: paymentDate,
      paymentMethod: 'manual',
    });
    setShowPaymentDialog(false);
  };

  const daysOverdue = invoice.invoice.status === 'overdue'
    ? Math.floor((new Date().getTime() - new Date(invoice.invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{invoice.invoice.invoice_number}</h2>
            <Badge className={statusConfig[invoice.invoice.status].color}>
              {statusConfig[invoice.invoice.status].label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {format(new Date(invoice.invoice.created_at), 'MMM dd, yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.invoice.status === 'draft' && (
            <Button onClick={handleSend} disabled={updateStatus.isPending}>
              <Send className="w-4 h-4 mr-2" />
              Send invoice
            </Button>
          )}
          {invoice.invoice.journal_entry_id == null && invoice.invoice.status !== 'void' && (
            <Button
              variant="outline"
              onClick={() => postInvoice.mutateAsync(invoice.invoice.id)}
              disabled={postInvoice.isLoading}
            >
              <FileText className="w-4 h-4 mr-2" />
              Post to Ledger
            </Button>
          )}
          {invoice.invoice.status !== 'cancelled' && invoice.invoice.status !== 'paid' && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowPaymentDialog(true)}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Record payment
              </Button>
              <Button
                variant="outline"
                onClick={handleVoid}
                disabled={updateStatus.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Ban className="w-4 h-4 mr-2" />
                Void
              </Button>
            </>
          )}
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Alert for overdue */}
      {invoice.invoice.status === 'overdue' && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <Calendar className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Invoice overdue</p>
                <p className="text-sm text-muted-foreground">
                  This invoice is {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendor Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Vendor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Vendor #{invoice.invoice.vendor_id}</p>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Issue date:</span>
              <span className="font-medium">{format(new Date(invoice.invoice.issue_date), 'MMM dd, yyyy')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due date:</span>
              <span className="font-medium">{format(new Date(invoice.invoice.due_date), 'MMM dd, yyyy')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lineItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    ₨{item.unit_price.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₨{item.amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">
                ₨{invoice.invoice.subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">
                ₨{invoice.invoice.tax_amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold">
                ₨{invoice.invoice.total_amount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {invoice.invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-medium text-green-600">
                    ₨{invoice.invoice.amount_paid.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Amount due</span>
                  <span className="text-xl font-bold text-orange-600">
                    ₨{invoice.invoice.amount_due.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Payment amount</Label>
              <Input
                id="payment_amount"
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.invoice.amount_due}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum: ₨{invoice.invoice.amount_due.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPayment.isPending || !paymentAmount || parseFloat(paymentAmount) <= 0}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
