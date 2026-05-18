import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { assertSupabase, mapSupabaseError, notifyError, AppError } from '@/lib/errors';

export function useApproveExpense() {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);

  return useMutation({
    mutationFn: async ({ id, approval_status }: { id: string, approval_status: 'aprobado' | 'rechazado' }) => {
      assertSupabase(supabase);
      if (!user) throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión.");

      const { data, error } = await supabase.from('expenses').update({
        approval_status,
        approved_by: user.id
      }).eq('id', id).select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['project_balance'] });
      queryClient.invalidateQueries({ queryKey: ['financial_summary'] });
    },
    onError: (error) => notifyError(error, "Error al aprobar gasto")
  });
}
