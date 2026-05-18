import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

interface Profile {
  id: string;
  full_name: string | null;
  role: string | null;
}

export function useActiveStaff() {
  return useQuery({
    queryKey: ['activeStaff'],
    retry: 0,
    queryFn: async (): Promise<Profile[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role');
        // si existe is_active se le puede agregar: .eq('is_active', true)

      if (error) throw mapSupabaseError(error);
      return (data as Profile[]) || [];
    }
  });
}
