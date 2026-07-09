import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface CreateInvoiceInput {
  vendor_id: string;
  issue_date: string;
  due_date: string;
  notes?: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

/**
 * Fetch all invoices
 */
export function useInvoices(filters?: { vendor_id?: string; status?: string }) {
  return useQuery({
    queryKey: ["invoices", filters],
    queryFn: async () => {
      let query = supabase
        .from("finance_invoices")
        .select("*, vendors(name)")
        .order("created_at", { ascending: false });

      if (filters?.vendor_id) {
        query = query.eq("vendor_id", filters.vendor_id);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Invoice[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch a single invoice with line items
 */
export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ["invoices", invoiceId],
    queryFn: async () => {
      const { data: invoice, error: invoiceError } = await supabase
        .from("finance_invoices")
        .select("*, vendors(name)")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from("finance_invoice_line_items")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (lineItemsError) throw lineItemsError;

      return {
        invoice: invoice as Invoice,
        lineItems: lineItems as InvoiceLineItem[],
      };
    },
    enabled: !!invoiceId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new invoice
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      // Calculate totals
      const subtotal = input.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const tax_amount = subtotal * 0.17; // 17% tax
      const total_amount = subtotal + tax_amount;

      // Generate invoice number
      const invoice_number = `INV-${Date.now()}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("finance_invoices")
        .insert({
          invoice_number,
          vendor_id: input.vendor_id,
          issue_date: input.issue_date,
          due_date: input.due_date,
          subtotal,
          tax_amount,
          total_amount,
          amount_due: total_amount,
          notes: input.notes,
          status: "draft",
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItems = input.line_items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
      }));

      const { error: lineItemsError } = await supabase
        .from("finance_invoice_line_items")
        .insert(lineItems);

      if (lineItemsError) {
        // Rollback: delete invoice
        await supabase.from("finance_invoices").delete().eq("id", invoice.id);
        throw lineItemsError;
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

/**
 * Record a payment on an invoice
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      amount,
      paymentDate,
      paymentMethod,
    }: {
      invoiceId: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string;
    }) => {
      // Get current invoice
      const { data: invoice, error: fetchError } = await supabase
        .from("finance_invoices")
        .select("amount_paid, amount_due, total_amount")
        .eq("id", invoiceId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new amounts
      const newAmountPaid = invoice.amount_paid + amount;
      const newAmountDue = invoice.total_amount - newAmountPaid;

      // Determine new status
      let newStatus: Invoice["status"] = "sent";
      if (newAmountDue <= 0) {
        newStatus = "paid";
      }

      // Update invoice
      const { data, error } = await supabase
        .from("finance_invoices")
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", data.id] });
      toast.success("Payment recorded successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

/**
 * Update invoice status
 */
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: Invoice["status"] }) => {
      const { data, error } = await supabase
        .from("finance_invoices")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", data.id] });
      toast.success("Invoice status updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });
}

/**
 * Delete an invoice
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.from("finance_invoices").delete().eq("id", invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
}

/**
 * Get overdue invoices
 */
export function useOverdueInvoices() {
  return useQuery({
    queryKey: ["invoices", "overdue"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("finance_invoices")
        .select("*, vendors(name)")
        .eq("status", "sent")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
