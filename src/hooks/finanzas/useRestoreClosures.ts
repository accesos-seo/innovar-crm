import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { mapSupabaseError } from "@/lib/errors";
import { toast } from "sonner";

export function useRestoreClosures() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("accounting_closures")
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1 ? "Cierre restaurado" : `${ids.length} cierres restaurados`,
        { description: "Los registros volvieron a la lista activa." }
      );
      qc.invalidateQueries({ queryKey: ["closures"] });
    },
    onError: (error: Error) => {
      toast.error("Error al restaurar", { description: error.message });
    },
  });
}
