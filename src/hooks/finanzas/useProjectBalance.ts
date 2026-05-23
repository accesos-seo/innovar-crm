import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export function useProjectBalance(projectId?: string) {
  return useQuery({
    queryKey: ['project_balance', projectId],
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 min — balance no cambia tan seguido
    queryFn: async () => {
      assertSupabase(supabase);
      if (!projectId) return null;

      const rpcCall = supabase.rpc('get_project_balance', { p_project_id: projectId });
      const response = (await rpcCall) as any;
      const { data, error } = response;

      if (error) throw mapSupabaseError(error);
      return data;
    },
  });
}
