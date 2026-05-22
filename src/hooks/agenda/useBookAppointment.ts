import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

interface BookAppointmentParams {
  clientId: string;
  staffId: string;
  date: string;
  timeSlot: string;
  appointmentType: 'visita_tecnica' | 'cita_diseno';
}

export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, staffId, date, timeSlot, appointmentType }: BookAppointmentParams) => {
      assertSupabase(supabase);

      const { data: existing, error: existingErr } = await supabase
        .from('tasks')
        .select('id')
        .eq('assigned_to', staffId)
        .eq('due_date', date)
        .eq('time_slot', timeSlot)
        .not('appointment_type', 'is', null)
        .neq('status', 'cancelado')
        .limit(1);

      if (existingErr) throw mapSupabaseError(existingErr);
      if (existing && existing.length > 0) {
        throw new AppError('VALIDATION', 'Este horario ya no está disponible');
      }

      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();

      if (clientErr) throw mapSupabaseError(clientErr);

      const title = appointmentType === 'visita_tecnica'
        ? `Visita técnica - ${client?.name ?? 'Cliente'}`
        : `Cita de diseño - ${client?.name ?? 'Cliente'}`;

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          assigned_to: staffId,
          title,
          status: 'pendiente',
          due_date: date,
          time_slot: timeSlot,
          appointment_type: appointmentType,
          task_category: 'cita',
        })
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      toast.success('Cita agendada correctamente');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
    },
    onError: (error) => notifyError(error, 'Error al agendar cita'),
  });
}
