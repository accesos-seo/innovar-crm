import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface ActiveVisitor {
  id: string;
  full_name: string | null;
  role: 'admin' | 'super_admin' | 'comercial';
}

/**
 * Lista de profiles que pueden recibir una visita técnica (admin, super_admin
 * o comercial activos). Alimenta el `VisitOwnerPicker` de S2.
 */
export function useActiveVisitors() {
  return useQuery({
    queryKey: ['activeVisitors'],
    staleTime: 1000 * 60 * 5, // 5 min — staff cambia raramente
    retry: 0,
    queryFn: async (): Promise<ActiveVisitor[]> => {
      assertSupabase(supabase);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('is_active', true)
        .in('role', ['admin', 'super_admin', 'comercial'])
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (error) throw mapSupabaseError(error);
      return (data as ActiveVisitor[]) ?? [];
    },
  });
}
