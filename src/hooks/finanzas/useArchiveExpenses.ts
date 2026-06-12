import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { mapSupabaseError } from "@/lib/errors";
import { toast } from "sonner";

export function useArchiveExpenses() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("expenses")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1 ? "Gasto archivado" : `${ids.length} gastos archivados`,
        { description: "Los registros fueron archivados. Contactá administración para reactivarlos si fue un error." }
      );
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["financial_summary"] });
    },
    onError: (error: Error) => {
      toast.error("Error al archivar", { description: error.message });
    },
  });
}
