import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { AccountingClosure } from "@/types/database";
import { withTimeout } from "@/lib/timeout";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";

export function useClosures(filters?: {
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  return useQuery({
    queryKey: ["closures", filters],
    retry: 0,
    queryFn: async (): Promise<AccountingClosure[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from("accounting_closures")
        .select(
          `
          *,
          project:project_id(id, name),
          closed_user:closed_by(id, full_name)
        `
        )
        .order("closure_date", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.date_from) {
        query = query.gte("closure_date", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("closure_date", filters.date_to);
      }

      const response = (await withTimeout(query as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as AccountingClosure[]) || [];
    },
  });
}
