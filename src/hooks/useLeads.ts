import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/timeout";
import { Client as Lead } from "@/types/database";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { clientSchema, type ClientInsert } from "@/schemas/client";
import { toast } from "sonner";

const LEADS_KEY = "leads";

export function useLeads(
  searchTerm: string = "",
  pagination?: { pageIndex: number; pageSize: number }
) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [LEADS_KEY, searchTerm, pagination],
    staleTime: 1000 * 60 * 5,
    retry: 0,
    queryFn: async () => {
      assertSupabase(supabase);

      let query = supabase.from("clients").select("*", { count: "exact" });

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

      const response = (await withTimeout(ordered)) as any;
      const { data, error, count } = response;

      if (error) throw mapSupabaseError(error);

      return { data: (data || []) as Lead[], count: count || 0 };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      toast.success("Solicitudes eliminadas correctamente");
      queryClient.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al eliminar solicitudes"),
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
    deleteLeads: async (ids: string[]) => deleteMutation.mutateAsync(ids),
    createLead: async (leadData: Partial<ClientInsert>) => createMutation.mutateAsync(leadData),
  };
}
