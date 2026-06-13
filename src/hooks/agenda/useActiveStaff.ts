import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

interface Profile {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
}

export function useActiveStaff() {
  return useQuery({
    queryKey: ['activeStaff'],
    staleTime: 1000 * 60 * 30, // 30 min — staff cambia raramente
    queryFn: async (): Promise<Profile[]> => {
      assertSupabase(supabase);
      const query = supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url');

      const response = (await query) as any;
      const { data, error } = response;

      if (error) throw mapSupabaseError(error);
      return (data as Profile[]) || [];
    }
  });
}
