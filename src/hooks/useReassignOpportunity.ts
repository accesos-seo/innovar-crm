import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError, notifyError } from "@/lib/errors";
import { toast } from "sonner";
import { OPPORTUNITIES_KEY } from "./useOpportunities";

// Reasignar opportunity a otro comercial.
// El trigger `log_opportunity_assignment` (migración 010) registra la
// transición en `opportunity_assignment_history` automáticamente.
export function useReassignOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      opportunityId: string;
      newAssigneeId: string;
      reason?: string | null;
    }) => {
      assertSupabase(supabase);

      const { data, error } = await supabase
        .from("opportunities")
        .update({
          assigned_to: input.newAssigneeId,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", input.opportunityId)
        .select("id,assigned_to")
        .single();
      if (error) throw mapSupabaseError(error);

      // Si el trigger no captura un `reason` (es un campo manual),
      // lo registramos en el history record más reciente para esta opp.
      if (input.reason) {
        const { data: lastHist } = await supabase
          .from("opportunity_assignment_history")
          .select("id")
          .eq("opportunity_id", input.opportunityId)
          .eq("to_user", input.newAssigneeId)
          .order("changed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastHist?.id) {
          const { error: histErr } = await supabase
            .from("opportunity_assignment_history")
            .update({ reason: input.reason })
            .eq("id", lastHist.id);
          if (histErr) {
            // No fallar la mutación principal si esto falla — el reassign ya pasó.
            console.warn(
              "No se pudo guardar el motivo de reasignación:",
              histErr,
            );
          }
        }
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success("Oportunidad reasignada");
      queryClient.invalidateQueries({ queryKey: [OPPORTUNITIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", data.id] });
    },
    onError: (error) => notifyError(error, "Error al reasignar"),
  });
}
