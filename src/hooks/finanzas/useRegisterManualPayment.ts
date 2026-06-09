import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import {
  registerManualPaymentSchema,
  type RegisterManualPaymentInput,
} from '@/schemas/payment';

export interface RegisterManualPaymentResult {
  ok: boolean;
  payment_id: string;
  project_id: string | null;
  quotation_status: string;
}

/**
 * Admin registra un pago en nombre del cliente (efectivo, cheque, transferencia
 * verificada por canal externo, etc.).
 * Crea payment con `verification_status='verified'` y `payment_source='admin_manual'`.
 * Trigger convert dispara en INSERT si corresponde.
 *
 * Invalidates: payments, projects, quotations, opportunities, notifications.
 */
export function useRegisterManualPayment() {
  const qc = useQueryClient();
  return useMutation<RegisterManualPaymentResult, Error, RegisterManualPaymentInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = registerManualPaymentSchema.parse(input);
      const { data, error } = await supabase.rpc('register_manual_payment', {
        p_quotation_id: payload.quotation_id,
        p_amount: payload.amount,
        p_method: payload.payment_method,
        p_payment_type: payload.payment_type,
        p_designer_id: payload.designer_id ?? null,
        p_notes: payload.notes ?? null,
      });
      if (error) throw mapSupabaseError(error);
      return data as RegisterManualPaymentResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Pago registrado', {
        description: 'Si correspondía, se creó el proyecto.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos registrar el pago', { description: err.message });
    },
  });
}
