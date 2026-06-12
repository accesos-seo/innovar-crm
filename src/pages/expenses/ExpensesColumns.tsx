import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase, formatDate } from "@/lib/format-utils";
import { Receipt, Info, Tag, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Expense } from "@/types/database";

import { useAuthStore } from "@/store/authStore";
import { useApproveExpense } from "@/hooks/finanzas/useApproveExpense";
import { Check, X, Loader2 } from "lucide-react";
import { notify } from "@/components/ui/PremiumToast";
import { Button } from "@/components/ui/button";

export const statusMap = {
  pendiente: { label: "Pendiente", variant: "warning" as const },
  aprobado: { label: "Aprobado", variant: "success" as const },
  rechazado: { label: "Rechazado", variant: "error" as const },
};

export const columns: ColumnDef<Expense>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todos"
        className="translate-y-[2px] border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={!!row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Seleccionar fila"
        className="translate-y-[2px] border-muted-foreground/30"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
      return (
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground truncate max-w-[300px]" title={description}>
            {description}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
             #{row.original.id.slice(0, 8)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row }) => {
      const category = row.getValue("category") as string;
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 shadow-[0_0_8px_rgba(0,255,200,0.15)] uppercase text-[9px] font-black tracking-widest rounded-none">
          {category.replace('_', ' ')}
        </Badge>
      );
    },
  },
  {
    id: "asignacion",
    header: "Asignación",
    cell: ({ row }) => {
      const project = (row.original as any).projects as { name?: string } | null;
      if (row.original.project_id) {
        return (
          <span className="text-xs font-bold text-foreground truncate max-w-[180px] block" title={project?.name ?? undefined}>
            {project?.name ?? "Proyecto"}
          </span>
        );
      }
      return (
        <Badge className="bg-muted/40 text-muted-foreground border-border/30 uppercase text-[9px] font-black tracking-widest rounded-none">
          Empresa / Bodega
        </Badge>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Monto",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(amount);
      return <span className="font-black text-foreground tabular-nums">{formatted}</span>;
    },
  },
  {
    accessorKey: "approval_status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("approval_status") as keyof typeof statusMap;
      const config = statusMap[status] || { label: status, variant: "info" as const };
      
      const getShadow = (variant: string) => {
        switch(variant) {
          case 'success': return 'shadow-[0_0_8px_rgba(34,197,94,0.3)]';
          case 'warning': return 'shadow-[0_0_8px_rgba(234,179,8,0.3)]';
          case 'error': return 'shadow-[0_0_8px_rgba(239,68,68,0.3)]';
          default: return '';
        }
      };

      return (
        <StatusBadge 
          variant={config.variant} 
          dot 
          animate={status === 'pendiente' ? 'pulse' : 'none'}
          className={cn("font-bold uppercase text-[10px]", getShadow(config.variant))}
        >
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "expense_date",
    header: "Fecha",
    cell: ({ row }) => {
      const date = row.getValue("expense_date") as string;
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{formatDate(date)}</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const expense = row.original;
      const profile = useAuthStore.getState().profile;
      const isAdmin = profile?.role === 'admin';
      const approveExpense = useApproveExpense();

      if (!isAdmin || expense.approval_status !== 'pendiente') return null;

      const handleAction = async (status: 'aprobado' | 'rechazado') => {
        try {
          await approveExpense.mutateAsync({ id: expense.id, approval_status: status });
          notify.success(formatSentenceCase(`Gasto ${status}`), formatSentenceCase(`El gasto ha sido marcado como ${status}.`));
        } catch (error) {
          notify.error("Error", "No se pudo actualizar el estado.");
        }
      };

      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-emerald-500 hover:bg-emerald-500/10"
            onClick={() => handleAction('aprobado')}
            disabled={approveExpense.isPending}
            title="Aprobar"
          >
            {approveExpense.isPending ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-500 hover:bg-red-500/10"
            onClick={() => handleAction('rechazado')}
            disabled={approveExpense.isPending}
            title="Rechazar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }
  }
];
