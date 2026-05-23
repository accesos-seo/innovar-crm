import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Expense } from "@/types/database";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";

export function useExpenses(
  filters?: {
    category?: string;
    approval_status?: string;
    project_id?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
  },
  pagination?: { pageIndex: number; pageSize: number }
) {
  return useQuery({
    queryKey: ["expenses", filters, pagination],
    queryFn: async (): Promise<{ data: Expense[]; count: number }> => {
      assertSupabase(supabase);

      let query = supabase
        .from("expenses")
        .select(
          `
          *,
          projects:project_id(id, name),
          register_user:registered_by(id, full_name),
          approve_user:approved_by(id, full_name)
        `,
          { count: "exact" }
        )
        .order("expense_date", { ascending: false });

      if (filters?.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
      }
      if (filters?.approval_status && filters.approval_status !== "all") {
        query = query.eq("approval_status", filters.approval_status);
      }
      if (filters?.project_id && filters.project_id !== "all") {
        query = query.eq("project_id", filters.project_id);
      }
      if (filters?.date_from) {
        query = query.gte("expense_date", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("expense_date", filters.date_to);
      }
      if (filters?.search) {
        query = query.ilike("description", `%${filters.search}%`);
      }

      if (pagination) {
        const { pageIndex, pageSize } = pagination;
        query = query.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);
      }

      const response = (await query) as any;
      const { data, error, count } = response;
      if (error) throw mapSupabaseError(error);
      return { data: (data as Expense[]) || [], count: count || 0 };
    },
  });
}
