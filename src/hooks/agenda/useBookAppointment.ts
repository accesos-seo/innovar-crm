import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

interface BookAppointmentParams {
  clientId: string;
  slotId: string;
  appointmentType: 'visita_tecnica' | 'cita_diseno';
}

export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, slotId, appointmentType }: BookAppointmentParams) => {
      assertSupabase(supabase);

      const { data, error } = await supabase.rpc("book_appointment", {
        p_client_id: clientId,
        p_slot_id: slotId,
        p_appointment_type: appointmentType
      });

      if (error) throw mapSupabaseError(error);

      if (data && data.success === false) {
        throw new AppError("VALIDATION", data.message || data.error || "Error al agendar cita");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Cita agendada correctamente");
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
    },
    onError: (error) => notifyError(error, "Error al agendar cita")
  });
}
