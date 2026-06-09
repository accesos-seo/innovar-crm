import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';

/**
 * Lee un feature flag desde `system_settings` y lo castea a boolean.
 * - JSONB `true` / `"true"` / `{enabled: true}` → true
 * - Cualquier otra cosa (incluyendo loading / 404) → false
 *
 * staleTime 5 min: balance entre frescura de UX y carga sobre PG. El admin
 * que toggla en `PaymentSettings` invalida la query manualmente al guardar.
 */
export function useFeatureFlag(key: string): boolean {
  const { data } = useQuery({
    queryKey: ['system_settings', key],
    queryFn: async (): Promise<unknown> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      if (error) throw mapSupabaseError(error);
      return data?.value ?? null;
    },
    staleTime: 5 * 60_000,
  });

  return toBool(data);
}

function toBool(value: unknown): boolean {
  if (value === true) return true;
  if (value === 'true') return true;
  if (typeof value === 'object' && value !== null && 'enabled' in (value as Record<string, unknown>)) {
    return (value as { enabled: unknown }).enabled === true;
  }
  return false;
}
