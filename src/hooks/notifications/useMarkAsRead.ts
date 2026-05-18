import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw mapSupabaseError(error);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousList = queryClient.getQueriesData({ queryKey: ['notifications', 'list'] });
      const previousCount = queryClient.getQueriesData({ queryKey: ['notifications', 'unreadCount'] });

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: page.data.map((notif: any) => 
              notif.id === id ? { ...notif, is_read: true } : notif
            )
          }))
        };
      });

      queryClient.setQueriesData({ queryKey: ['notifications', 'unreadCount'] }, (oldCount: any) => {
        if (oldCount === undefined) return oldCount;
        return Math.max(0, (oldCount as number) - 1);
      });

      return { previousList, previousCount };
    },
    onError: (err, _newTodo, context) => {
      // Rollback optimistic updates
      if (context?.previousList) {
        context.previousList.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCount) {
        context.previousCount.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      notifyError(err, 'No se pudo marcar como leída');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
}
