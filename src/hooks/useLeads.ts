import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/timeout";
import { Client as Lead } from "@/types/database";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { clientSchema, type ClientInsert } from "@/schemas/client";
import { toast } from "sonner";

const LEADS_KEY = "leads";

export interface LeadFilters {
  status: string[];
  urgency: string[];
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
  onlyArchived?: boolean;
}

export function useLeads(
  searchTerm: string = "",
  pagination?: { pageIndex: number; pageSize: number },
  filters?: LeadFilters
) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [LEADS_KEY, searchTerm, pagination, filters],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      assertSupabase(supabase);

      const { data: projClients, error: projErr } = await supabase
        .from("projects")
        .select("client_id")
        .not("client_id", "is", null);
      if (projErr) throw mapSupabaseError(projErr);

      const convertedIds = Array.from(
        new Set((projClients || []).map((p: { client_id: string | null }) => p.client_id).filter(Boolean) as string[])
      );

      let query = supabase.from("clients").select("*", { count: "exact" });

      if (convertedIds.length > 0) {
        query = query.not("id", "in", `(${convertedIds.join(",")})`);
      }

      if (filters?.onlyArchived) {
        query = query.not("deleted_at", "is", null);
      } else if (!filters?.includeArchived) {
        query = query.is("deleted_at", null);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,whatsapp_phone.ilike.%${searchTerm}%`
        );
      }

      if (filters?.status?.length) {
        query = query.in("status", filters.status);
      }
      if (filters?.urgency?.length) {
        query = query.in("urgency", filters.urgency);
      }
      if (filters?.city) {
        query = query.ilike("city", `%${filters.city}%`);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      let ordered = query.order("created_at", { ascending: false });

      if (pagination) {
        const { pageIndex, pageSize } = pagination;
        ordered = ordered.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
      }

      const response = (await withTimeout(ordered)) as any;
      const { data, error, count } = response;

      if (error) throw mapSupabaseError(error);

      return { data: (data || []) as Lead[], count: count || 0 };
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1
          ? "Solicitud archivada"
          : `${ids.length} solicitudes archivadas`,
        { description: "Podés recuperarlas activando 'Mostrar archivados' en filtros." }
      );
      queryClient.invalidateQueries({ queryKey: [LEADS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => notifyError(error, "Error al archivar solicitudes"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1
          ? "Solicitud restaurada"
          : `${ids.length} solicitudes restauradas`
      );
      queryClient.invalidateQueries({ queryKey: [LEADS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => notifyError(error, "Error al restaurar solicitudes"),
  });

  const createMutation = useMutation({
    mutationFn: async (leadData: Partial<ClientInsert>) => {
      assertSupabase(supabase);
      // Allow partial input for leads (less strict than full clients) but
      // still validate the fields that are present.
      const validated = clientSchema.partial().parse(leadData);
      const { data, error } = await supabase
        .from("clients")
        .insert([validated])
        .select();
      if (error) throw mapSupabaseError(error);
      return data?.[0] as Lead;
    },
    onSuccess: () => {
      toast.success("Solicitud creada correctamente");
      queryClient.invalidateQueries({ queryKey: [LEADS_KEY] });
      // Also invalidate clients (same underlying table)
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => notifyError(error, "Error al crear solicitud"),
  });

  return {
    leads: data?.data || [],
    isLoading,
    totalCount: data?.count || 0,
    refetch,
    deleteLeads: async (ids: string[]) => archiveMutation.mutateAsync(ids),
    archiveLeads: async (ids: string[]) => archiveMutation.mutateAsync(ids),
    restoreLeads: async (ids: string[]) => restoreMutation.mutateAsync(ids),
    createLead: async (leadData: Partial<ClientInsert>) => createMutation.mutateAsync(leadData),
  };
}
