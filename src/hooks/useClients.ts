import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/timeout";
import { Client } from "@/types/database";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { toast } from "sonner";

const CLIENTS_KEY = "clients";

export function useClients(
  searchTerm: string = "",
  pagination?: { pageIndex: number; pageSize: number }
) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: [CLIENTS_KEY, searchTerm, pagination],
    staleTime: 1000 * 60 * 5,
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

      return { data: (data || []) as Client[], count: count || 0 };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      assertSupabase(supabase);
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      toast.success("Clientes eliminados correctamente");
      queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al eliminar clientes"),
  });

  return {
    clients: data?.data || [],
    isLoading,
    totalCount: data?.count || 0,
    refetch,
    deleteClients: async (ids: string[]) => deleteMutation.mutateAsync(ids),
  };
}
