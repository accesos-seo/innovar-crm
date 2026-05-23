import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useUnreadCount() {
  const user = useAuthStore(state => state.user);

  return useQuery({
    queryKey: ['notifications', 'unreadCount', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30s — el badge no necesita ser perfecto en tiempo real
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      assertSupabase(supabase);

      const query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      const response = (await query) as any;
      const { count, error } = response;

      if (error) throw mapSupabaseError(error);
      return count || 0;
    },
  });
}
