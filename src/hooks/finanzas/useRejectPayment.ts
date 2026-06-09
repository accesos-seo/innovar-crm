import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import { rejectPaymentSchema, type RejectPaymentInput } from '@/schemas/payment';

export interface RejectPaymentResult {
  ok: boolean;
  payment_id: string;
  quotation_status: string;
}

/**
 * Admin rechaza un comprobante de pago.
 * La cotización vuelve a `client_approved`. Encola WA al cliente con motivo.
 *
 * Invalidates: payments, quotations, notifications.
 */
export function useRejectPayment() {
  const qc = useQueryClient();
  return useMutation<RejectPaymentResult, Error, RejectPaymentInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = rejectPaymentSchema.parse(input);
      const { data, error } = await supabase.rpc('reject_payment', {
        p_payment_id: payload.payment_id,
        p_reason: payload.reason,
      });
      if (error) throw mapSupabaseError(error);
      return data as RejectPaymentResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Pago rechazado', {
        description: 'Le avisamos al cliente con tu motivo.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos rechazar el pago', { description: err.message });
    },
  });
}
