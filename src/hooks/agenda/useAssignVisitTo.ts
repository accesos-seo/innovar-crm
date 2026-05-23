import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

interface AssignVisitInput {
  visitId: string;
  newVisitorId: string;
}

/**
 * Reasigna el visitante de una visita técnica vía RPC `assign_visit_to`
 * (SECURITY DEFINER + check de rol admin). El trigger `visit_to_task_mirror`
 * (UPDATE branch) se ocupa de re-asignar `tasks.assigned_to` y reservar el
 * nuevo `availability_slot`. La RPC libera el slot anterior.
 *
 * Errores mapeados:
 *  - 42501 → "No tienes permisos…" (un comercial intentó usar la RPC)
 *  - 22023 → "El registro solicitado…" (visit/profile inválido o inactivo)
 */
export function useAssignVisitTo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ visitId, newVisitorId }: AssignVisitInput) => {
      assertSupabase(supabase);

      const { data, error } = await supabase.rpc('assign_visit_to', {
        p_visit_id: visitId,
        p_new_visitor_id: newVisitorId,
      });

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      toast.success('Visitante reasignado');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['myVisitsToday'] });
    },
    onError: (error) => notifyError(error, 'No se pudo reasignar la visita'),
  });
}
