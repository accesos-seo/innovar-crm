import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import { verifyPaymentSchema, type VerifyPaymentInput } from '@/schemas/payment';

export interface VerifyPaymentResult {
  ok: boolean;
  payment_id: string;
  project_id: string | null;
  quotation_status: string;
}

/**
 * Admin verifica un comprobante de pago.
 * Trigger `trg_payment_convert_to_project` crea el proyecto si es el primer
 * pago aceptado. Encola WA al diseñador asignado y notif in-app.
 *
 * Invalidates: payments, projects, quotations, opportunities, notifications.
 */
export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation<VerifyPaymentResult, Error, VerifyPaymentInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = verifyPaymentSchema.parse(input);
      const { data, error } = await supabase.rpc('verify_payment', {
        p_payment_id: payload.payment_id,
        p_designer_id: payload.designer_id,
        p_payment_type: payload.payment_type ?? null,
      });
      if (error) throw mapSupabaseError(error);
      return data as VerifyPaymentResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Pago verificado', {
        description: 'Se creó el proyecto y avisamos al diseñador.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos verificar el pago', { description: err.message });
    },
  });
}
