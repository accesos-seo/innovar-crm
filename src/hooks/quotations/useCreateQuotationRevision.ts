import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import {
  createQuotationRevisionSchema,
  type CreateQuotationRevisionInput,
} from '@/schemas/quotation';

export interface CreateQuotationRevisionResult {
  ok: boolean;
  new_quotation_id: string;
  new_version_number: number;
  short_code: string;
}

/**
 * Admin crea una versión nueva de una cotización. V1 queda `superseded`
 * con `is_locked=true` y short_code invalidado; V2 queda en `draft`.
 *
 * El consumidor decide si navegar a la nueva cotización (no lo hace el hook
 * porque no todos los callers viven dentro de un Router).
 */
export function useCreateQuotationRevision() {
  const qc = useQueryClient();
  return useMutation<CreateQuotationRevisionResult, Error, CreateQuotationRevisionInput>({
    mutationFn: async (input) => {
      assertSupabase(supabase);
      const payload = createQuotationRevisionSchema.parse(input);
      const { data, error } = await supabase.rpc('create_quotation_revision', {
        p_quotation_id: payload.quotation_id,
      });
      if (error) throw mapSupabaseError(error);
      return data as CreateQuotationRevisionResult;
    },
    onSuccess: (_, { quotation_id }) => {
      qc.invalidateQueries({ queryKey: ['quotation', quotation_id] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Versión nueva creada', {
        description: 'V1 quedó reemplazada. Editá V2 antes de enviar.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos crear la versión nueva', { description: err.message });
    },
  });
}
