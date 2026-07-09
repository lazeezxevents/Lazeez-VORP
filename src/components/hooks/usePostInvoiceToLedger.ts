import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function usePostInvoiceToLedger() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.rpc('journalize_invoice', {
        p_invoice_id: invoiceId,
        p_posted_by: user.id,
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to post invoice');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice posted to ledger');
    },
    onError: (err: any) => {
      toast.error(`Failed to post invoice: ${err?.message || err}`);
    },
  });
}

export default usePostInvoiceToLedger;
