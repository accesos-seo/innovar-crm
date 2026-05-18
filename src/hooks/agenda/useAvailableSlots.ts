import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface AvailableSlot {
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  staff_id: string;
}

export function useAvailableSlots(staffId: string | undefined, dateFrom: Date, dateTo: Date) {
  return useQuery({
    queryKey: ['availableSlots', staffId, dateFrom.toISOString(), dateTo.toISOString()],
    retry: 0,
    queryFn: async (): Promise<AvailableSlot[]> => {
      if (!staffId) return [];
      assertSupabase(supabase);

      const { data, error } = await supabase.rpc("get_available_slots", {
        p_staff_id: staffId,
        p_date_from: dateFrom.toISOString().split('T')[0],
        p_date_to: dateTo.toISOString().split('T')[0]
      });

      if (error) throw mapSupabaseError(error);

      return (data || []) as AvailableSlot[];
    },
    enabled: !!staffId
  });
}
