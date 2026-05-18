import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  return useMutation({
    mutationFn: async () => {
      assertSupabase(supabase);
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw mapSupabaseError(error);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      const previousList = queryClient.getQueriesData({ queryKey: ['notifications', 'list'] });
      const previousCount = queryClient.getQueriesData({ queryKey: ['notifications', 'unreadCount'] });

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            data: page.data.map((notif: any) => ({ ...notif, is_read: true }))
          }))
        };
      });

      queryClient.setQueriesData({ queryKey: ['notifications', 'unreadCount'] }, () => 0);

      return { previousList, previousCount };
    },
    onError: (err, _variables, context) => {
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
      notifyError(err, 'No se pudo marcar todo como leído');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });
}
