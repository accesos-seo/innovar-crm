import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";
import { taskInsertSchema, type TaskInsert } from "@/schemas/task";

export function useCreateTask() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async (taskData: TaskInsert) => {
      assertSupabase(supabase);
      if (!user) {
        throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión para crear tareas.");
      }

      const validated = taskInsertSchema.parse(taskData);

      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...validated, created_by: user.id })
        .select();

      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error) => notifyError(error, "Error al crear tarea"),
  });
}
