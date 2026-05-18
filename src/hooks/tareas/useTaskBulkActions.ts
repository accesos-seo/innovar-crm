import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useTaskBulkActions() {
  const queryClient = useQueryClient();

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ taskIds, newStatus }: { taskIds: string[]; newStatus: string }) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .in('id', taskIds);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => notifyError(error, "Error al actualizar tareas")
  });

  const bulkDelete = useMutation({
    mutationFn: async (taskIds: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIds);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => notifyError(error, "Error al eliminar tareas")
  });

  return { bulkUpdateStatus, bulkDelete };
}
