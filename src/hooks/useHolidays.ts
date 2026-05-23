import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import {
  holidayInsertSchema,
  holidayUpdateSchema,
  type Holiday,
  type HolidayInsert,
  type HolidayUpdate,
} from "@/schemas/holiday";
import { toast } from "sonner";

export type { Holiday };

export function useHolidays() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["holidays"],
    staleTime: 1000 * 60 * 60, // 1 h — holidays rarely change
    queryFn: async (): Promise<Holiday[]> => {
      assertSupabase(supabase);
      const response = (await (supabase.from("holidays").select("*").order("date", { ascending: true }) as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as Holiday[]) || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newItem: HolidayInsert) => {
      assertSupabase(supabase);
      const validated = holidayInsertSchema.parse(newItem);
      const { data, error } = await supabase
        .from("holidays")
        .insert([validated])
        .select()
        .single();
      if (error) throw mapSupabaseError(error);
      return data as Holiday;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Festivo registrado");
    },
    onError: (error) => notifyError(error, "Error al registrar festivo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      assertSupabase(supabase);
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Festivo eliminado");
    },
    onError: (error) => notifyError(error, "Error al eliminar festivo"),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: HolidayUpdate) => {
      assertSupabase(supabase);
      const { id, ...updates } = holidayUpdateSchema.parse(input);
      const { error } = await supabase.from("holidays").update(updates).eq("id", id);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Festivo actualizado");
    },
    onError: (error) => notifyError(error, "Error al actualizar festivo"),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    isSaving:
      createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
