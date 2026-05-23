import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Notification } from '@/types/database';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useNotifications(filterType?: string) {
  const user = useAuthStore(state => state.user);

  return useInfiniteQuery({
    queryKey: ['notifications', 'list', user?.id, filterType],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user?.id) return { data: [], nextCursor: null };
      assertSupabase(supabase);

      const PAGE_SIZE = 20;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('is_read', { ascending: true })
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filterType && filterType !== 'all') {
        if (filterType === 'booking') {
          query = query.in('notification_type', ['booking_new', 'booking_reminder', 'booking_completed', 'booking_cancelled']);
        } else if (filterType === 'project') {
          query = query.in('notification_type', ['project_status']);
        } else if (filterType === 'system') {
          query = query.in('notification_type', ['system']);
        }
      }

      const response = (await query) as any;
      const { data, error } = response;

      if (error) throw mapSupabaseError(error);

      return {
        data: data as Notification[],
        nextCursor: data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!user?.id,
  });
}
