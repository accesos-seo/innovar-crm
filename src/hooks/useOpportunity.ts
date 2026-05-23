import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import type { OpportunityWithClient } from "./useOpportunities";
import type { Database } from "@/types/database.types";

type AssignmentHistoryRow =
  Database["public"]["Tables"]["opportunity_assignment_history"]["Row"];

export interface OpportunityFull extends OpportunityWithClient {
  history: (AssignmentHistoryRow & {
    to_profile: { full_name: string | null; email: string | null } | null;
    from_profile: { full_name: string | null; email: string | null } | null;
  })[];
}

export function useOpportunity(opportunityId: string | null | undefined) {
  return useQuery({
    queryKey: ["opportunity", opportunityId],
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<OpportunityFull | null> => {
      assertSupabase(supabase);
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from("opportunities")
        .select(
          `*,
           client:clients!opportunities_client_id_fkey(id,name,email,whatsapp_phone,address),
           assigned_user:profiles!opportunities_assigned_to_fkey(id,full_name,email,avatar_url),
           history:opportunity_assignment_history(
             *,
             to_profile:profiles!opportunity_assignment_history_to_user_fkey(full_name,email),
             from_profile:profiles!opportunity_assignment_history_from_user_fkey(full_name,email)
           )`,
        )
        .eq("id", opportunityId)
        .single();

      if (error) throw mapSupabaseError(error);
      return data as unknown as OpportunityFull;
    },
  });
}
