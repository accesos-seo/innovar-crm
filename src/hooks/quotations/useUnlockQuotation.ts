import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface UnlockQuotationInput {
  quotationId: string;
  changeReason: string;
}

/**
 * Admin desbloquea una cotización enviada para poder editarla.
 * El RPC valida rol (solo admin/super_admin), exige `change_reason`
 * y registra el evento en `audit_logs`.
 */
export function useUnlockQuotation() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, UnlockQuotationInput>({
    mutationFn: async ({ quotationId, changeReason }) => {
      assertSupabase(supabase);
      if (!changeReason?.trim() || changeReason.trim().length < 10) {
        throw new Error('Necesitamos al menos 10 caracteres explicando por qué desbloqueás.');
      }
      const { data, error } = await supabase.rpc('unlock_quotation', {
        p_quotation_id: quotationId,
        p_change_reason: changeReason.trim(),
      });
      if (error) throw mapSupabaseError(error);
      return data as { ok: boolean };
    },
    onSuccess: (_, { quotationId }) => {
      qc.invalidateQueries({ queryKey: ['quotation', quotationId] });
      qc.invalidateQueries({ queryKey: ['quotations'] });
      toast.warning('Cotización desbloqueada', {
        description: 'Quedó registrado en el log de auditoría.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos desbloquear', { description: err.message });
    },
  });
}
