import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { withTimeout } from '@/lib/timeout';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

// Kill-switch temporal: si VITE_DISABLE_NOTIFICATIONS=true, no se hacen queries
// a la tabla `notifications`. Diagnóstico en curso — esa tabla parece estar
// taponando el cliente Supabase cuando se dispara desde el TopBar en cada
// navegación, causando que queries posteriores se queden colgadas 10s+.
const NOTIFICATIONS_DISABLED = import.meta.env.VITE_DISABLE_NOTIFICATIONS === 'true';

export function useUnreadCount() {
  const user = useAuthStore(state => state.user);

  return useQuery({
    queryKey: ['notifications', 'unreadCount', user?.id],
    enabled: !!user?.id && !NOTIFICATIONS_DISABLED,
    staleTime: 1000 * 30, // 30s — el badge no necesita ser perfecto en tiempo real
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      assertSupabase(supabase);

      const query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      const response = (await withTimeout(query as any)) as any;
      const { count, error } = response;

      if (error) throw mapSupabaseError(error);
      return count || 0;
    },
  });
}
