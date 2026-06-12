import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { mapSupabaseError } from "@/lib/errors";
import { toast } from "sonner";

export function useRestoreExpenses() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: null })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1 ? "Gasto restaurado" : `${ids.length} gastos restaurados`,
        { description: "Los registros volvieron a la lista activa." }
      );
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["financial_summary"] });
    },
    onError: (error: Error) => {
      toast.error("Error al restaurar", { description: error.message });
    },
  });
}
