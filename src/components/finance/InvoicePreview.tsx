import React from 'react';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface PreviewProps {
  vendorName?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  lineItems?: Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  logoUrl?: string | null;
  template?: 'Minimal' | 'Corporate' | 'Detailed';
}

export const InvoicePreview: React.FC<PreviewProps> = ({
  vendorName,
  invoiceNumber,
  issueDate,
  dueDate,
  lineItems = [],
  subtotal = 0,
  tax = 0,
  total = 0,
  logoUrl,
  template = 'Minimal',
}) => {
  const handlePrint = () => window.print();

  const urlToDataUrl = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert image'));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      return '';
    }
  };

  const handleDownloadPdf = async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    let y = 40;

    // Logo
    if (logoUrl) {
      const dataUrl = await urlToDataUrl(logoUrl);
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 40, 20, 80, 40);
        } catch (e) {
          // ignore addImage failures
        }
      }
    }

    // Header
    doc.setFontSize(14);
    doc.text('Invoice', 130, 40);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceNumber || '—'}`, 40, 90);
    doc.text(`Issue date: ${issueDate || '—'}`, 40, 105);
    doc.text(`Due date: ${dueDate || '—'}`, 40, 120);
    doc.text(`To: ${vendorName || '—'}`, 40, 135);

    // Table
    const body = lineItems.map((li) => [li.description, String(li.quantity), String(li.unit_price), String(li.amount)]);

    // @ts-ignore
    doc.autoTable({
      head: [['Description', 'Qty', 'Unit', 'Amount']],
      body,
      startY: 160,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [240, 240, 240] },
    });

    // Totals
    const finalY = (doc as any).lastAutoTable?.finalY || 300;
    doc.setFontSize(11);
    doc.text(`Subtotal: ₨${subtotal.toLocaleString('en-PK', {minimumFractionDigits:2})}`, 400, finalY + 30);
    doc.text(`Tax: ₨${tax.toLocaleString('en-PK', {minimumFractionDigits:2})}`, 400, finalY + 45);
    doc.setFontSize(13);
    doc.text(`Total: ₨${total.toLocaleString('en-PK', {minimumFractionDigits:2})}`, 400, finalY + 70);

    const fileName = `invoice-${invoiceNumber || Date.now()}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="p-4 border rounded-md bg-white text-black">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold">Invoice Preview</h3>
          <div className="text-sm text-muted-foreground">Template: {template}</div>
        </div>
        <div className="text-right">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="logo" className="h-10 object-contain" />
          ) : (
            <div className="h-10 w-28 bg-muted rounded-md flex items-center justify-center text-xs">Logo</div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-sm">To: <strong>{vendorName || 'Vendor name'}</strong></div>
        <div className="text-sm">Invoice #: <strong>{invoiceNumber || '—'}</strong></div>
        <div className="text-sm">Issue date: {issueDate || '—'}</div>
        <div className="text-sm">Due date: {dueDate || '—'}</div>
      </div>

      <div className="mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1">Description</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Unit</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.quantity}</td>
                <td className="py-2 text-right">₨{li.unit_price.toLocaleString('en-PK', {minimumFractionDigits:2})}</td>
                <td className="py-2 text-right">₨{li.amount.toLocaleString('en-PK', {minimumFractionDigits:2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end space-y-1 flex-col">
        <div className="flex justify-between w-56"><span className="text-sm text-muted-foreground">Subtotal</span><span>₨{subtotal.toLocaleString('en-PK', {minimumFractionDigits:2})}</span></div>
        <div className="flex justify-between w-56"><span className="text-sm text-muted-foreground">Tax</span><span>₨{tax.toLocaleString('en-PK', {minimumFractionDigits:2})}</span></div>
        <div className="flex justify-between w-56 font-semibold text-lg"><span>Total</span><span>₨{total.toLocaleString('en-PK', {minimumFractionDigits:2})}</span></div>
      </div>

      <div className="mt-4 flex gap-2 justify-end">
        <Button variant="outline" onClick={handleDownloadPdf}>Download PDF</Button>
        <Button variant="outline" onClick={handlePrint}>Print / PDF</Button>
      </div>
    </div>
  );
};

export default InvoicePreview;
