import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { taskSchema, type TaskInsert } from "@/schemas/task";

/** Update payload — all fields optional except `id` (provided separately). */
type TaskUpdates = Partial<TaskInsert>;

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdates }) => {
      assertSupabase(supabase);

      const validated = taskSchema.partial().parse(updates);

      const { data, error } = await supabase
        .from("tasks")
        .update(validated)
        .eq("id", id)
        .select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error, "Error al actualizar tarea"),
  });
}
