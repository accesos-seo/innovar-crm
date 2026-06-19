import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import type { VisitMeasurementsV1 } from "@/lib/schemas/visit-measurements";

/**
 * Levantamiento técnico de un proyecto: medidas + fotos + notas capturadas en la
 * visita técnica, surfaced en la ficha del proyecto para el diseñador.
 *
 * Se resuelve vía la RPC `get_project_levantamiento` (SECURITY DEFINER): el rol
 * `diseno` NO pasa la RLS `visits_select`, así que la lectura de la visita se hace
 * en el servidor saltando esa restricción. Las fotos del bucket privado
 * `visit_photos` se firman client-side (la policy de lectura del bucket fue
 * ampliada a los roles internos en la migración 061).
 */

export interface LevantamientoPhoto {
  path: string;
  url: string | null;
}

export interface ProjectLevantamiento {
  visit_id: string;
  measurements: VisitMeasurementsV1 | null;
  photos: string[];
  notes: string | null;
  address: string | null;
  realized_at: string | null;
  visited_by: string | null;
  visited_by_name: string | null;
  photoUrls: LevantamientoPhoto[];
}

const BUCKET = "visit_photos";

export function useProjectLevantamiento(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-levantamiento", projectId],
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<ProjectLevantamiento | null> => {
      if (!projectId) return null;
      assertSupabase(supabase);

      const { data, error } = await supabase.rpc("get_project_levantamiento", {
        p_project_id: projectId,
      });
      if (error) throw mapSupabaseError(error);

      const row = (Array.isArray(data) ? data[0] : data) as any;
      if (!row) return null;

      const photos: string[] = Array.isArray(row.photos) ? row.photos : [];
      const photoUrls = await Promise.all(
        photos.map(async (path): Promise<LevantamientoPhoto> => {
          const { data: signed } = await supabase!.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);
          return { path, url: signed?.signedUrl ?? null };
        })
      );

      return {
        visit_id: row.visit_id,
        measurements: (row.measurements ?? null) as VisitMeasurementsV1 | null,
        photos,
        notes: row.notes ?? null,
        address: row.address ?? null,
        realized_at: row.realized_at ?? null,
        visited_by: row.visited_by ?? null,
        visited_by_name: row.visited_by_name ?? null,
        photoUrls,
      };
    },
  });
}
