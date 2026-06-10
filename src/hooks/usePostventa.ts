// Hooks del módulo Postventa y Garantías (PRD-postventa-garantias.md).
// Tablas de prod: warranties, warranty_claims, satisfaction_surveys +
// vista v_postventa_metrics (migración 055).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";

const WARRANTIES_KEY = "warranties";
const CLAIMS_KEY = "warranty_claims";
const SURVEYS_KEY = "satisfaction_surveys";
const METRICS_KEY = "postventa_metrics";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type WarrantyStatus = "active" | "expired" | "claimed" | "voided";
export type ClaimSeverity = "low" | "medium" | "high" | "critical";
export type ClaimStatus = "open" | "in_progress" | "resolved" | "rejected";
export type SurveyStatus = "pending" | "sent" | "responded" | "expired";

export interface Warranty {
  id: string;
  project_id: string;
  client_id: string | null;
  warranty_months: number;
  starts_at: string;
  expires_at: string;
  status: WarrantyStatus;
  notes: string | null;
  created_at: string;
  project: { id: string; name: string } | null;
  client: { id: string; name: string; whatsapp_phone: string | null } | null;
  claims: { id: string; status: ClaimStatus }[];
}

export interface WarrantyClaim {
  id: string;
  warranty_id: string;
  claim_number: string | null;
  reported_at: string;
  description: string;
  severity: ClaimSeverity;
  status: ClaimStatus;
  resolved_at: string | null;
  resolution_notes: string | null;
  assigned_to: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
  warranty: {
    id: string;
    project: { id: string; name: string } | null;
    client: { id: string; name: string } | null;
  } | null;
  assignee: { id: string; full_name: string | null } | null;
}

export interface SatisfactionSurvey {
  id: string;
  project_id: string;
  client_id: string | null;
  public_token: string;
  status: SurveyStatus;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  rating_overall: number | null;
  rating_quality: number | null;
  rating_punctuality: number | null;
  rating_service: number | null;
  would_recommend: boolean | null;
  comments: string | null;
  created_at: string;
  project: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
}

export interface PostventaMetrics {
  warranties_active: number;
  warranties_expiring_60d: number;
  claims_open: number;
  claims_in_progress: number;
  claims_avg_resolution_days: number | null;
  rating_overall_avg: number | null;
  rating_quality_avg: number | null;
  rating_punctuality_avg: number | null;
  rating_service_avg: number | null;
  surveys_responded: number;
  would_recommend_pct: number | null;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const useWarranties = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: [WARRANTIES_KEY, filters],
    queryFn: async (): Promise<Warranty[]> => {
      assertSupabase(supabase);
      let query = supabase
        .from("warranties")
        .select(`
          *,
          project:projects!warranties_project_id_fkey(id, name),
          client:clients!warranties_client_id_fkey(id, name, whatsapp_phone),
          claims:warranty_claims!warranty_claims_warranty_id_fkey(id, status)
        `)
        .order("expires_at", { ascending: true });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = (await query) as any;
      if (error) throw mapSupabaseError(error);
      return (data as Warranty[]) || [];
    },
  });
};

export const useWarrantyClaims = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: [CLAIMS_KEY, filters],
    queryFn: async (): Promise<WarrantyClaim[]> => {
      assertSupabase(supabase);
      let query = supabase
        .from("warranty_claims")
        .select(`
          *,
          warranty:warranties!warranty_claims_warranty_id_fkey(
            id,
            project:projects!warranties_project_id_fkey(id, name),
            client:clients!warranties_client_id_fkey(id, name)
          ),
          assignee:profiles!warranty_claims_assigned_to_fkey(id, full_name)
        `)
        .order("reported_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = (await query) as any;
      if (error) throw mapSupabaseError(error);
      return (data as WarrantyClaim[]) || [];
    },
  });
};

export const useSurveys = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: [SURVEYS_KEY, filters],
    queryFn: async (): Promise<SatisfactionSurvey[]> => {
      assertSupabase(supabase);
      let query = supabase
        .from("satisfaction_surveys")
        .select(`
          *,
          project:projects!satisfaction_surveys_project_id_fkey(id, name),
          client:clients!satisfaction_surveys_client_id_fkey(id, name)
        `)
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = (await query) as any;
      if (error) throw mapSupabaseError(error);
      return (data as SatisfactionSurvey[]) || [];
    },
  });
};

export const usePostventaMetrics = () => {
  return useQuery({
    queryKey: [METRICS_KEY],
    queryFn: async (): Promise<PostventaMetrics | null> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("v_postventa_metrics")
        .select("*")
        .single();
      if (error) throw mapSupabaseError(error);
      return data as PostventaMetrics;
    },
  });
};

