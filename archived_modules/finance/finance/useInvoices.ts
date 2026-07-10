import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { accountsReceivableService } from "@/components/finance/AccountsReceivableService";
import type {
  Invoice,
  InvoiceWithLineItems,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  RecordPaymentInput,
  InvoiceLineItemInput,
} from "./types";

/**
 * Custom hook for invoice management
 * Task 13.3: Create useInvoices hook
 * Requirements: 7.1, 7.4
 */

// =====================================================
// Query Keys
// =====================================================

const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

// =====================================================
// Fetch Functions
// =====================================================

async function fetchInvoices(filters?: {
  vendor_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InvoiceWithLineItems[]> {
  let query = supabase
    .from("finance_invoices")
    .select(`
      *,
      vendor:vendors(id, name),
      line_items:finance_invoice_line_items(*)
    `)
    .order("issue_date", { ascending: false });

  if (filters?.vendor_id) {
    query = query.eq("vendor_id", filters.vendor_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.start_date) {
    query = query.gte("issue_date", filters.start_date);
  }

  if (filters?.end_date) {
    query = query.lte("issue_date", filters.end_date);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching invoices:", error);
    throw new Error(error.message);
  }

  return data as InvoiceWithLineItems[];
}

async function fetchInvoiceById(id: string): Promise<InvoiceWithLineItems | null> {
  const { data, error } = await supabase
    .from("finance_invoices")
    .select(`
      *,
      vendor:vendors(id, name),
      line_items:finance_invoice_line_items(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching invoice:", error);
    throw new Error(error.message);
  }

  return data as InvoiceWithLineItems;
}

// =====================================================
// Hooks
// =====================================================

/**
 * Hook to fetch all invoices with optional filtering
 */
export function useInvoices(filters?: {
  vendor_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters || {}),
    queryFn: () => fetchInvoices(filters),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single invoice by ID
 */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => fetchInvoiceById(id),
    enabled: !!id,
    staleTime: 30000,
  });
}

/**
 * Hook to create a new invoice
 * Requirement 7.1: Create invoices with line items
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Generate invoice number
      const { data: invoiceNumber, error: numberError } = await supabase
        .rpc("generate_invoice_number");

      if (numberError) {
        throw new Error("Failed to generate invoice number");
      }

      // Calculate totals
      const subtotal = input.line_items.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = input.line_items.reduce(
        (sum, item) => sum + (item.amount * item.tax_rate / 100),
        0
      );
      const totalAmount = subtotal + taxAmount;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("finance_invoices")
        .insert({
          invoice_number: invoiceNumber,
          vendor_id: input.vendor_id,
          issue_date: input.issue_date,
          due_date: input.due_date,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          amount_paid: 0,
          amount_due: totalAmount,
          status: "draft",
          currency: "PKR",
          notes: input.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) {
        throw new Error(invoiceError.message);
      }

      // Create line items
      const lineItems = input.line_items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.amount,
      }));

      const { error: lineItemsError } = await supabase
        .from("finance_invoice_line_items")
        .insert(lineItems);

      if (lineItemsError) {
        // Rollback invoice creation
        await supabase.from("finance_invoices").delete().eq("id", invoice.id);
        throw new Error(lineItemsError.message);
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      toast.success("Invoice created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

/**
 * Hook to update an invoice
 */
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateInvoiceInput }) => {
      const { data: invoice, error } = await supabase
        .from("finance_invoices")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return invoice;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      toast.success("Invoice updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

/**
 * Hook to record a payment on an invoice
 * Requirement 7.4: Record payments and update invoice status
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const payment = {
        invoice_id: input.invoice_id,
        payment_amount: input.payment_amount,
        payment_date: input.payment_date ? new Date(input.payment_date) : new Date(),
        payment_method: input.payment_method || 'manual',
      };

      const result = await accountsReceivableService.recordPayment(payment);
      if (!result.success) throw new Error(result.error || 'Failed to record payment');
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoice_id) });
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

/**
 * Hook to void an invoice
 */
export function useVoidInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("finance_invoices")
        .update({ status: "void" })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      toast.success("Invoice voided successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to void invoice: ${error.message}`);
    },
  });
}

/**
 * Hook to subscribe to invoice status updates
 * Requirement 7.4: Real-time subscription for status updates
 */
export function useInvoiceSubscription(invoiceId?: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["invoice-subscription", invoiceId],
    queryFn: () => {
      if (!invoiceId) return null;

      const channel = supabase
        .channel(`invoice-${invoiceId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "finance_invoices",
            filter: `id=eq.${invoiceId}`,
          },
          (payload) => {
            // Invalidate queries to refetch updated data
            queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
            queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
          }
        )
        .subscribe();

      return channel;
    },
    enabled: !!invoiceId,
    staleTime: Infinity,
  });
}
