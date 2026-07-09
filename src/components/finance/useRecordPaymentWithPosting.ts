import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsReceivableService } from './AccountsReceivableService';
import { toast } from 'sonner';

/**
 * Wrapper hook that records a payment and ensures it's posted via the service.
 * The underlying service uses the DB RPC to post payments atomically.
 */
export function useRecordPaymentWithPosting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invoice_id: string; payment_amount: number; payment_date?: string; payment_method?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', variables.invoice_id] });
      toast.success('Payment recorded and posted successfully');
    },
    onError: (err: any) => {
      toast.error(`Failed to record payment: ${err?.message || err}`);
    },
  });
}

export default useRecordPaymentWithPosting;
