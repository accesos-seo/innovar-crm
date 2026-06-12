import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { mapSupabaseError } from "@/lib/errors";
import { toast } from "sonner";

export function useArchiveClosures() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("accounting_closures")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw mapSupabaseError(error);
    },
    onSuccess: (_data, ids) => {
      toast.success(
        ids.length === 1 ? "Cierre archivado" : `${ids.length} cierres archivados`,
        { description: "Los registros fueron archivados. Podés restaurarlos desde la vista de archivados." }
      );
      qc.invalidateQueries({ queryKey: ["closures"] });
    },
    onError: (error: Error) => {
      toast.error("Error al archivar", { description: error.message });
    },
  });
}
