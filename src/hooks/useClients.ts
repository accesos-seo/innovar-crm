import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Client } from "@/types/database";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { clientInsertSchema, type ClientInsert } from "@/schemas/client";
import { toast } from "sonner";

const CLIENTS_KEY = "clients";

export interface ClientsFilters {
  /** Si true, solo se muestran clientes archivados (deleted_at IS NOT NULL). */
  onlyArchived?: boolean;
}

export function useClients(
  searchTerm: string = "",
  pagination?: { pageIndex: number; pageSize: number },
  filters?: ClientsFilters,
) {
  const queryClient = useQueryClient();
  const onlyArchived = !!filters?.onlyArchived;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [CLIENTS_KEY, searchTerm, pagination, onlyArchived],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      assertSupabase(supabase);

      const { data: projClients, error: projErr } = await supabase
        .from("projects")
        .select("client_id")
        .not("client_id", "is", null);
      if (projErr) throw mapSupabaseError(projErr);

      const clientIds = Array.from(
        new Set((projClients || []).map((p: { client_id: string | null }) => p.client_id).filter(Boolean) as string[])
      );

      if (clientIds.length === 0) {
        return { data: [] as Client[], count: 0 };
      }

      let query = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .in("id", clientIds);

      // Filtro de archivados: por default ocultamos los archivados (deleted_at NOT NULL).
      // Con onlyArchived=true mostramos solo los archivados.
      if (onlyArchived) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,whatsapp_phone.ilike.%${searchTerm}%`
        );
      }

      let ordered = query.order("name", { ascending: true });

      if (pagination) {
        const { pageIndex, pageSize } = pagination;
        ordered = ordered.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
      }

      const response = (await ordered) as any;
      const { data, error, count } = response;

      if (error) throw mapSupabaseError(error);

      return { data: (data || []) as Client[], count: count || 0 };
    },
  });

  // Archivar = soft-delete (UPDATE deleted_at). NO borramos físicamente clients
  // porque la fila puede tener payments/projects que referencian; perderla rompe
  // la contabilidad y la auditoría.
  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() } as never)
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_d, ids) => {
      toast.success(
        ids.length === 1
          ? "Cliente archivado"
          : `${ids.length} clientes archivados`,
      );
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al archivar clientes"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("clients")
        .update({ deleted_at: null } as never)
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_d, ids) => {
      toast.success(
        ids.length === 1
          ? "Cliente restaurado"
          : `${ids.length} clientes restaurados`,
      );
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al restaurar clientes"),
  });

  return {
    clients: data?.data || [],
    isLoading,
    totalCount: data?.count || 0,
    refetch,
    archiveClients: async (ids: string[]) => archiveMutation.mutateAsync(ids),
    restoreClients: async (ids: string[]) => restoreMutation.mutateAsync(ids),
  };
}

/**
 * Alta directa de cliente (carta cliente 2026-06-11). El flujo principal sigue
 * siendo lead → conversión automática; este atajo cubre clientes que llegan
 * por fuera del embudo (referidos, presenciales) sin pasar por solicitudes.
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: ClientInsert) => {
      assertSupabase(supabase);
      const validated = clientInsertSchema.parse(clientData);
      const { data, error } = await supabase
        .from("clients")
        .insert(validated)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => notifyError(error, "Error al crear cliente"),
  });
}

/**
 * Mutación standalone para actualizar un cliente (fila en tabla `clients`).
 * Mirror de useUpdateLead — clients y leads comparten tabla en este sistema
 * (un "client" es un row que tiene proyectos asociados; un "lead" es uno que
 * todavía no). Por eso invalidamos ambas query keys.
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Client> }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      // Invalida el detalle de oportunidad — el panel embebe datos del cliente
      // (whatsapp_phone, email) via FK join y tiene su propia query key.
      queryClient.invalidateQueries({ queryKey: ["opportunity"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (error) => notifyError(error, "Error al actualizar cliente"),
  });
}
