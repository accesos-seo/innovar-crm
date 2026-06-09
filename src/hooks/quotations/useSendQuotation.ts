import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface SendQuotationResult {
  ok: boolean;
  quotation_id: string;
  public_token: string;
  valid_until: string;
}

/**
 * Admin/comercial pasa una cotización de `draft` a `sent`.
 * El trigger `lock_quotation_on_sent` la bloquea y le pone `valid_until = +30d`.
 * El RPC encola el WhatsApp al cliente con el link público.
 */
export function useSendQuotation() {
  const qc = useQueryClient();
  return useMutation<SendQuotationResult, Error, { quotationId: string }>({
    mutationFn: async ({ quotationId }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('send_quotation_to_client', {
        p_quotation_id: quotationId,
      });
      if (error) throw mapSupabaseError(error);
      return data as SendQuotationResult;
    },
    onSuccess: (_, { quotationId }) => {
      qc.invalidateQueries({ queryKey: ['quotation', quotationId] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Cotización enviada', {
        description: 'Le mandamos el WhatsApp con el link al cliente.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos enviar la cotización', { description: err.message });
    },
  });
}
