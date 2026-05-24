import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

/**
 * Lee una fila de `system_settings` por su key. El valor vive en una columna
 * JSONB — el caller hace el cast al tipo concreto.
 *
 * `staleTime` 1 min: las settings cambian poco, evitar refetch agresivo.
 */
export function useSetting<T = unknown>(key: string) {
  return useQuery({
    queryKey: ['system_settings', key],
    queryFn: async (): Promise<T | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return (data?.value ?? null) as T | null;
    },
    staleTime: 60_000,
  });
}

export interface UpdateSettingInput {
  key: string;
  value: unknown;
}

/**
 * Upsert de una fila en `system_settings`. Invalida la key específica + la
 * lista (por si algún caller suscribe a varias).
 */
export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, UpdateSettingInput>({
    mutationFn: async ({ key, value }) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      if (error) throw mapSupabaseError(error);
      return { ok: true };
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ['system_settings', key] });
      qc.invalidateQueries({ queryKey: ['system_settings'] });
      toast.success('Configuración guardada');
    },
    onError: (err) => {
      toast.error('No pudimos guardar la configuración', { description: err.message });
    },
  });
}
