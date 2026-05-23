import * as React from "react";
import { AccountingClosure } from "@/types/database";
import { 
  DetailModal, 
  InlineEditField 
} from "@/components/shared/DetailModal";
import { 
  Calendar, 
  User, 
  TrendingUp, 
  DollarSign, 
  Info,
  BarChart3,
  ShieldCheck,
  FileText,
  ArrowUpRight
} from "lucide-react";
import { formatSentenceCase, formatDate, formatCurrency } from "@/lib/format-utils";
import { Button } from "@/components/ui/button";
import { statusMap } from "@/pages/closures/ClosuresColumns";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { cn } from "@/lib/utils";

interface ClosureDetailPanelProps {
  closure: AccountingClosure | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ClosureDetailPanel({ closure, isOpen, onClose }: ClosureDetailPanelProps) {
  if (!closure) return null;

  const currentStatus = statusMap[closure.status as keyof typeof statusMap] || { label: closure.status, variant: "secondary" };
  const formatPercent = (val: number) => `${(val || 0).toFixed(2)}%`;

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={(closure.project as any)?.name || formatSentenceCase("Cierre contable")}
      icon={BarChart3}
      subtitle={formatSentenceCase(`FINANZAS > CIERRES > ${closure.id.slice(0, 8)}`)}
      status={{ 
        label: formatSentenceCase(currentStatus.label), 
        variant: currentStatus.variant 
      }}
      footer={
        <div className="flex gap-4 w-full">
          <Button 
            variant="outline" 
            className="flex-1 border-border/30 h-12 rounded-none font-black text-[10px] tracking-widest uppercase"
            onClick={onClose}
          >
            {formatSentenceCase("Cerrar detalle")}
          </Button>
          {(closure.project as any)?.id && (
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] h-12 rounded-none tracking-widest uppercase"
              onClick={() => window.open(`/projects/${(closure.project as any).id}`, '_blank')}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              {formatSentenceCase("Ver proyecto completo")}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col space-y-12">
        {/* SECCIÓN 1: PANEL DE UTILIDAD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/10 border border-border/10 overflow-hidden">
          <div className="bg-muted/5 p-8 flex flex-col items-center justify-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap">
              {formatSentenceCase("Utilidad neta")}
            </p>
            <h2 className="text-4xl font-black text-foreground tracking-tighter">
              {formatCurrency(closure.net_profit)}
            </h2>
          </div>
          <div className="bg-primary/5 p-8 flex flex-col items-center justify-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary whitespace-nowrap">
              {formatSentenceCase("Margen de beneficio")}
            </p>
            <h2 className="text-4xl font-black text-primary tracking-tighter">
              {formatPercent(closure.profit_margin)}
            </h2>
          </div>
        </div>

        {/* SECCIÓN 2: DESGLOSE FINANCIERO */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <DollarSign className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Desglose de la liquidación")}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                {formatSentenceCase("Ingresos totales")}
              </span>
              <p className="text-2xl font-black text-foreground">
                {formatCurrency(closure.total_income)}
              </p>
            </div>
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-red-500" />
                {formatSentenceCase("Gastos totales")}
              </span>
              <p className="text-2xl font-black text-destructive">
                {formatCurrency(closure.total_expenses)}
              </p>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* SECCIÓN 3: INFORMACIÓN DEL PROYECTO */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Información del proyecto")}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Nombre del proyecto")}</span>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">{(closure.project as any)?.name || '---'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Estado del cierre")}</span>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  closure.status === 'closed' ? "bg-emerald-500" : "bg-primary"
                )} />
                <span className="text-sm font-bold text-foreground uppercase">{formatSentenceCase(currentStatus.label)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* SECCIÓN 4: REGISTRO Y AUDITORÍA */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Auditoría de cierre")}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Liquidado por")}</span>
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <User className="w-4 h-4 text-primary" />
                <span>{(closure as any).closed_user?.full_name || (closure as any).profiles?.full_name || '---'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Fecha de liquidación")}</span>
              <DateDisplay date={closure.closure_date} className="text-sm font-bold" />
            </div>
          </div>
        </div>

        {/* SECCIÓN 5: NOTAS */}
        {closure.notes && (
          <div className="space-y-6 bg-muted/5 p-8 border border-border/10">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
                {formatSentenceCase("Notas y observaciones")}
              </h3>
            </div>
            <p className="text-sm font-medium text-muted-foreground leading-relaxed italic">
              "{closure.notes}"
            </p>
          </div>
        )}

      </div>
    </DetailModal>
  );
}

