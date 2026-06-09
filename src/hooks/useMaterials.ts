import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import {
  materialInsertSchema,
  materialUpdateSchema,
  type MaterialInsert,
  type MaterialUpdate,
} from "@/schemas/material";
import { toast } from "sonner";

/**
 * @deprecated Use `MaterialInsert` from `@/schemas/material` instead.
 * Kept for backwards compatibility with existing consumers.
 */
export interface HardwareItem {
  id: string;
  category: "cocinas" | "closets" | "puertas" | "herrajes" | "accesorios" | "otros";
  name: string;
  description: string;
  photoUrl: string;
  price: number;
  unit: string;
  active: boolean;
  sortOrder: number;
  brand?: string | null;
  stock?: number;
}

export function useMaterials() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["materials"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<HardwareItem[]> => {
      assertSupabase(supabase);
      const response = (await (supabase.from("materials").select("*").order("name", { ascending: true }) as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as HardwareItem[]) || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newItem: MaterialInsert) => {
      assertSupabase(supabase);
      const validated = materialInsertSchema.parse(newItem);
      const { data, error } = await supabase
        .from("materials")
        .insert([validated])
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as HardwareItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material registrado correctamente");
    },
    onError: (error) => notifyError(error, "Error al registrar material"),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: MaterialUpdate) => {
      assertSupabase(supabase);
      const { id, ...updates } = materialUpdateSchema.parse(input);
      const { error } = await supabase.from("materials").update(updates).eq("id", id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material actualizado");
    },
    onError: (error) => notifyError(error, "Error al actualizar material"),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending,
  };
}