// ── Mutaciones ───────────────────────────────────────────────────────────────

export interface CreateClaimInput {
  warranty_id: string;
  description: string;
  severity: ClaimSeverity;
  assigned_to?: string | null;
  photos?: File[];
}

// Crea el reclamo y sube fotos al bucket privado claim-photos.
// El trigger trg_notify_claim_created (DB) pasa la garantía a 'claimed' y
// avisa por WA al admin si la severidad es alta/crítica.
export const useCreateClaim = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClaimInput): Promise<WarrantyClaim> => {
      assertSupabase(supabase);

      const { data: claim, error } = await supabase
        .from("warranty_claims")
        .insert({
          warranty_id: input.warranty_id,
          description: input.description.trim(),
          severity: input.severity,
          status: "open",
          assigned_to: input.assigned_to ?? null,
          reported_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error) throw mapSupabaseError(error);

      // Fotos: path <claim_id>/<uuid>.<ext>; los paths quedan en photos JSONB
      if (input.photos && input.photos.length > 0) {
        const paths: string[] = [];
        for (const file of input.photos) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${claim.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("claim-photos")
            .upload(path, file);
          if (upErr) throw mapSupabaseError(upErr);
          paths.push(path);
        }
        const { error: updErr } = await supabase
          .from("warranty_claims")
          .update({ photos: paths })
          .eq("id", claim.id);
        if (updErr) throw mapSupabaseError(updErr);
      }

      return claim as WarrantyClaim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [WARRANTIES_KEY] });
      queryClient.invalidateQueries({ queryKey: [METRICS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al crear el reclamo"),
  });
};

export interface UpdateClaimInput {
  id: string;
  status?: ClaimStatus;
  assigned_to?: string | null;
  resolution_notes?: string | null;
}

export const useUpdateClaim = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateClaimInput) => {
      assertSupabase(supabase);

      // resolution_notes obligatorio al resolver/rechazar; resolved_at automático
      const patch: Record<string, unknown> = { ...updates };
      if (updates.status === "resolved" || updates.status === "rejected") {
        if (!updates.resolution_notes?.trim()) {
          throw new AppError(
            "VALIDATION",
            "Las notas de resolución son obligatorias al resolver o rechazar."
          );
        }
        patch.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("warranty_claims")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw mapSupabaseError(error);
      return data as WarrantyClaim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLAIMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [METRICS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al actualizar el reclamo"),
  });
};

// Anular garantía (solo admin) con motivo en notes
export const useVoidWarranty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      assertSupabase(supabase);
      if (!reason.trim()) {
        throw new AppError("VALIDATION", "El motivo de anulación es obligatorio.");
      }
      const { data, error } = await supabase
        .from("warranties")
        .update({
          status: "voided",
          notes: `Anulada: ${reason.trim()}`,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw mapSupabaseError(error);
      return data as Warranty;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WARRANTIES_KEY] });
      queryClient.invalidateQueries({ queryKey: [METRICS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al anular la garantía"),
  });
};

// Enviar/reenviar encuesta ahora — RPC send_survey_now (respeta DRY_RUN)
export const useSendSurveyNow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (surveyId: string): Promise<{ ok: boolean; error?: string }> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc("send_survey_now", {
        p_survey_id: surveyId,
      });
      if (error) throw mapSupabaseError(error);
      return data as { ok: boolean; error?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SURVEYS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al enviar la encuesta"),
  });
};

// Signed URLs para la galería de fotos de un reclamo (bucket privado)
export const useClaimPhotoUrls = (claim: WarrantyClaim | null) => {
  return useQuery({
    queryKey: [CLAIMS_KEY, "photos", claim?.id, claim?.photos],
    enabled: !!claim && (claim.photos?.length ?? 0) > 0,
    queryFn: async (): Promise<string[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase.storage
        .from("claim-photos")
        .createSignedUrls(claim!.photos, 3600);
      if (error) throw mapSupabaseError(error);
      return (data ?? [])
        .map((d: { signedUrl: string }) => d.signedUrl)
        .filter(Boolean);
    },
  });
};

// Perfiles activos para el combobox "Asignado a"
export const useAssignableProfiles = () => {
  return useQuery({
    queryKey: ["profiles", "assignable"],
    queryFn: async (): Promise<{ id: string; full_name: string | null }[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw mapSupabaseError(error);
      return data ?? [];
    },
  });
};
