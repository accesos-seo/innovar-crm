import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface AvailableSlot {
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  staff_id: string;
}

const SLOT_HOURS = ['08:30', '10:00', '14:00', '15:30'];

function endOf(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + 90, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function useAvailableSlots(staffId: string | undefined, date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['availableSlots', staffId, dateStr],
    enabled: !!staffId,
    queryFn: async (): Promise<AvailableSlot[]> => {
      if (!staffId) return [];
      assertSupabase(supabase);

      const dow = date.getDay();
      if (dow !== 2 && dow !== 4) return [];

      const { data: booked, error } = await supabase
        .from('tasks')
        .select('time_slot')
        .eq('assigned_to', staffId)
        .eq('due_date', dateStr)
        .not('appointment_type', 'is', null)
        .neq('status', 'cancelado');

      if (error) throw mapSupabaseError(error);

      const bookedTimes = new Set(
        (booked || [])
          .map((t: { time_slot: string | null }) => (t.time_slot || '').slice(0, 5))
          .filter(Boolean)
      );

      return SLOT_HOURS
        .filter((h) => !bookedTimes.has(h))
        .map((h) => ({
          slot_id: `${dateStr}_${h}_${staffId}`,
          slot_date: dateStr,
          start_time: h,
          end_time: endOf(h),
          staff_id: staffId,
        }));
    },
  });
}
