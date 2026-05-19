import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { withTimeout } from "@/lib/timeout";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";

export interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  net_profit: number;
  pending_balance: number;
}

export function useFinancialSummary(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ["financial_summary", dateFrom, dateTo],
    queryFn: async (): Promise<FinancialSummary> => {
      assertSupabase(supabase);

      const query = supabase.rpc("get_financial_summary", {
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });

      const response = (await withTimeout(query as any)) as any;
      const { data, error } = response;
      if (error) throw mapSupabaseError(error);
      return (
        data || {
          total_income: 0,
          total_expenses: 0,
          net_profit: 0,
          pending_balance: 0,
        }
      );
    },
  });
}
