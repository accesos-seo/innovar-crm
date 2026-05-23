
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { NotificationQueueRow, MetaWhatsappStatusEvent, ProcessWhatsappNotificationsResponse } from '@/types/whatsapp';
import { notify } from '@/components/ui/PremiumToast';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useWhatsApp(filters?: { status?: string; delivery_status?: string; searchTerm?: string }) {
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['whatsapp_messages', filters],
    queryFn: async (): Promise<{ data: NotificationQueueRow[]; count: number }> => {
      assertSupabase(supabase);

      let query = supabase
        .from('notification_queue')
        .select('*', { count: 'exact' });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.delivery_status) {
        query = query.eq('delivery_status', filters.delivery_status);
      }

      if (filters?.searchTerm) {
        query = query.or(`recipient_phone.ilike.%${filters.searchTerm}%,recipient_name.ilike.%${filters.searchTerm}%,provider_message_id.ilike.%${filters.searchTerm}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false });

      if (error) throw mapSupabaseError(error);

      return { data: (data || []) as NotificationQueueRow[], count: count || 0 };
    }
  });

  const processMutation = useMutation({
    mutationFn: async (params: { dry_run: boolean; limit: number }) => {
      assertSupabase(supabase);

      const { data, error } = await (supabase.functions as any).invoke(
        'process-whatsapp-notifications',
        {
          method: 'POST',
          body: params
        }
      );

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok) {
        notify.success('Procesamiento completado', `Se procesaron ${data.processed} mensajes.`);
      } else {
        notify.warning('Procesamiento parcial', 'Hubo algunos inconvenientes en el procesamiento.');
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp_messages'] });
    },
    onError: (error) => notifyError(error, "Error de procesamiento")
  });

  return {
    messages: messagesQuery.data?.data || [],
    totalCount: messagesQuery.data?.count || 0,
    isLoading: messagesQuery.isLoading,
    isProcessing: processMutation.isPending,
    processMessages: processMutation.mutateAsync,
    refresh: () => messagesQuery.refetch()
  };
}

export function useWhatsAppEvents(providerMessageId: string | null) {
  return useQuery({
    queryKey: ['whatsapp_events', providerMessageId],
    queryFn: async (): Promise<MetaWhatsappStatusEvent[]> => {
      if (!providerMessageId) return [];
      assertSupabase(supabase);

      const { data, error } = await supabase
        .from('meta_whatsapp_status_events')
        .select('*')
        .eq('provider_message_id', providerMessageId)
        .order('status_timestamp', { ascending: true });

      if (error) throw mapSupabaseError(error);

      return (data || []) as MetaWhatsappStatusEvent[];
    },
    enabled: !!providerMessageId
  });
}
