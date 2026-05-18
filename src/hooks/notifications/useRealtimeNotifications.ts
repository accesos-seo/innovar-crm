import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/PremiumToast';

export function useRealtimeNotifications() {
  const user = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase || !user?.id) return;

    const channel = supabase
      .channel('notifications-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Toast for the new notification
          const newNotif = payload.new;
          notify.info("Nueva notificación", newNotif.title);

          // Invalidate to refresh the lists/counts
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
