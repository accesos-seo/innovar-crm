import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Layers,
  FileDown,
  FileText,
  CheckCircle2,
  RotateCcw,
  ShieldAlert,
  Loader2,
  TrendingDown,
} from "lucide-react";
import { formatSentenceCase, formatCurrency } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import {
  useClosurePeriodDetail,
  useConfirmClosurePeriod,
  useRevertClosurePeriod,
} from "@/hooks/finanzas/useClosurePeriods";
import { generateEjecutivoPdf, generateAnexoPdf } from "@/hooks/finanzas/useClosurePeriodPdf";
import { notify } from "@/components/ui/PremiumToast";

interface ClosurePeriodDetailPanelProps {
  periodId: string | null;
  isOpen: boolean;
  onClose: () => void;
  canManage: boolean; // super_admin (CEO)
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  borrador: { label: "Borrador", variant: "secondary" },
  confirmado: { label: "Confirmado", variant: "default" },
  revertido: { label: "Revertido", variant: "destructive" },
};

export function ClosurePeriodDetailPanel({
  periodId,
  isOpen,
  onClose,
  canManage,
}: ClosurePeriodDetailPanelProps) {
  const { data: detail, isLoading } = useClosurePeriodDetail(periodId);
  const confirmPeriod = useConfirmClosurePeriod();
  const revertPeriod = useRevertClosurePeriod();

  const [revertMode, setRevertMode] = React.useState(false);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) { setRevertMode(false); setReason(""); }
  }, [isOpen]);

  if (!periodId) return null;

  const period = detail?.period;
  const statusMeta = period ? STATUS_META[period.status] ?? STATUS_META.borrador : STATUS_META.borrador;

  const handleConfirm = async () => {
    if (!period) return;
    try {
      await confirmPeriod.mutateAsync(period.id);
      notify.success(formatSentenceCase("Cierre confirmado"), formatSentenceCase("El período quedó cerrado."));
    } catch { /* hook maneja el error */ }
  };

  const handleRevert = async () => {
    if (!period) return;
    if (reason.trim().length < 10) {
      notify.error("Error", "El motivo debe tener al menos 10 caracteres.");
      return;
    }
    try {
      await revertPeriod.mutateAsync({ periodId: period.id, reason: reason.trim() });
      notify.success(formatSentenceCase("Cierre revertido"), formatSentenceCase("Quedó registrado en la auditoría."));
      setRevertMode(false);
      setReason("");
    } catch { /* hook maneja el error */ }
  };

  const downloadPdf = async (kind: "ejecutivo" | "anexo") => {
    if (!detail) return;
    try {
      if (kind === "ejecutivo") await generateEjecutivoPdf(detail);
      else await generateAnexoPdf(detail);
    } catch {
      notify.error("Error", "No se pudo generar el PDF.");
    }
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("Cierre de período")}
      icon={Layers}
      subtitle={period ? formatSentenceCase(`FINANZAS > CIERRE > ${period.id.slice(0, 8)}`) : "FINANZAS > CIERRE"}
      status={{ label: formatSentenceCase(statusMeta.label), variant: statusMeta.variant }}
      footer={
        <div className="flex flex-wrap gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1 min-w-[120px] border-border/30 h-12 rounded-none font-black text-[10px] tracking-widest uppercase"
            onClick={() => downloadPdf("ejecutivo")}
            disabled={!detail}
          >
            <FileDown className="w-4 h-4 mr-2" />
            {formatSentenceCase("Reporte ejecutivo")}
          </Button>
          <Button
            variant="outline"
            className="flex-1 min-w-[120px] border-border/30 h-12 rounded-none font-black text-[10px] tracking-widest uppercase"
            onClick={() => downloadPdf("anexo")}
            disabled={!detail}
          >
            <FileText className="w-4 h-4 mr-2" />
            {formatSentenceCase("Anexo de gastos")}
          </Button>
          {canManage && period?.status === "borrador" && (
            <Button
              className="flex-1 min-w-[120px] bg-primary text-primary-foreground h-12 rounded-none font-black text-[10px] tracking-widest uppercase"
              onClick={handleConfirm}
              disabled={confirmPeriod.isPending}
            >
              {confirmPeriod.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              {formatSentenceCase("Confirmar")}
            </Button>
          )}
          {canManage && period?.status === "confirmado" && !revertMode && (
            <Button
              variant="outline"
              className="flex-1 min-w-[120px] border-destructive/40 text-destructive h-12 rounded-none font-black text-[10px] tracking-widest uppercase hover:bg-destructive/5"
              onClick={() => setRevertMode(true)}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              {formatSentenceCase("Revertir")}
            </Button>
          )}
        </div>
      }
    >
      {isLoading || !detail ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-muted/20" />
          <div className="h-40 bg-muted/20" />
        </div>
      ) : (
        <div className="flex flex-col space-y-8">
          {/* Reversión: motivo */}
          {revertMode && (
            <div className="space-y-3 bg-destructive/5 border border-destructive/20 p-5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                <h3 className="text-xs font-black text-destructive uppercase tracking-widest">
                  {formatSentenceCase("Revertir cierre confirmado")}
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {formatSentenceCase(
                  "Los gastos tardíos NO reabren este cierre: entran en el período siguiente. Indicá el motivo (mínimo 10 caracteres)."
                )}
              </p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={formatSentenceCase("Motivo de la reversión")}
                className="bg-background border-border/50 min-h-[80px] rounded-none focus-visible:ring-destructive font-medium resize-none p-3"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-none border-border/30 text-[10px] font-black uppercase tracking-widest"
                  onClick={() => { setRevertMode(false); setReason(""); }}
                  disabled={revertPeriod.isPending}
                >
                  {formatSentenceCase("Cancelar")}
                </Button>
                <Button
                  className="flex-1 h-11 rounded-none bg-destructive text-white text-[10px] font-black uppercase tracking-widest hover:bg-destructive/90"
                  onClick={handleRevert}
                  disabled={revertPeriod.isPending || reason.trim().length < 10}
                >
                  {revertPeriod.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                  {formatSentenceCase("Confirmar reversión")}
                </Button>
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="grid grid-cols-3 gap-px bg-border/10 border border-border/10 overflow-hidden">
            <div className="bg-muted/5 p-5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">Utilidad proyectos</p>
              <p className="text-base font-black text-foreground tabular-nums">{formatCurrency(period!.total_projects_profit)}</p>
            </div>
            <div className="bg-muted/5 p-5 space-y-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">Gastos bodega</p>
              <p className="text-base font-black text-destructive tabular-nums">− {formatCurrency(period!.total_bodega_expenses)}</p>
            </div>
            <div className={cn("p-5 space-y-1", period!.net_profit >= 0 ? "bg-primary/5" : "bg-destructive/5")}>
              <p className={cn("text-[8px] font-black uppercase tracking-widest", period!.net_profit >= 0 ? "text-primary" : "text-destructive")}>Utilidad neta</p>
              <p className={cn("text-base font-black tabular-nums", period!.net_profit >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(period!.net_profit)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <span>{formatSentenceCase(`Corte: ${period!.period_start ?? "inicio"} → ${period!.period_end}`)}</span>
            <span>{detail.projects.length} {formatSentenceCase("proyectos")}</span>
          </div>

          {/* Proyectos incluidos */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest">{formatSentenceCase("Proyectos del cierre")}</h3>
            </div>
            <div className="border border-border/10 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/10 text-muted-foreground/70 text-[9px] uppercase tracking-widest">
                    <th className="text-left p-3 font-black">Proyecto</th>
                    <th className="text-right p-3 font-black">Cotizado</th>
                    <th className="text-right p-3 font-black">Cobrado</th>
                    <th className="text-right p-3 font-black">Gastos</th>
                    <th className="text-right p-3 font-black">Utilidad</th>
                    <th className="text-right p-3 font-black">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {detail.projects.map((p) => {
                    const loss = p.profit < 0;
                    return (
                      <tr key={p.id} className={cn("tabular-nums", loss && "bg-destructive/5")}>
                        <td className={cn("text-left p-3 font-bold", loss ? "text-destructive" : "text-foreground")}>
                          {loss && <TrendingDown className="w-3 h-3 inline mr-1" />}
                          {p.project_name}
                        </td>
                        <td className="text-right p-3 text-muted-foreground">{formatCurrency(p.quoted_value)}</td>
                        <td className="text-right p-3 text-muted-foreground">{formatCurrency(p.total_paid)}</td>
                        <td className="text-right p-3 text-muted-foreground">{formatCurrency(p.project_expenses)}</td>
                        <td className={cn("text-right p-3 font-black", loss ? "text-destructive" : "text-foreground")}>{formatCurrency(p.profit)}</td>
                        <td className={cn("text-right p-3 font-bold", loss ? "text-destructive" : "text-muted-foreground")}>{(p.margin_pct || 0).toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gastos de bodega */}
          {detail.expenses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest">{formatSentenceCase("Gastos de bodega del período")}</h3>
              </div>
              <div className="border border-border/10 divide-y divide-border/10">
                {detail.expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 text-[11px]">
                    <div className="min-w-0">
                      <span className="font-bold text-foreground capitalize">{e.category.replace(/_/g, " ")}</span>
                      {e.description && <span className="text-muted-foreground/60 ml-2 truncate">· {e.description}</span>}
                    </div>
                    <span className="font-black text-destructive tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auditoría */}
          {detail.audit.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground uppercase tracking-widest">{formatSentenceCase("Auditoría")}</h3>
              </div>
              <div className="space-y-2">
                {detail.audit.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 text-[10px] bg-muted/5 border border-border/10 p-3">
                    <div>
                      <span className="font-black uppercase tracking-widest text-foreground">{a.action}</span>
                      {a.reason && <p className="text-muted-foreground italic mt-1">"{a.reason}"</p>}
                    </div>
                    <span className="text-muted-foreground/60 shrink-0 tabular-nums">{a.performed_at?.slice(0, 16).replace("T", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {period!.notes && (
            <div className="bg-muted/5 p-5 border border-border/10">
              <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">"{period!.notes}"</p>
            </div>
          )}
        </div>
      )}
    </DetailModal>
  );
}
