import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/types/database';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { withTimeout } from '@/lib/timeout';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useAppointments(date: Date, view: 'week' | 'month' = 'week') {
  return useQuery({
    queryKey: ['appointments', date.toISOString(), view],
    queryFn: async (): Promise<Task[]> => {
      assertSupabase(supabase);
      const from = view === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : startOfMonth(date);
      const to = view === 'week' ? endOfWeek(date, { weekStartsOn: 1 }) : endOfMonth(date);

      // Using YYYY-MM-DD for date comparison
      const fromStr = from.toISOString().split('T')[0];
      const toStr = to.toISOString().split('T')[0];

      const query = supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, due_date, time_slot, appointment_type,
          clients(id, name, whatsapp_phone, address),
          projects(id, name, status),
          profiles:assigned_to(id, full_name)
        `)
        .not('appointment_type', 'is', null)
        .gte('due_date', fromStr)
        .lte('due_date', toStr)
        .order('due_date', { ascending: true })
        .order('time_slot', { ascending: true });

      const response = await withTimeout(query as any);
      const { data, error } = response as any;

      if (error) throw mapSupabaseError(error);
      return (data as unknown as Task[]) || [];
    }
  });
}
