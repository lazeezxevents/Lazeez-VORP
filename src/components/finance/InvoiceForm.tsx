import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCreateInvoice } from '@/components/hooks/useInvoices';
import usePostInvoiceToLedger from '@/components/hooks/usePostInvoiceToLedger';
import InvoicePreview from './InvoicePreview';
import LogoUploader from './LogoUploader';
import { useAuth } from '@/contexts/AuthContext';
import { createInvoiceSchema, type CreateInvoiceInput } from '@/components/finance/types';

interface InvoiceFormProps {
  vendors: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InvoiceForm({ vendors, onSuccess, onCancel }: InvoiceFormProps) {
  const createInvoice = useCreateInvoice();
  const postInvoice = usePostInvoiceToLedger();
  const [postImmediately, setPostImmediately] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [template, setTemplate] = useState<'Minimal'|'Corporate'|'Detailed'>('Minimal');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const { isAdmin } = useAuth();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      vendor_id: '',
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      line_items: [
        {
          description: '',
          quantity: 1,
          unit_price: 0,
          tax_rate: 0,
          amount: 0,
        },
      ],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const lineItems = watch('line_items');

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = lineItems.reduce(
    (sum, item) => sum + ((item.amount || 0) * (item.tax_rate || 0) / 100),
    0
  );
  const total = subtotal + taxAmount;

  const onSubmit = async (data: CreateInvoiceInput) => {
    try {
      const created = await createInvoice.mutateAsync(data);
      if (postImmediately && created?.id) {
        try {
          await postInvoice.mutateAsync(created.id);
        } catch (err) {
          // Post failure handled by hook toasts; continue
          console.error('Failed to post immediately:', err);
        }
      }
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleQuantityOrPriceChange = (index: number, field: 'quantity' | 'unit_price', value: string) => {
    const numValue = parseFloat(value) || 0;
    const currentItem = lineItems[index];
    const quantity = field === 'quantity' ? numValue : currentItem.quantity;
    const unitPrice = field === 'unit_price' ? numValue : currentItem.unit_price;
    const amount = quantity * unitPrice;

    // Update the amount field
    const event = new Event('input', { bubbles: true });
    const amountInput = document.querySelector(`input[name="line_items.${index}.amount"]`) as HTMLInputElement;
    if (amountInput) {
      amountInput.value = amount.toString();
      amountInput.dispatchEvent(event);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor Selection */}
            <div className="space-y-2">
              <Label htmlFor="vendor_id">Vendor</Label>
              <Select
                onValueChange={(value) => {
                  const event = { target: { name: 'vendor_id', value } };
                  register('vendor_id').onChange(event);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.vendor_id && (
                <p className="text-sm text-destructive">{errors.vendor_id.message}</p>
              )}
            </div>

            {/* Issue Date */}
            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue date</Label>
              <Input
                id="issue_date"
                type="date"
                {...register('issue_date')}
              />
              {errors.issue_date && (
                <p className="text-sm text-destructive">{errors.issue_date.message}</p>
              )}
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input
                id="due_date"
                type="date"
                {...register('due_date')}
              />
              {errors.due_date && (
                <p className="text-sm text-destructive">{errors.due_date.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Line items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                description: '',
                quantity: 1,
                unit_price: 0,
                tax_rate: 0,
                amount: 0,
              })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Add item
          </Button>
        </CardHeader>
        <CardContent>
          <motion.div
            className="space-y-4"
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
            {fields.map((field, index) => (
              <motion.div
                key={field.id}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="grid grid-cols-12 gap-3 items-start p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {/* Description */}
                <div className="col-span-12 md:col-span-4 space-y-2">
                  <Label htmlFor={`line_items.${index}.description`}>Description</Label>
                  <Input
                    id={`line_items.${index}.description`}
                    placeholder="Item description"
                    {...register(`line_items.${index}.description`)}
                  />
                  {errors.line_items?.[index]?.description && (
                    <p className="text-sm text-destructive">
                      {errors.line_items[index]?.description?.message}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="col-span-6 md:col-span-2 space-y-2">
                  <Label htmlFor={`line_items.${index}.quantity`}>Quantity</Label>
                  <Input
                    id={`line_items.${index}.quantity`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1"
                    {...register(`line_items.${index}.quantity`, {
                      valueAsNumber: true,
                      onChange: (e) => handleQuantityOrPriceChange(index, 'quantity', e.target.value),
                    })}
                  />
                  {errors.line_items?.[index]?.quantity && (
                    <p className="text-sm text-destructive">
                      {errors.line_items[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                {/* Unit Price */}
                <div className="col-span-6 md:col-span-2 space-y-2">
                  <Label htmlFor={`line_items.${index}.unit_price`}>Unit price</Label>
                  <Input
                    id={`line_items.${index}.unit_price`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register(`line_items.${index}.unit_price`, {
                      valueAsNumber: true,
                      onChange: (e) => handleQuantityOrPriceChange(index, 'unit_price', e.target.value),
                    })}
                  />
                  {errors.line_items?.[index]?.unit_price && (
                    <p className="text-sm text-destructive">
                      {errors.line_items[index]?.unit_price?.message}
                    </p>
                  )}
                </div>

                {/* Tax Rate */}
                <div className="col-span-6 md:col-span-2 space-y-2">
                  <Label htmlFor={`line_items.${index}.tax_rate`}>Tax %</Label>
                  <Input
                    id={`line_items.${index}.tax_rate`}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    {...register(`line_items.${index}.tax_rate`, {
                      valueAsNumber: true,
                    })}
                  />
                  {errors.line_items?.[index]?.tax_rate && (
                    <p className="text-sm text-destructive">
                      {errors.line_items[index]?.tax_rate?.message}
                    </p>
                  )}
                </div>

                {/* Amount (calculated) */}
                <div className="col-span-6 md:col-span-2 space-y-2">
                  <Label htmlFor={`line_items.${index}.amount`}>Amount</Label>
                  <Input
                    id={`line_items.${index}.amount`}
                    type="number"
                    step="0.01"
                    min="0"
                    readOnly
                    className="bg-muted"
                    {...register(`line_items.${index}.amount`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                {/* Remove Button */}
                {fields.length > 1 && (
                  <div className="col-span-12 md:col-span-1 flex items-end justify-center md:justify-end pb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>

          {errors.line_items && typeof errors.line_items === 'object' && 'message' in errors.line_items && (
            <p className="text-sm text-destructive mt-2">{errors.line_items.message as string}</p>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">₨{subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">₨{taxAmount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold">₨{total.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            placeholder="Add any additional notes or payment terms..."
            rows={4}
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-sm text-destructive mt-2">{errors.notes.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between gap-3 items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm">Template</label>
            <select value={template} onChange={(e) => setTemplate(e.target.value as any)} className="ml-2 p-1 rounded border">
              <option value="Minimal">Minimal</option>
              <option value="Corporate">Corporate</option>
              <option value="Detailed">Detailed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Logo</label>
            <LogoUploader onUpload={(u) => setLogoUrl(u)} initialUrl={logoUrl} />
          </div>

          <Button variant="outline" onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'Hide preview' : 'Live preview'}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={postImmediately} onChange={(e) => setPostImmediately(e.target.checked)} />
              <span>Post to ledger immediately</span>
            </label>
          )}

          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={createInvoice.isPending}
            className="min-w-[120px]"
          >
            {createInvoice.isPending ? (
              <>
                <Calculator className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Create invoice
              </>
            )}
          </Button>
        </div>
      </div>

      {showPreview && (
        <div className="mt-4">
          <InvoicePreview
            vendorName={vendors?.find(v => v.id === watch('vendor_id'))?.name}
            invoiceNumber={undefined}
            issueDate={watch('issue_date')}
            dueDate={watch('due_date')}
            lineItems={watch('line_items') || []}
            subtotal={subtotal}
            tax={taxAmount}
            total={total}
            logoUrl={logoUrl || undefined}
            template={template}
          />
        </div>
      )}
    </form>
  );
}
