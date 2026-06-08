import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { toast } from "sonner";
import {
  opportunityInsertSchema,
  type OpportunityInsert,
  type OpportunityStatus,
  type OpportunityPriority,
  type OpportunityDataOrigin,
} from "@/schemas/opportunity";
import type { Database } from "@/types/database.types";

export const OPPORTUNITIES_KEY = "opportunities";

type OpportunityRow = Database["public"]["Tables"]["opportunities"]["Row"];

export interface OpportunityWithClient extends OpportunityRow {
  client: {
    id: string;
    name: string | null;
    email: string | null;
    whatsapp_phone: string | null;
    address: string | null;
  } | null;
  assigned_user: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface OpportunityFilters {
  status?: OpportunityStatus[];
  priority?: OpportunityPriority[];
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
  onlyArchived?: boolean;
  assignedTo?: string;
}

export function useOpportunities(
  searchTerm: string = "",
  pagination?: { pageIndex: number; pageSize: number },
  filters?: OpportunityFilters,
) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [OPPORTUNITIES_KEY, searchTerm, pagination, filters],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      assertSupabase(supabase);

      let query = supabase
        .from("opportunities")
        .select(
          `*,
           client:clients!opportunities_client_id_fkey(id,name,email,whatsapp_phone,address),
           assigned_user:profiles!opportunities_assigned_to_fkey(id,full_name,email,avatar_url)`,
          { count: "exact" },
        );

      if (filters?.onlyArchived) {
        query = query.not("deleted_at", "is", null);
      } else if (!filters?.includeArchived) {
        query = query.is("deleted_at", null);
      }

      if (filters?.status?.length) {
        query = query.in("status", filters.status);
      }
      if (filters?.priority?.length) {
        query = query.in("priority", filters.priority);
      }
      if (filters?.city) {
        query = query.ilike("city", `%${filters.city}%`);
      }
      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      // Búsqueda libre — encadenamos por columnas del cliente y notas internas.
      if (searchTerm) {
        const escaped = searchTerm.replace(/[,()]/g, " ");
        query = query.or(
          `notes.ilike.%${escaped}%,city.ilike.%${escaped}%,address.ilike.%${escaped}%`,
        );
      }

      let ordered = query.order("created_at", { ascending: false });

      if (pagination) {
        const { pageIndex, pageSize } = pagination;
        ordered = ordered.range(
          pageIndex * pageSize,
          (pageIndex + 1) * pageSize - 1,
        );
      }

      const response = (await ordered) as any;
      const { data, error, count } = response;
      if (error) throw mapSupabaseError(error);

      let rows = (data || []) as OpportunityWithClient[];

      // Búsqueda por campos del cliente — Supabase no soporta `or` sobre FK
      // anidados, así que filtramos en el cliente cuando hay searchTerm.
      if (searchTerm) {
        const needle = searchTerm.toLowerCase();
        rows = rows.filter((r) => {
          const c = r.client;
          if (!c) return true;
          return (
            c.name?.toLowerCase().includes(needle) ||
            c.email?.toLowerCase().includes(needle) ||
            c.whatsapp_phone?.toLowerCase().includes(needle) ||
            r.notes?.toLowerCase().includes(needle) ||
            r.city?.toLowerCase().includes(needle) ||
            r.address?.toLowerCase().includes(needle)
          );
        });
      }

