import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

export function useCreateClosure() {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  return useMutation({
    mutationFn: async ({ project_id, notes }: { project_id: string, notes?: string }) => {
      assertSupabase(supabase);
      if (!user) throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión.");

      const { data, error } = await supabase.rpc("create_accounting_closure", {
        p_project_id: project_id,
        p_closed_by: user.id,
        p_notes: notes || null
      });

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closures'] });
      queryClient.invalidateQueries({ queryKey: ['financial_summary'] });
    },
    onError: (error) => notifyError(error, "Error al crear cierre contable")
  });
}
