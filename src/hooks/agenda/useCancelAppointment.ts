import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      assertSupabase(supabase);

      // 1. Liberar el slot (best-effort: si falla no abortamos)
      const { error: slotError } = await supabase
        .from("availability_slots")
        .update({ is_booked: false, task_id: null })
        .eq("task_id", taskId);

      if (slotError) {
          console.warn("Could not free availability slot");
      }

      // 2. Marcar la tarea como cancelada (soft delete para no romper FKs de
      //    notificaciones / comentarios / adjuntos que apunten a esta tarea)
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("id", taskId);

      if (taskError) throw mapSupabaseError(taskError);

      return taskId;
    },
    onSuccess: () => {
      toast.success("Cita cancelada correctamente");
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
    },
    onError: (error) => notifyError(error, "Error al cancelar cita")
  });
}
