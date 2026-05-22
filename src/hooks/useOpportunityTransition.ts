import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { toast } from "sonner";
import {
  opportunityStatusEnum,
  type OpportunityStatus,
} from "@/schemas/opportunity";
import { OPPORTUNITIES_KEY } from "./useOpportunities";

// Transición de status para una opportunity.
// El CHECK del schema valida los valores; el trigger de migración 010
// (validate_opportunity_status_transition) puede rechazar saltos no permitidos.
export function useOpportunityTransition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      opportunityId: string;
      newStatus: OpportunityStatus;
      lostReason?: string | null;
    }) => {
      assertSupabase(supabase);
      const status = opportunityStatusEnum.parse(input.newStatus);

      const patch: Record<string, unknown> = {
        status,
        last_activity_at: new Date().toISOString(),
      };
      if (status === "lost") {
        patch.lost_reason = input.lostReason ?? null;
        patch.lost_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("opportunities")
        .update(patch)
        .eq("id", input.opportunityId)
        .select("id,status,lost_reason,lost_at,last_activity_at")
        .single();
      if (error) throw mapSupabaseError(error);
      return data;
    },
    onSuccess: (data) => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", data.id] });
    },
    onError: (error) => notifyError(error, "Error al cambiar el estado"),
  });
}
