import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';

export function useCompleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      assertSupabase(supabase);

      const { data, error } = await supabase
        .from("tasks")
        .update({ status: "completado", updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      toast.success("Cita marcada como completada");
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error) => notifyError(error, "Error al completar cita")
  });
}
