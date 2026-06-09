import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { SystemDictionaryEntry } from '@/types/database';
import { toast } from 'sonner';
import { assertSupabase, mapSupabaseError, notifyError } from '@/lib/errors';
import { systemDictionarySchema, type SystemDictionaryInsert } from '@/schemas/systemDictionary';

const DICTIONARY_KEY = 'system_dictionary';

export function useSystemDictionary(filters?: { category?: string; status?: string; search?: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [DICTIONARY_KEY, filters],
    queryFn: async (): Promise<SystemDictionaryEntry[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from('system_dictionary')
        .select('*');

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const response = await query.order('category', { ascending: true }).order('name', { ascending: true }) as any;
      const { data, error } = response;

      if (error) throw mapSupabaseError(error);

      return (data || []) as SystemDictionaryEntry[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('system_dictionary')
        .delete()
        .eq('id', id);

      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      toast.success('Entrada eliminada correctamente');
      queryClient.invalidateQueries({ queryKey: [DICTIONARY_KEY] });
    },
    onError: (error) => notifyError(error, "Error al eliminar entrada")
  });

  const upsertMutation = useMutation({
    mutationFn: async (entryData: Partial<SystemDictionaryInsert> & { id?: string }) => {
      assertSupabase(supabase);

      // Validate the user-provided fields; allow partial for partial updates.
      const validated = systemDictionarySchema.partial().parse(entryData);

      const { data, error } = await supabase
        .from('system_dictionary')
        .upsert({
          ...(entryData.id ? { id: entryData.id } : {}),
          ...validated,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) throw mapSupabaseError(error);
      return data?.[0] as SystemDictionaryEntry;
    },
    onSuccess: () => {
      toast.success('Operación realizada con éxito');
      queryClient.invalidateQueries({ queryKey: [DICTIONARY_KEY] });
    },
    onError: (error) => notifyError(error, "Error al guardar entrada")
  });

  return {
    entries: data || [],
    isLoading,
    refetch,
    deleteEntry: async (id: string) => deleteMutation.mutateAsync(id),
    upsertEntry: async (entryData: Partial<SystemDictionaryInsert> & { id?: string }) =>
      upsertMutation.mutateAsync(entryData),
  };
}
