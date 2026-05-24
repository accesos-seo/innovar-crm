import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

export interface ActiveDesigner {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
}

/**
 * Lista de diseñadores activos (rol `diseno`, `is_active=true`).
 * Se usa en `DesignerPicker` y futuros flujos de asignación de proyectos.
 */
export function useActiveDesigners() {
  return useQuery({
    queryKey: ['profiles', 'designers'],
    queryFn: async (): Promise<ActiveDesigner[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, whatsapp_phone')
        .eq('role', 'diseno')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data as ActiveDesigner[]) ?? [];
    },
    staleTime: 60_000,
  });
}
