import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/types/database';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useReorderKanban() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, newStatus, newOrder }: { taskId: string; newStatus: string; newOrder: number }) => {
      assertSupabase(supabase);

      const { data, error } = await supabase.rpc('reorder_kanban', {
        p_task_id: taskId,
        p_new_status: newStatus,
        p_new_order: newOrder
      });

      if (error) {
        // Fallback if RPC doesn't exist
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ status: newStatus, kanban_order: newOrder })
          .eq('id', taskId);
        if (updateError) throw mapSupabaseError(updateError);
        return;
      }
      return data;
    },
    onMutate: async ({ taskId, newStatus, newOrder }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousData = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) =>
          t.id === taskId ? { ...t, status: newStatus as Task['status'], kanban_order: newOrder } : t
        ) ?? old
      );
      return { previousData };
    },
    onError: (error, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      notifyError(error, "Error al reordenar tarea");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