      return { data: rows, count: count ?? rows.length };
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("opportunities")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1
          ? "Oportunidad archivada"
          : `${ids.length} oportunidades archivadas`,
      );
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
    },
    onError: (error) => notifyError(error, "Error al archivar oportunidades"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase
        .from("opportunities")
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1
          ? "Oportunidad restaurada"
          : `${ids.length} oportunidades restauradas`,
      );
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
    },
    onError: (error) => notifyError(error, "Error al restaurar oportunidades"),
  });

  // Crea o reutiliza cliente por whatsapp_phone normalizado, luego inserta
  // la opportunity. No es transaccional (PostgREST no soporta multi-table TX),
  // pero el UNIQUE parcial en clients.whatsapp_phone garantiza que dos creates
  // del mismo prospecto no dupliquen.
  const createOpportunityMutation = useMutation({
    mutationFn: async (input: {
      // Datos del cliente (lookup/insert).
      clientName: string;
      whatsappPhone: string;
      email?: string | null;
      address?: string | null;
      city?: string | null;
      // Datos de la opportunity.
      services: string[];
      priority: OpportunityPriority;
      dataOrigin: OpportunityDataOrigin;
      status?: OpportunityStatus;
      notes?: string | null;
    }) => {
      assertSupabase(supabase);

      // Normalizado: solo dígitos (ej. "573183061286"). Usado para insertar y
      // para lookup. También buscamos la variante con "+" por compatibilidad con
      // registros legacy que puedan tener el prefijo.
      const normalizedPhone = input.whatsappPhone.replace(/[^0-9]/g, "");
      const phoneWithPlus = `+${normalizedPhone}`;

      // 1a. Buscar cliente activo sin prefijo "+".
      const { data: foundWithout, error: lookupErr } = await supabase
        .from("clients")
        .select("id")
        .eq("whatsapp_phone", normalizedPhone)
        .is("deleted_at", null)
        .limit(1);
      if (lookupErr) throw mapSupabaseError(lookupErr);

      // 1b. Si no encontró, buscar con prefijo "+" (registros legacy).
      let existingClients = foundWithout;
      if (!existingClients?.length) {
        const { data: foundWith, error: lookupErr2 } = await supabase
          .from("clients")
          .select("id")
          .eq("whatsapp_phone", phoneWithPlus)
          .is("deleted_at", null)
          .limit(1);
        if (lookupErr2) throw mapSupabaseError(lookupErr2);
        existingClients = foundWith;
      }

      let clientId = existingClients?.[0]?.id;

      // 2. Si no existe, crearlo.
      // services y urgency también se escriben en clients para que el trigger
      // tr_on_new_lead_email → smart-api pueda leerlos en el email de bienvenida.
      // La priority en opportunities usa "LON" pero smart-api espera "LONG".
      const clientUrgency =
        input.priority === "LON" ? "LONG" : (input.priority ?? null);
      const clientServices =
        input.services?.length ? input.services.join(", ") : null;

      if (!clientId) {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert([
            {
              name: input.clientName,
              whatsapp_phone: normalizedPhone,
              email: input.email || null,
              address: input.address || null,
              city: input.city || null,
              services: clientServices,
              urgency: clientUrgency,
            },
          ])
          .select("id")
          .single();
        if (clientErr) throw mapSupabaseError(clientErr);
        clientId = newClient.id;
      }

      // 3. Insertar la opportunity (el trigger round-robin asignará el owner).
      const payload: OpportunityInsert = opportunityInsertSchema.parse({
        client_id: clientId,
        status: input.status ?? "new",
        services: input.services,
        priority: input.priority,
        data_origin: input.dataOrigin,
        notes: input.notes ?? null,
        city: input.city ?? null,
        address: input.address ?? null,
      });

      const { data: opp, error: oppErr } = await supabase
        .from("opportunities")
        .insert([payload])
        .select("*")
        .single();
      if (oppErr) throw mapSupabaseError(oppErr);

      return opp as OpportunityRow;
    },
    onSuccess: () => {
      toast.success("Oportunidad creada correctamente");
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error) => notifyError(error, "Error al crear oportunidad"),
  });

  return {
    opportunities: data?.data ?? [],
    isLoading,
    totalCount: data?.count ?? 0,
    refetch,
    archiveOpportunities: async (ids: string[]) =>
      archiveMutation.mutateAsync(ids),
    restoreOpportunities: async (ids: string[]) =>
      restoreMutation.mutateAsync(ids),
    createOpportunity: createOpportunityMutation.mutateAsync,
  };
}

/**
 * Mutación standalone para editar campos de una oportunidad desde el modal de
 * detalle (Servicios, Ciudad, Dirección, Urgencia, Notas).
 *
 * Para transiciones de status usar `useOpportunityTransition` — ese hook valida
 * los estados permitidos y dispara side-effects (notificaciones, history).
 */
export function useUpdateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<OpportunityRow>;
    }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("opportunities")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as OpportunityRow;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", vars.id] });
    },
    onError: (error) => notifyError(error, "Error al actualizar oportunidad"),
  });
}
