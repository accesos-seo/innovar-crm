import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useUnreadCount() {
  const user = useAuthStore(state => state.user);

  return useQuery({
    queryKey: ['notifications', 'unreadCount', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      assertSupabase(supabase);

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw mapSupabaseError(error);
      return count || 0;
    },
  });
}
