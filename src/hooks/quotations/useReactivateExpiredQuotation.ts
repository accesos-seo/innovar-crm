import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import {
  reactivateExpiredQuotationSchema,
  type ReactivateExpiredQuotationInput,
} from '@/schemas/quotation';

export interface ReactivateExpiredQuotationResult {
  ok: boolean;
  quotation_id: string;
  short_code: string;
  valid_until: string;
}

/**
 * Admin reactiva una cotización expirada o cancelada → vuelve a `client_approved`
 * con un nuevo short_code y `valid_until = now() + 30d`.
 */
export function useReactivateExpiredQuotation() {
  const qc = useQueryClient();
  return useMutation<ReactivateExpiredQuotationResult, Error, ReactivateExpiredQuotationInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = reactivateExpiredQuotationSchema.parse(input);
      const { data, error } = await supabase.rpc('reactivate_expired_quotation', {
        p_quotation_id: payload.quotation_id,
      });
      if (error) throw mapSupabaseError(error);
      return data as ReactivateExpiredQuotationResult;
    },
    onSuccess: (_, { quotation_id }) => {
      qc.invalidateQueries({ queryKey: ['quotation', quotation_id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Cotización reactivada', {
        description: 'Generamos un nuevo enlace público.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos reactivar', { description: err.message });
    },
  });
}
