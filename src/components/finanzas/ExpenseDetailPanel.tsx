import * as React from "react";
import { Expense } from "@/types/database";
import { 
  DetailModal, 
  InlineEditField, 
  InlineEditDateField 
} from "@/components/shared/DetailModal";
import { 
  Calendar, 
  User, 
  Receipt, 
  Tag, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Info,
  ShieldCheck,
  FileText
} from "lucide-react";
import { formatSentenceCase, formatDate, formatCurrency } from "@/lib/format-utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useApproveExpense } from "@/hooks/finanzas/useApproveExpense";
import { notify } from "@/components/ui/PremiumToast";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { statusMap } from "@/pages/expenses/ExpensesColumns";
import { cn } from "@/lib/utils";

interface ExpenseDetailPanelProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExpenseDetailPanel({ expense, isOpen, onClose }: ExpenseDetailPanelProps) {
  const profile = useAuthStore(state => state.profile);
  const isAdmin = profile?.role === 'admin';
  const approveExpense = useApproveExpense();

  if (!expense) return null;

  const handleStatusChange = async (newStatus: "aprobado" | "rechazado") => {
    try {
      await approveExpense.mutateAsync({ 
        id: expense.id, 
        approval_status: newStatus 
      });
      notify.success(formatSentenceCase(`Gasto ${newStatus}`), formatSentenceCase(`El estado del gasto ha sido actualizado a ${newStatus}.`));
    } catch (err) {
      notify.error("Error", "No se pudo actualizar el estado.");
    }
  };

  const currentStatus = statusMap[expense.approval_status as keyof typeof statusMap] || { label: expense.approval_status, variant: "secondary" };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={expense.description}
      icon={Receipt}
      subtitle={formatSentenceCase(`FINANZAS > GASTOS > ${expense.id.slice(0, 8)}`)}
      status={{ 
        label: formatSentenceCase(currentStatus.label), 
        variant: currentStatus.variant 
      }}
      footer={
        isAdmin && expense.approval_status === 'pendiente' ? (
          <div className="flex gap-4 w-full">
            <Button 
              variant="outline" 
              className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 font-black text-[10px] h-12 rounded-none tracking-widest"
              onClick={() => handleStatusChange('rechazado')}
              disabled={approveExpense.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              {formatSentenceCase("RECHAZAR GASTO")}
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] h-12 rounded-none tracking-widest"
              onClick={() => handleStatusChange('aprobado')}
              disabled={approveExpense.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {formatSentenceCase("APROBAR GASTO")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col space-y-12">
        {/* SECCIÓN 1: CABECERA DE MONTO */}
        <div className="flex flex-col items-center justify-center py-8 bg-muted/5 border border-border/10 rounded-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            {formatSentenceCase("Monto total del egreso")}
          </p>
          <h2 className="text-5xl font-black text-foreground tracking-tighter">
            {formatCurrency(expense.amount)}
          </h2>
          <div className="mt-4 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {expense.category.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* SECCIÓN 2: DETALLES GENERALES */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Detalles del gasto")}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
            <div className="col-span-2">
              <InlineEditField
                label={formatSentenceCase("Descripción")}
                value={expense.description}
                onSave={async (v) => {}}
                editable={false}
              />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Proyecto asociado")}</span>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {expense.projects?.name || formatSentenceCase("Gastos generales")}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Categoría técnica")}</span>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-foreground uppercase">
                  {expense.category.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[1px] w-full bg-border/10" />

        {/* SECCIÓN 3: REGISTRO Y REVISIÓN */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Registro y Auditoría")}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-12">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Registrado por")}</span>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                   <User className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground">{expense.register_user?.full_name || '---'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Fecha del gasto")}</span>
              <DateDisplay date={expense.expense_date} className="text-sm font-bold" />
            </div>
            {expense.approve_user && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Aprobado por")}</span>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-bold text-foreground">{expense.approve_user?.full_name}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-[1px] w-full bg-border/10" />

        {/* SECCIÓN 4: COMPROBANTE */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Receipt className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-widest">
              {formatSentenceCase("Soporte documental")}
            </h3>
          </div>
          
          {expense.receipt_url ? (
            <div className="group relative">
               <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm border border-primary/20 -m-2" />
               <a 
                href={expense.receipt_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-6 border border-border/10 bg-card hover:bg-muted/50 transition-all rounded-none"
              >
                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-none border border-primary/20 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black uppercase tracking-widest text-foreground">
                    {formatSentenceCase("Ver comprobante de pago")}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] mt-1 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                     HAZ CLICK PARA ABRIR EN NUEVA PESTAÑA
                  </p>
                </div>
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/10 rounded-sm bg-muted/5">
              <Receipt className="w-10 h-10 text-muted-foreground/30 mb-4" strokeWidth={1} />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {formatSentenceCase("No hay comprobante adjunto")}
              </p>
            </div>
          )}
        </div>

        {/* SECCIÓN 5: AUDITORÍA LITE */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-12 bg-muted/5 p-8 border border-border/10">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Creación sistema")}</p>
            <DateDisplay date={expense.created_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4" />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Último cambio")}</p>
            <DateDisplay date={expense.updated_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4 text-muted-foreground/60" />
          </div>
        </div>
      </div>
    </DetailModal>
  );
}
