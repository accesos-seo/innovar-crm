import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export type RejectionSubtype = 'adjustments_requested' | 'declined';

export interface RejectQuotationInput {
  token: string;
  subtype: RejectionSubtype;
  /** Obligatorio si subtype='adjustments_requested'. Opcional si 'declined'. */
  reason?: string;
}

export interface RejectQuotationResult {
  ok: boolean;
  quotation_id: string;
  subtype: RejectionSubtype;
}

export function useRejectQuotation() {
  const qc = useQueryClient();
  return useMutation<RejectQuotationResult, Error, RejectQuotationInput>({
    mutationFn: async ({ token, subtype, reason }) => {
      assertSupabase(supabase);
      if (subtype === 'adjustments_requested' && !reason?.trim()) {
        throw new Error('Para pedir ajustes necesitamos que nos cuentes qué te gustaría cambiar.');
      }
      const { data, error } = await supabase.rpc('reject_public_quotation', {
        p_token: token,
        p_subtype: subtype,
        p_reason: reason?.trim() || null,
      });
      if (error) throw mapSupabaseError(error);
      return data as RejectQuotationResult;
    },
    onSuccess: (data, { token }) => {
      qc.invalidateQueries({ queryKey: ['public-quotation', token] });
      if (data.subtype === 'adjustments_requested') {
        toast.success('Le avisamos al asesor', {
          description: 'Te contactará pronto con una propuesta actualizada.',
        });
      } else {
        toast.success('Gracias por avisarnos', {
          description: 'Quedó registrado que rechazaste la propuesta.',
        });
      }
    },
    onError: (err) => {
      toast.error('No pudimos registrar tu respuesta', { description: err.message });
    },
  });
}
