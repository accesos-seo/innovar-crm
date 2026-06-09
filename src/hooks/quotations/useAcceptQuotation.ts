import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface AcceptQuotationInput {
  token: string;
  note?: string;
}

export interface AcceptQuotationResult {
  ok: boolean;
  quotation_id: string;
  next_step: 'upload_payment_proof';
}

/**
 * Cliente acepta la cotización entera. Pasa a `client_approved` y dispara
 * los triggers que encolan el WhatsApp con datos bancarios + notifican al admin.
 */
export function useAcceptQuotation() {
  const qc = useQueryClient();
  return useMutation<AcceptQuotationResult, Error, AcceptQuotationInput>({
    mutationFn: async ({ token, note }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('accept_public_quotation', {
        p_token: token,
        p_note: note?.trim() || null,
      });
      if (error) throw mapSupabaseError(error);
      return data as AcceptQuotationResult;
    },
    onSuccess: (_, { token }) => {
      qc.invalidateQueries({ queryKey: ['public-quotation', token] });
      toast.success('¡Listo! Te llegó un WhatsApp con los datos de pago.');
    },
    onError: (err) => {
      toast.error('No pudimos registrar tu aceptación', { description: err.message });
    },
  });
}
