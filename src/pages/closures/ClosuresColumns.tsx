import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase, formatDate, formatCurrency } from "@/lib/format-utils";
import { BarChart3, Calendar, FileText, TrendingUp, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AccountingClosure } from "@/types/database";

export const statusMap = {
  draft: { label: "Borrador", variant: "info" as const },
  closed: { label: "Cerrado", variant: "success" as const },
  reviewed: { label: "Revisado", variant: "primary" as const },
};

export const columns: ColumnDef<AccountingClosure>[] = [
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
    accessorKey: "project",
    header: "Proyecto",
    cell: ({ row }) => {
      const project = row.original.project as any;
      return (
        <div className="flex flex-col">
          <span className="font-bold text-sm text-foreground truncate max-w-[200px]" title={project?.name}>
            {project?.name || "---"}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
             #{row.original.id.slice(0, 8)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "total_income",
    header: "Ingresos",
    cell: ({ row }) => {
      const val = parseFloat(row.getValue("total_income"));
      return <span className="font-bold text-foreground">{formatCurrency(val)}</span>;
    },
  },
  {
    accessorKey: "total_expenses",
    header: "Gastos",
    cell: ({ row }) => {
      const val = parseFloat(row.getValue("total_expenses"));
      return <span className="font-bold text-destructive">{formatCurrency(val)}</span>;
    },
  },
  {
    accessorKey: "net_profit",
    header: "Utilidad",
    cell: ({ row }) => {
      const val = parseFloat(row.getValue("net_profit"));
      return <span className="font-black text-foreground">{formatCurrency(val)}</span>;
    },
  },
  {
    accessorKey: "profit_margin",
    header: "Margen %",
    cell: ({ row }) => {
      const val = parseFloat(row.getValue("profit_margin"));
      return (
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="font-black text-primary">{val.toFixed(1)}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status") as keyof typeof statusMap;
      const config = statusMap[status] || { label: status, variant: "info" as const };
      
      const getShadow = (variant: string) => {
        switch(variant) {
          case 'success': return 'shadow-[0_0_8px_rgba(34,197,94,0.3)]';
          case 'primary': return 'shadow-[0_0_8px_rgba(0,255,200,0.3)]';
          case 'info': return 'shadow-[0_0_8px_rgba(59,130,246,0.3)]';
          default: return '';
        }
      };

      return (
        <StatusBadge 
          variant={config.variant} 
          dot 
          animate={status === 'draft' ? 'pulse' : 'none'}
          className={cn("font-bold uppercase text-[10px]", getShadow(config.variant))}
        >
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "closure_date",
    header: "Fecha Cierre",
    cell: ({ row }) => {
      const date = row.getValue("closure_date") as string;
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{formatDate(date)}</span>
        </div>
      );
    },
  },
];
