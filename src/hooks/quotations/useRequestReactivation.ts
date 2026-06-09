import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

/**
 * Cliente con cotización vencida pide reactivación. Solo encola notif al admin.
 * No modifica el estado de la cotización (Alvaro decide manualmente si extiende
 * `valid_until` o crea V2).
 */
export function useRequestReactivation() {
  return useMutation<{ ok: boolean }, Error, { token: string }>({
    mutationFn: async ({ token }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc('request_quotation_reactivation', {
        p_token: token,
      });
      if (error) throw mapSupabaseError(error);
      return data as { ok: boolean };
    },
    onSuccess: () => {
      toast.success('Pedido enviado', {
        description: 'Tu asesor te contactará para preparar una nueva propuesta.',
      });
    },
    onError: (err) => {
      toast.error('No pudimos enviar el pedido', { description: err.message });
    },
  });
}
