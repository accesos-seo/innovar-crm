import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import {
  quotationInsertSchema,
  quotationApproveSchema,
  type QuotationInsert,
  type QuotationUpdate,
  type QuotationApprove,
} from "@/schemas/quotation";
import { type Quotation } from "@/types/database";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";

const QUOTATIONS_KEY = "quotations";

// ─────────────────────────────────────────────────────────────────────────────
// Quotation number generation
//
// Previously this was generated client-side by reading the last quotation_number
// and incrementing. That has a race condition: two concurrent users get the
// same number, and the second insert fails (or silently corrupts data).
//
// Preferred fix: deploy the Postgres function in
//   db/migrations/001_generate_quotation_number.sql
// which uses a SELECT FOR UPDATE inside a transaction.
//
// This helper tries the RPC first. If the function doesn't exist yet, it falls
// back to a client-side retry loop that catches the 23505 unique-violation
// error and re-tries up to MAX_RETRIES times.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;

async function generateNextQuotationNumber(): Promise<string> {
  assertSupabase(supabase);

  // 1. Try the RPC (atomic, server-side).
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "generate_next_quotation_number"
  );
  if (!rpcError && typeof rpcResult === "string") {
    return rpcResult;
  }

  // 2. Fallback: client-side read + format. Caller MUST handle 23505 retry.
  const year = new Date().getFullYear();
  const { data: lastQuot } = await supabase
    .from("quotations")
    .select("quotation_number")
    .like("quotation_number", `COT-${year}-%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum =
    lastQuot && lastQuot.quotation_number
      ? parseInt(lastQuot.quotation_number.split("-")[2], 10) || 0
      : 0;
  return `COT-${year}-${String(lastNum + 1).padStart(4, "0")}`;
}

// ── Listar cotizaciones (con filtros) ────────────────────────────────────────
export const useQuotations = (filters?: { status?: string; client_id?: string }) => {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, filters],
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Quotation[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from("quotations")
        .select(
          `
          *,
          client:clients(id, name, email, whatsapp_phone),
          items:quotation_items(*)
        `
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.client_id) query = query.eq("client_id", filters.client_id);

      const response = (await query) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as Quotation[]) || [];
    },
  });
};

// ── Cotización por ID ────────────────────────────────────────────────────────
export const useQuotation = (id: string | null) => {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<Quotation | null> => {
      if (!id) return null;
      assertSupabase(supabase);

      const query = supabase
        .from("quotations")
        .select(
          `
          *,
          client:clients(*),
          items:quotation_items(*)
        `
        )
        .eq("id", id)
        .single();

      const response = (await query) as any;
      const { data, error } = response;
      if (error) {
        const mapped = mapSupabaseError(error);
        if (mapped.code === "NOT_FOUND") return null;
        throw mapped;
      }
      return data as Quotation;
    },
  });
};

// ── Cotizaciones de un cliente ───────────────────────────────────────────────
export const useClientQuotations = (clientId: string | null) => {
  return useQuery({
    queryKey: [QUOTATIONS_KEY, "client", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Quotation[]> => {
      if (!clientId) return [];
      assertSupabase(supabase);

      const query = supabase
        .from("quotations")
        .select("*")
        .eq("client_id", clientId)
        .is("deleted_at", null)
        .order("version_number", { ascending: false });

      const response = (await query) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as Quotation[]) || [];
    },
  });
};

// ── Crear cotización (con retry anti-race-condition) ─────────────────────────
export const useCreateQuotation = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (
      quotationData: Omit<QuotationInsert, "created_by" | "quotation_number">
    ): Promise<Quotation> => {
      assertSupabase(supabase);

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const quotation_number = await generateNextQuotationNumber();

        const validated = quotationInsertSchema.parse({
          ...quotationData,
          quotation_number,
          created_by: user?.id,
        });

        const { data, error } = await supabase
          .from("quotations")
          .insert(validated)
          .select()
          .single();

        // Success
        if (!error) return data as Quotation;

        // Unique violation on quotation_number → retry with next number
        const mapped = mapSupabaseError(error);
        if (mapped.pgCode === "23505" && attempt < MAX_RETRIES - 1) {
          console.warn(
            `[useCreateQuotation] race condition on attempt ${attempt + 1}, retrying...`
          );
          continue;
        }

        throw mapped;
      }

      throw new Error(
        "No se pudo generar un número de cotización único después de varios intentos."
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY, "client", data.client_id] });
    },
    onError: (error) => notifyError(error, "Error al crear cotización"),
  });
};

// ── Actualizar cotización ────────────────────────────────────────────────────
export const useUpdateQuotation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: QuotationUpdate): Promise<Quotation> => {
      assertSupabase(supabase);

      const { data, error } = await supabase
        .from("quotations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw mapSupabaseError(error);
      return data as Quotation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY, data.id] });
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al actualizar cotización"),
  });
};

// ── Aprobar cotización + crear proyecto ──────────────────────────────────────
export const useApproveQuotation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (approvalData: QuotationApprove) => {
      assertSupabase(supabase);

      const { quotation_id, project_name, designer_id, design_deadline, adjusted_total } =
        quotationApproveSchema.parse(approvalData);

      // 1. Mark quotation as approved
      const { data: quotation, error: quotError } = await supabase
        .from("quotations")
        .update({ status: "approved", is_locked: true })
        .eq("id", quotation_id)
        .select()
        .single();
      if (quotError) throw mapSupabaseError(quotError);

      // 2. Create linked project
      const { data: project, error: projError } = await supabase
        .from("projects")
        .insert({
          name: project_name,
          client_id: quotation.client_id,
          approved_quotation_id: quotation_id,
          work_type: "cocina",
          status: "cotizacion_aprobada",
          total_amount: adjusted_total || quotation.total_amount,
          designer_id: designer_id || null,
          design_deadline: design_deadline || null,
          data_origin: "system",
        })
        .select()
        .single();
      if (projError) throw mapSupabaseError(projError);

      return { quotation, project };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => notifyError(error, "Error al aprobar cotización"),
  });
};
