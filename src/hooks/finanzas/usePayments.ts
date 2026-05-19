import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Payment } from "@/types/database";
import { withTimeout } from "@/lib/timeout";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";

export function usePayments(filters?: {
  project_id?: string;
  payment_method?: string;
  payment_type?: string;
  date_from?: string;
  date_to?: string;
}) {
  return useQuery({
    queryKey: ["payments", filters],
    queryFn: async (): Promise<Payment[]> => {
      assertSupabase(supabase);

      let query = supabase
        .from("payments")
        .select(
          `
          *,
          projects:project_id(id, name),
          clients:client_id(id, name),
          profiles:registered_by(id, full_name)
        `
        )
        .order("received_at", { ascending: false });

      if (filters?.project_id && filters.project_id !== "all") {
        query = query.eq("project_id", filters.project_id);
      }
      if (filters?.payment_method && filters.payment_method !== "all") {
        query = query.eq("payment_method", filters.payment_method);
      }
      if (filters?.payment_type && filters.payment_type !== "all") {
        query = query.eq("payment_type", filters.payment_type);
      }
      if (filters?.date_from) {
        query = query.gte("received_at", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("received_at", filters.date_to);
      }

      const response = (await withTimeout(query as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (data as Payment[]) || [];
    },
  });
}
