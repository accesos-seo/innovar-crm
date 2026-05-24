import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/types/database';
import { addDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useAppointments(date: Date, view: 'week' | 'month' = 'week') {
  return useQuery({
    queryKey: ['appointments', date.toISOString(), view],
    queryFn: async (): Promise<Task[]> => {
      assertSupabase(supabase);
      // CitasCalendarView renderiza 7 días empezando LITERALMENTE en `date`
      // (no snapea a lunes). Antes este hook usaba startOfWeek(weekStartsOn:1)
      // y desalineaba: cuando `date` era sábado, la view mostraba Sab-Vie pero
      // la query fetcheaba Lun anterior-Dom → bookings en Mar/Jue de la view
      // visible caían FUERA del rango y no aparecían tras el invalidate.
      // Fix: usar el mismo rango que la view (date → date+6).
      const from = view === 'week' ? date : startOfMonth(date);
      const to = view === 'week' ? addDays(date, 6) : endOfMonth(date);

      // Usamos format() local (no toISOString que convierte a UTC y puede
      // shiftear el día en zonas con offset negativo como Colombia UTC-5).
      const fromStr = format(from, 'yyyy-MM-dd');
      const toStr = format(to, 'yyyy-MM-dd');

      const query = supabase
        .from('tasks')
        .select(`
          id, title, description, status, priority, due_date, time_slot, appointment_type,
          clients(id, name, whatsapp_phone, address),
          projects(id, name, status),
          profiles:assigned_to(id, full_name)
        `)
        .not('appointment_type', 'is', null)
        .neq('status', 'cancelado')
        .gte('due_date', fromStr)
        .lte('due_date', toStr)
        .order('due_date', { ascending: true })
        .order('time_slot', { ascending: true });

      const response = await query;
      const { data, error } = response as any;

      if (error) throw mapSupabaseError(error);
      return (data as unknown as Task[]) || [];
    }
  });
}
