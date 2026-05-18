import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function useProjectBalance(projectId?: string) {
  return useQuery({
    queryKey: ['project_balance', projectId],
    queryFn: async () => {
      if (!supabase || !projectId) return null;
      
      const { data, error } = await supabase.rpc("get_project_balance", { p_project_id: projectId });
      
      if (error) {
        // Since we may not have the RPC, gracefully fallback to computing locally or returning mock while we wait for backend updates.
        // But the prompt says use RPC directly. Let's just return what it returns.
        throw error;
      }
      return data;
    },
    enabled: !!projectId
  });
}
