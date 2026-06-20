import * as React from "react";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreateClosure } from "@/hooks/finanzas/useCreateClosure";
import { useProjectBalance } from "@/hooks/finanzas/useProjectBalance";
import { useProjects } from "@/hooks/useProjects";
import { notify } from "@/components/ui/PremiumToast";
import { Lock, X, Calculator, PieChart, TrendingUp, DollarSign, FileText, CheckCircle2 } from "lucide-react";
import { formatSentenceCase, formatCurrency } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

interface NewClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewClosureModal({ isOpen, onClose }: NewClosureModalProps) {
  const createClosure = useCreateClosure();
  const { data: rawProjects = [] } = useProjects();
  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  
  // Restricted to delivered projects, 100% paid, with no closure yet (Q2)
  const eligibleProjects = projects.filter((p: any) => p.status === 'entregado' && p.is_fully_paid && !p.accounting_closure_id);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");

  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Fetch balance summary via RPC for preview
  const { data: balanceSummary, isLoading: isLoadingSummary } = useProjectBalance(selectedProjectId && selectedProjectId !== "" ? selectedProjectId : undefined);

  const formatPercent = (val: number) => `${(val || 0).toFixed(2)}%`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      notify.error("Error", "Selecciona un proyecto válido");
      return;
    }

    try {
      await createClosure.mutateAsync({
        project_id: selectedProjectId,
        notes: notes || undefined
      });
      notify.success(formatSentenceCase("Cierre contable generado"), formatSentenceCase("El proyecto ha sido liquidado exitosamente."));
      onClose();
      resetForm();
    } catch(err) {
      notify.error("Error", "No se pudo generar el cierre contable.");
    }
  };

  const resetForm = () => {
    setSelectedProjectId("");
    setNotes("");
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("CREAR CIERRE CONTABLE")}
      icon={Lock}
      subtitle={formatSentenceCase("FINANZAS > LIQUIDACIÓN")}
      footer={
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
            form="new-closure-form"
            disabled={createClosure.isPending || !selectedProjectId || selectedProjectId === "no_project" || isLoadingSummary} 
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {createClosure.isPending ? formatSentenceCase("Cerrando...") : formatSentenceCase("Ejecutar cierre")}
          </Button>
        </div>
      }
    >
      <form id="new-closure-form" onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* SECCIÓN 1: SELECCIÓN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <Calculator className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("SELECCIÓN DE PROYECTO")}</h3>
            </div>
            
            <div className="space-y-4 bg-muted/5 p-6 border border-border/10">
              <div className="w-full space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {formatSentenceCase("Proyecto a liquidar")} <span className="text-primary">*</span>
                </label>
                <Select value={selectedProjectId} onValueChange={(v) => { if (v !== null) setSelectedProjectId(v); }}>
                  <SelectTrigger className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-medium w-full">
                    <SelectValue placeholder={formatSentenceCase("Buscar proyecto entregado...")}>
                      {selectedProjectId ? eligibleProjects.find(p => p.id === selectedProjectId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border/50">
                    {eligibleProjects.length === 0 ? (
                      <SelectItem value="empty" disabled>{formatSentenceCase("No hay proyectos entregados disponibles")}</SelectItem>
                    ) : (
                      eligibleProjects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[9px] font-bold text-muted-foreground/60 italic leading-tight">
                  {formatSentenceCase("Solo se admiten proyectos en estado 'Entregado' que no posean liquidación contable previa.")}
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: BALANCES */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("BALANCE ESTIMADO")}</h3>
            </div>

            {selectedProjectId && selectedProjectId !== "" ? (
              isLoadingSummary ? (
                <div className="grid grid-cols-2 gap-2 bg-muted/5 p-6 border border-border/10 animate-pulse">
                  <div className="h-12 bg-muted/20" />
                  <div className="h-12 bg-muted/20" />
                  <div className="h-16 bg-muted/20 col-span-2" />
                </div>
              ) : balanceSummary ? (
                <div className="grid grid-cols-2 gap-px bg-border/10 border border-border/10 overflow-hidden shadow-xl shadow-primary/5">
                  <div className="bg-muted/5 p-4 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">Ingresos</p>
                    <p className="text-lg font-black text-foreground tabular-nums">{formatCurrency(balanceSummary.total_amount)}</p>
                  </div>
                  <div className="bg-muted/5 p-4 space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/70">Costos</p>
                    <p className="text-lg font-black text-destructive tabular-nums">{formatCurrency(balanceSummary.total_expenses)}</p>
                  </div>
                  <div className="bg-primary/5 p-4 col-span-2 flex justify-between items-center border-t border-primary/20">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-primary">Utilidad Neta</p>
                      <p className="text-xl font-black text-primary tabular-nums">{formatCurrency(balanceSummary.net_profit)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black uppercase tracking-widest text-primary">Margen</p>
                      <p className="text-xl font-black text-primary tabular-nums">{formatPercent(balanceSummary.profit_margin)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/5 p-6 border border-border/10 flex items-center justify-center text-center">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] italic">Error cargando balance</p>
                </div>
              )
            ) : (
              <div className="bg-muted/5 p-6 border border-border/10 flex items-center justify-center text-center min-h-[120px]">
                <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] italic">Seleccione un proyecto para previsualizar el balance</p>
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 3: OBSERVACIONES */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-4 border-primary pl-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase italic tracking-tight">{formatSentenceCase("AUDITORÍA Y COMENTARIOS")}</h3>
          </div>
          <div className="bg-muted/5 p-6 border border-border/10">
            <Textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder={formatSentenceCase("Ingrese observaciones finales sobre la liquidación del proyecto, variaciones en costos o lecciones aprendidas...")}
              className="bg-background border-border/50 h-full min-h-[100px] rounded-none focus-visible:ring-primary font-medium resize-none p-4"
            />
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 flex gap-4 items-center">
          <div className="shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">Advertencia de Cierre</p>
            <p className="text-[9px] font-bold text-primary/70 uppercase tracking-widest leading-relaxed italic">
              El cierre contable bloqueará la edición de transacciones vinculadas. Esta operación es irreversible para fines de auditoría.
            </p>
          </div>
        </div>
      </form>
    </DetailModal>
  );
}

