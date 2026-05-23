import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { assertSupabase, mapSupabaseError } from '@/lib/errors';
import { useAuthStore } from '@/store/authStore';

export interface MyVisitToday {
  id: string;
  opportunity_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  visited_by: string;
  status: 'agendada' | 'confirmada' | 'reagendada' | 'realizada' | 'cancelada' | 'no_show';
  modality: string;
  scheduled_via: string;
  notes: string | null;
  measurements: unknown;
  photos: string[] | null;
  client: {
    id: string;
    name: string;
    whatsapp_phone: string | null;
    address: string | null;
  } | null;
  opportunity: {
    id: string;
    services: string[];
    short_code: string | null;
  } | null;
}

/**
 * Visitas asignadas al usuario logueado para HOY. Filtra cancelled/no_show
 * y soft-deleted. Ordenadas por `scheduled_at` ascendente.
 *
 * Fuente: `visits` directo (no `tasks`) — es la fuente de verdad de la
 * Fase 3 según el refactor map §0.
 */
export function useMyVisitsToday() {
  const profile = useAuthStore((s) => s.profile);
  const userId = profile?.id;

  return useQuery({
    queryKey: ['myVisitsToday', userId],
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 min — alta frescura para vista operativa
    retry: 0,
    queryFn: async (): Promise<MyVisitToday[]> => {
      assertSupabase(supabase);
      if (!userId) return [];

      // CURRENT_DATE en hora Colombia (donde opera el negocio).
      const tz = 'America/Bogota';
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // yyyy-mm-dd

      const startCo = `${today}T00:00:00-05:00`;
      const endCo = `${today}T23:59:59-05:00`;

      const { data, error } = await supabase
        .from('visits')
        .select(
          `
          id, opportunity_id, scheduled_at, duration_minutes, visited_by,
          status, modality, scheduled_via, notes, measurements, photos,
          opportunity:opportunity_id (
            id, services, short_code,
            client:client_id ( id, name, whatsapp_phone, address )
          )
          `
        )
        .eq('visited_by', userId)
        .gte('scheduled_at', startCo)
        .lte('scheduled_at', endCo)
        .not('status', 'in', '(cancelada,no_show)')
        .is('deleted_at', null)
        .order('scheduled_at', { ascending: true });

      if (error) throw mapSupabaseError(error);

      return ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        opportunity_id: row.opportunity_id,
        scheduled_at: row.scheduled_at,
        duration_minutes: row.duration_minutes,
        visited_by: row.visited_by,
        status: row.status,
        modality: row.modality,
        scheduled_via: row.scheduled_via,
        notes: row.notes,
        measurements: row.measurements,
        photos: (row.photos as string[] | null) ?? [],
        client: row.opportunity?.client ?? null,
        opportunity: row.opportunity
          ? {
              id: row.opportunity.id,
              services: row.opportunity.services ?? [],
              short_code: row.opportunity.short_code ?? null,
            }
          : null,
      })) as MyVisitToday[];
    },
  });
}
