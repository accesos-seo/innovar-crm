import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import {
  cancelQuotationAcceptanceSchema,
  type CancelQuotationAcceptanceInput,
} from '@/schemas/quotation';

export interface CancelQuotationAcceptanceResult {
  ok: boolean;
  quotation_id: string;
}

/**
 * Admin cancela una cotización ya aceptada por el cliente (estados
 * client_approved / pending_payment_verification). La opp pasa a `lost`,
 * el short_code se invalida.
 */
export function useCancelQuotationAcceptance() {
  const qc = useQueryClient();
  return useMutation<CancelQuotationAcceptanceResult, Error, CancelQuotationAcceptanceInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = cancelQuotationAcceptanceSchema.parse(input);
      const { data, error } = await supabase.rpc('cancel_quotation_acceptance', {
        p_quotation_id: payload.quotation_id,
        p_reason: payload.reason,
      });
      if (error) throw mapSupabaseError(error);
      return data as CancelQuotationAcceptanceResult;
    },
    onSuccess: (_, { quotation_id }) => {
      qc.invalidateQueries({ queryKey: ['quotation', quotation_id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Aceptación cancelada', {
        description: 'La cotización quedó en estado cancelada.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos cancelar la aceptación', { description: err.message });
    },
  });
}
