import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { assertSupabase, mapSupabaseError, notifyError, AppError } from "@/lib/errors";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type ClosurePeriodStatus = "borrador" | "confirmado" | "revertido";

export interface ClosurePeriod {
  id: string;
  period_start: string | null;
  period_end: string;
  status: ClosurePeriodStatus;
  created_by: string | null;
  confirmed_at: string | null;
  total_projects_profit: number;
  total_bodega_expenses: number;
  net_profit: number;
  notes: string | null;
  reverted_at: string | null;
  reverted_by: string | null;
  reverted_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClosurePeriodProject {
  id: string;
  period_id: string;
  project_id: string;
  project_name: string;
  quoted_value: number;
  total_paid: number;
  balance_due: number;
  project_expenses: number;
  profit: number;
  margin_pct: number;
}

export interface ClosurePeriodExpense {
  id: string;
  period_id: string;
  expense_id: string | null;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string | null;
}

export interface ClosureAuditEntry {
  id: string;
  period_id: string | null;
  action: string;
  performed_by: string | null;
  performed_at: string;
  previous_status: string | null;
  projects_count: number | null;
  reason: string | null;
}

export interface ClosurePeriodDetail {
  period: ClosurePeriod;
  projects: ClosurePeriodProject[];
  expenses: ClosurePeriodExpense[];
  audit: ClosureAuditEntry[];
}

const PERIODS_KEY = "closure_periods";

// ── Listar cierres de período ─────────────────────────────────────────────────
export function useClosurePeriods() {
  return useQuery({
    queryKey: [PERIODS_KEY],
    queryFn: async (): Promise<ClosurePeriod[]> => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("accounting_closure_periods")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw mapSupabaseError(error);
      return (data as ClosurePeriod[]) || [];
    },
  });
}

// ── Detalle de un cierre (período + snapshots + auditoría) ─────────────────────
export function useClosurePeriodDetail(periodId: string | null) {
  return useQuery({
    queryKey: [PERIODS_KEY, periodId],
    enabled: !!periodId,
    queryFn: async (): Promise<ClosurePeriodDetail | null> => {
      if (!periodId) return null;
      assertSupabase(supabase);

      const [periodRes, projectsRes, expensesRes, auditRes] = await Promise.all([
        supabase.from("accounting_closure_periods").select("*").eq("id", periodId).single(),
        supabase
          .from("accounting_closure_period_projects")
          .select("*")
          .eq("period_id", periodId)
          .order("profit", { ascending: true }),
        supabase
          .from("accounting_closure_period_expenses")
          .select("*")
          .eq("period_id", periodId)
          .order("expense_date", { ascending: true }),
        supabase
          .from("closure_audit_log")
          .select("*")
          .eq("period_id", periodId)
          .order("performed_at", { ascending: false }),
      ]);

      if (periodRes.error) throw mapSupabaseError(periodRes.error);
      if (projectsRes.error) throw mapSupabaseError(projectsRes.error);
      if (expensesRes.error) throw mapSupabaseError(expensesRes.error);
      if (auditRes.error) throw mapSupabaseError(auditRes.error);

      return {
        period: periodRes.data as ClosurePeriod,
        projects: (projectsRes.data as ClosurePeriodProject[]) || [],
        expenses: (expensesRes.data as ClosurePeriodExpense[]) || [],
        audit: (auditRes.data as ClosureAuditEntry[]) || [],
      };
    },
  });
}

// ── Helper: desempaqueta la respuesta jsonb de las RPC ────────────────────────
function unwrapRpc(data: any): any {
  if (data && data.success === false) {
    throw new AppError(String(data.error || "RPC_ERROR"), data.message || "Operación rechazada.");
  }
  return data;
}

// ── Crear cierre de período (borrador) ────────────────────────────────────────
export function useCreateClosurePeriod() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: async ({
      period_end,
      project_ids,
      notes,
    }: {
      period_end: string;
      project_ids: string[];
      notes?: string;
    }) => {
      assertSupabase(supabase);
      if (!user) throw new AppError("AUTH_REQUIRED", "Debes iniciar sesión.");

      const { data, error } = await supabase.rpc("create_closure_period", {
        p_period_end: period_end,
        p_project_ids: project_ids,
        p_notes: notes || null,
      });
      if (error) throw mapSupabaseError(error);
      return unwrapRpc(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PERIODS_KEY] });
    },
    onError: (error) => notifyError(error, "Error al crear el cierre de período"),
  });
}

// ── Confirmar cierre (borrador → confirmado) ──────────────────────────────────
export function useConfirmClosurePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (periodId: string) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc("confirm_closure_period", {
        p_period_id: periodId,
      });
      if (error) throw mapSupabaseError(error);
      return unwrapRpc(data);
    },
    onSuccess: (_data, periodId) => {
      queryClient.invalidateQueries({ queryKey: [PERIODS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PERIODS_KEY, periodId] });
    },
    onError: (error) => notifyError(error, "Error al confirmar el cierre"),
  });
}

// ── Revertir cierre confirmado (solo CEO, motivo >= 10 chars) ─────────────────
export function useRevertClosurePeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodId, reason }: { periodId: string; reason: string }) => {
      assertSupabase(supabase);
      const { data, error } = await supabase.rpc("revert_closure_period", {
        p_period_id: periodId,
        p_reason: reason,
      });
      if (error) throw mapSupabaseError(error);
      return unwrapRpc(data);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [PERIODS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PERIODS_KEY, vars.periodId] });
    },
    onError: (error) => notifyError(error, "Error al revertir el cierre"),
  });
}
