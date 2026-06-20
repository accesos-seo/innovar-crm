import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { useProjects } from "@/hooks/useProjects";
import {
  useCreateClosurePeriod,
  useConfirmClosurePeriod,
} from "@/hooks/finanzas/useClosurePeriods";
import { notify } from "@/components/ui/PremiumToast";
import { formatSentenceCase, formatCurrency } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Layers,
  CheckCircle2,
  CalendarRange,
  FolderCheck,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";

interface NewClosurePeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftResult {
  period_id: string;
  projects_count: number;
  total_projects_profit: number;
  total_bodega_expenses: number;
  net_profit: number;
  period_start: string | null;
  period_end: string;
}

export function NewClosurePeriodModal({ isOpen, onClose }: NewClosurePeriodModalProps) {
  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  const createPeriod = useCreateClosurePeriod();
  const confirmPeriod = useConfirmClosurePeriod();

  const [periodEnd, setPeriodEnd] = React.useState<Date | undefined>(new Date());
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [draft, setDraft] = React.useState<DraftResult | null>(null);

  // Proyectos elegibles: entregados/completados + 100% pagados (el RPC re-valida en el servidor)
  const eligible = React.useMemo(
    () =>
      projects.filter(
        (p: any) =>
          (p.status === "entregado" || p.status === "completado") && p.is_fully_paid === true
      ),
    [projects]
  );

  const resetForm = React.useCallback(() => {
    setPeriodEnd(new Date());
    setSelectedIds([]);
    setNotes("");
    setDraft(null);
  }, []);

  React.useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen, resetForm]);

  const allSelected = eligible.length > 0 && selectedIds.length === eligible.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : eligible.map((p: any) => p.id));
  const toggleOne = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodEnd) {
      notify.error("Error", "Selecciona la fecha de corte del período.");
      return;
    }
    if (selectedIds.length === 0) {
      notify.error("Error", "Selecciona al menos un proyecto.");
      return;
    }
    try {
      const result = (await createPeriod.mutateAsync({
        period_end: format(periodEnd, "yyyy-MM-dd"),
        project_ids: selectedIds,
        notes: notes || undefined,
      })) as DraftResult;
      setDraft(result);
    } catch {
      /* notifyError ya lo maneja en el hook */
    }
  };

  const handleConfirm = async () => {
    if (!draft) return;
    try {
      await confirmPeriod.mutateAsync(draft.period_id);
      notify.success(
        formatSentenceCase("Cierre de período confirmado"),
        formatSentenceCase("La utilidad neta del período quedó registrada.")
      );
      onClose();
    } catch {
      /* manejado en el hook */
    }
  };

  const handleKeepDraft = () => {
    notify.info(
      formatSentenceCase("Borrador guardado"),
      formatSentenceCase("Podés confirmarlo más tarde desde el detalle del cierre.")
    );
    onClose();
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase(draft ? "CONFIRMAR CIERRE DE PERÍODO" : "NUEVO CIERRE DE PERÍODO")}
      icon={Layers}
      subtitle={formatSentenceCase("FINANZAS > CIERRE DE PERÍODO")}
      footer={
        draft ? (
          <div className="flex gap-4 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handleKeepDraft}
              disabled={confirmPeriod.isPending}
              className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/50 transition-all"
            >
              {formatSentenceCase("Dejar en borrador")}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmPeriod.isPending}
              className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
            >
              {confirmPeriod.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              {formatSentenceCase(confirmPeriod.isPending ? "Confirmando..." : "Confirmar cierre")}
            </Button>
          </div>
        ) : (
          <div className="flex gap-4 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/50 transition-all"
            >
              {formatSentenceCase("Cancelar")}
            </Button>
            <Button
              type="submit"
              form="new-period-form"
              disabled={createPeriod.isPending || selectedIds.length === 0}
              className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
            >
              {createPeriod.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Layers className="w-4 h-4 mr-2" />
              )}
              {formatSentenceCase(createPeriod.isPending ? "Generando..." : "Generar borrador")}
            </Button>
          </div>
        )
      }
    >
      {draft ? (
        // ── PASO 2: previsualización del borrador ──────────────────────────────
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <FolderCheck className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">
              {formatSentenceCase("RESUMEN DEL PERÍODO")}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border/10 border border-border/10 overflow-hidden">
            <div className="bg-muted/5 p-4 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">
                Proyectos incluidos
              </p>
              <p className="text-lg font-black text-foreground tabular-nums">{draft.projects_count}</p>
            </div>
            <div className="bg-muted/5 p-4 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">
                Corte
              </p>
              <p className="text-sm font-black text-foreground tabular-nums">
                {draft.period_start ? `${draft.period_start} →` : "Desde el inicio →"} {draft.period_end}
              </p>
            </div>
            <div className="bg-muted/5 p-4 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">
                Utilidad de proyectos
              </p>
              <p className="text-base font-black text-foreground tabular-nums">
                {formatCurrency(draft.total_projects_profit)}
              </p>
            </div>
            <div className="bg-muted/5 p-4 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">
                Gastos de bodega
              </p>
              <p className="text-base font-black text-destructive tabular-nums">
                − {formatCurrency(draft.total_bodega_expenses)}
              </p>
            </div>
            <div
              className={cn(
                "p-4 col-span-2 flex justify-between items-center border-t",
                draft.net_profit >= 0
                  ? "bg-primary/5 border-primary/20"
                  : "bg-destructive/5 border-destructive/20"
              )}
            >
              <div className="flex items-center gap-2">
                {draft.net_profit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-primary" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-destructive" />
                )}
                <p
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest",
                    draft.net_profit >= 0 ? "text-primary" : "text-destructive"
                  )}
                >
                  Utilidad neta del período
                </p>
              </div>
              <p
                className={cn(
                  "text-2xl font-black tabular-nums",
                  draft.net_profit >= 0 ? "text-primary" : "text-destructive"
                )}
              >
                {formatCurrency(draft.net_profit)}
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] font-bold text-amber-600/90 uppercase tracking-widest leading-relaxed italic">
              {formatSentenceCase(
                "Se guardó como borrador. Al confirmar, el período queda cerrado y los gastos de bodega de este corte ya no entrarán en el siguiente cierre."
              )}
            </p>
          </div>
        </div>
      ) : (
        // ── PASO 1: selección ──────────────────────────────────────────────────
        <form id="new-period-form" onSubmit={handleGenerate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                <CalendarRange className="w-3 h-3" /> {formatSentenceCase("Fecha de corte")}{" "}
                <span className="text-primary">*</span>
              </label>
              <CalendarPopover
                selected={periodEnd}
                onSelect={setPeriodEnd}
                className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full"
              />
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                {formatSentenceCase(
                  "Los gastos de bodega se toman desde el último cierre confirmado hasta esta fecha."
                )}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Notas")}
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={formatSentenceCase("Observaciones del cierre (opcional)")}
                className="bg-background border-border/50 min-h-[88px] rounded-none focus-visible:ring-primary font-medium resize-none p-4"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                {formatSentenceCase("Proyectos elegibles")}{" "}
                <span className="text-muted-foreground/50">
                  ({selectedIds.length}/{eligible.length})
                </span>
              </label>
              {eligible.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  {allSelected ? formatSentenceCase("Quitar todos") : formatSentenceCase("Seleccionar todos")}
                </button>
              )}
            </div>

            {eligible.length === 0 ? (
              <div className="bg-muted/5 p-6 border border-border/10 text-center">
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] italic">
                  {formatSentenceCase("No hay proyectos entregados y 100% pagados disponibles.")}
                </p>
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto border border-border/10 divide-y divide-border/10">
                {eligible.map((p: any) => {
                  const checked = selectedIds.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggleOne(p.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 p-4 text-left transition-all",
                        checked ? "bg-primary/5" : "hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "w-5 h-5 shrink-0 border flex items-center justify-center transition-all",
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border/50"
                          )}
                        >
                          {checked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-sm font-bold text-foreground truncate">{p.name}</span>
                      </div>
                      <span className="text-xs font-black text-muted-foreground tabular-nums shrink-0">
                        {formatCurrency(p.total_amount || 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      )}
    </DetailModal>
  );
}
