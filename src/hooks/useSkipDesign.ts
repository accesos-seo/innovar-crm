import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";

const PROJECTS_KEY = "projects";

export type SkipDesignCategory =
  | "reparaciones"
  | "reposiciones"
  | "acabados"
  | "puertas"
  | "catalogo";

export const SKIP_DESIGN_CATEGORY_LABELS: Record<SkipDesignCategory, string> = {
  reparaciones: "Reparaciones",
  reposiciones: "Reposiciones de piezas",
  acabados: "Acabados y retoques",
  puertas: "Puertas de reposición",
  catalogo: "Catálogo estándar",
};

type RequestArgs = {
  projectId: string;
  category: SkipDesignCategory;
  justification?: string;
};

// El comercial/admin marca un proyecto como "ejecución directa" (sin diseño).
// Bajo umbral (o si lo pide admin) se aplica al instante; sobre umbral queda
// pendiente de aprobación de admin (lo decide el backend en request_skip_design).
export function useRequestSkipDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, category, justification }: RequestArgs) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc("request_skip_design", {
        p_project_id: projectId,
        p_category: category,
        p_justification: justification || null,
      });
      if (error) throw mapSupabaseError(error);
      const res = data as { ok: boolean; mode?: string; error?: string };
      if (!res?.ok) throw mapSupabaseError({ message: res?.error || "No se pudo marcar sin diseño" });
      return res;
    },
    onSuccess: (_res, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error, "Error al marcar ejecución directa"),
  });
}

type ResolveArgs = {
  projectId: string;
  approve: boolean;
  reason?: string;
};

// Admin aprueba o rechaza una omisión de diseño que quedó pendiente.
export function useResolveSkipDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, approve, reason }: ResolveArgs) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc("resolve_skip_design", {
        p_project_id: projectId,
        p_approve: approve,
        p_reason: reason || null,
      });
      if (error) throw mapSupabaseError(error);
      const res = data as { ok: boolean; approved?: boolean; error?: string };
      if (!res?.ok) throw mapSupabaseError({ message: res?.error || "No se pudo resolver la solicitud" });
      return res;
    },
    onSuccess: (_res, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error, "Error al resolver la solicitud"),
  });
}
