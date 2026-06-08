import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { notifyError } from "@/lib/errors";
import { notify } from "@/components/ui/PremiumToast";
import {
  deleteLog as apiDeleteLog,
  fetchContract,
  fetchLogs,
  insertLog as apiInsertLog,
  updateLog as apiUpdateLog,
} from "@/lib/horasApi";
import {
  addMonths,
  anchorDayOf,
  buildMonthSummary,
  currentAccumulatedBalance,
  periodLabel,
  periodStartOfDate,
} from "@/lib/horas/calc";
import type { WorkLog, WorkLogInput } from "@/lib/horas/types";

/** UUID del contrato Innovar — corresponde al registro seedeado en work_contracts. */
export const BRAND_ID = "a0000001-0000-4000-a000-000000000001";

/** Roles con permiso de escritura. Todos los demás ven en solo lectura. */
const STAFF_ROLES = new Set(["admin", "super_admin"]);

const pad = (n: number) => String(n).padStart(2, "0");

export function useHoras(offset: number) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.profile?.role);
  const isReadOnly = !role || !STAFF_ROLES.has(role);

  const logsQuery = useQuery({
    queryKey: ["horas", "logs", BRAND_ID],
    queryFn: () => fetchLogs(BRAND_ID),
    staleTime: 1000 * 60 * 5,
  });

  const contractQuery = useQuery({
    queryKey: ["horas", "contract", BRAND_ID],
    queryFn: () => fetchContract(BRAND_ID),
    staleTime: 1000 * 60 * 30,
  });

  const logs = logsQuery.data ?? [];
  const contract = contractQuery.data ?? null;

  const todayStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  }, []);

  const view = useMemo(() => {
    if (!contract) return null;
    const aday = anchorDayOf(contract);
    const current = periodStartOfDate(todayStr, aday);
    const sel = addMonths(current.year, current.month, offset);
    return {
      aday,
      year: sel.year,
      month: sel.month,
      label: periodLabel(sel.year, sel.month, aday),
      canGoNext: offset < 0,
      summary: buildMonthSummary(logs, contract, sel.year, sel.month),
      accumulated: currentAccumulatedBalance(logs, contract, todayStr),
    };
  }, [logs, contract, offset, todayStr]);

  const monthLogs = useMemo(() => {
    if (!view) return [];
    return logs
      .filter((l) => {
        const p = periodStartOfDate(l.work_date, view.aday);
        return p.year === view.year && p.month === view.month;
      })
      .sort((a, b) => a.work_date.localeCompare(b.work_date));
  }, [logs, view]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["horas", "logs", BRAND_ID] });

  const addLog = useMutation({
    mutationFn: (input: WorkLogInput) => apiInsertLog(BRAND_ID, input),
    retry: 0,
    onSuccess: (row: WorkLog) => {
      invalidate();
      notify.success("Día registrado", row.work_date);
    },
    onError: (e) => notifyError(e, "No se pudo registrar el día"),
  });

  const updateLog = useMutation({
    mutationFn: ({ id, input }: { id: string; input: WorkLogInput }) => apiUpdateLog(id, BRAND_ID, input),
    retry: 0,
    onSuccess: (row: WorkLog) => {
      invalidate();
      notify.success("Día actualizado", row.work_date);
    },
    onError: (e) => notifyError(e, "No se pudo actualizar el día"),
  });

  const deleteLog = useMutation({
    mutationFn: (id: string) => apiDeleteLog(id),
    retry: 0,
    onSuccess: () => {
      invalidate();
      notify.success("Día eliminado", "");
    },
    onError: (e) => notifyError(e, "No se pudo eliminar el día"),
  });

  return {
    isLoading: logsQuery.isLoading || contractQuery.isLoading,
    isError: logsQuery.isError || contractQuery.isError,
    hasContract: !!contract,
    periodLabel: view?.label ?? "",
    canGoNext: view?.canGoNext ?? false,
    monthLogs,
    summary: view?.summary ?? null,
    accumulatedMinutes: view?.accumulated ?? 0,
    isReadOnly,
    addLog,
    updateLog,
    deleteLog,
  };
}
