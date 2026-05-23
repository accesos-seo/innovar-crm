import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import {
  pricingInsertSchema,
  pricingUpdateSchema,
  type PricingItem,
  type PricingInsert,
  type PricingUpdate,
} from "@/schemas/pricing";
import { toast } from "sonner";

export type { PricingItem };

export function usePricing() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pricing"],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async (): Promise<PricingItem[]> => {
      assertSupabase(supabase);
      const response = (await (supabase
        .from("pricing_catalog")
        .select("*")
        .order("category", { ascending: true }) as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as PricingItem[]) || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newItem: PricingInsert) => {
      assertSupabase(supabase);
      const validated = pricingInsertSchema.parse({
        ...newItem,
        lastUpdated: new Date().toISOString().split("T")[0],
      });
      const { data, error } = await supabase
        .from("pricing_catalog")
        .insert([validated])
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as PricingItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      toast.success("Precio registrado correctamente");
    },
    onError: (error) => notifyError(error, "Error al registrar precio"),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: PricingUpdate) => {
      assertSupabase(supabase);
      const { id, ...updates } = pricingUpdateSchema.parse(input);
      const { error } = await supabase
        .from("pricing_catalog")
        .update(updates)
        .eq("id", id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing"] });
      toast.success("Tarifario actualizado");
    },
    onError: (error) => notifyError(error, "Error al actualizar precio"),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
