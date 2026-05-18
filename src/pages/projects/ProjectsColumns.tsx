import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase, formatDate } from "@/lib/format-utils";
import { Project, ProjectStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";

export const statusMap: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }> = {
  in_progress: { label: "General", variant: "primary" },
  completed: { label: "General (Completado)", variant: "success" },
  on_hold: { label: "General (Pausado)", variant: "warning" },
  cancelled: { label: "General (Cancelado)", variant: "error" },
  contacto: { label: "Contacto", variant: "info" },
  medicion_tomada: { label: "Medición Tomada", variant: "info" },
  cotizacion_enviada: { label: "Cotización Enviada", variant: "info" },
  cotizacion_aprobada: { label: "Cotización Aprobada", variant: "success" },
  en_diseno: { label: "En Diseño", variant: "warning" },
  modelado_listo: { label: "Modelado Listo", variant: "primary" },
  renders_listos: { label: "Renders Listos", variant: "primary" },
  aprobacion_cliente: { label: "Aprobación Cliente", variant: "success" },
  en_produccion: { label: "En Producción", variant: "warning" },
  instalacion_programada: { label: "Instalación Programada", variant: "purple" },
  instalando: { label: "Instalando", variant: "purple" },
  entregado: { label: "Entregado", variant: "success" },
  garantia: { label: "Garantía", variant: "error" },
};

export const columns: ColumnDef<Project>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Seleccionar todos"
        className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
          className="border-border/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: formatSentenceCase("Proyecto"),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate max-w-[250px]" title={row.original.name}>
          {row.original.name}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "work_type",
    header: formatSentenceCase("Tipo"),
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize text-[10px] font-bold border-border/50">
        {(row.original.work_type || "").replace('_', ' ')}
      </Badge>
    ),
  },
  {
    accessorKey: "total_amount",
    header: () => <span className="text-left uppercase tracking-wider">{formatSentenceCase("Monto total")}</span>,
    cell: ({ row }) => (
      <div className="text-left font-mono text-sm font-black text-primary flex items-center justify-start">
        <span className="mr-1 text-muted-foreground font-medium">$</span>
        {(row.original.total_amount || 0).toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => {
       const status = row.original.status as ProjectStatus || "in_progress";
       const config = statusMap[status] || statusMap.in_progress;
       return (
        <div className="flex justify-start">
          <StatusBadge 
            variant={config.variant} 
            dot 
            animate="scale"
          >
            {config.label}
          </StatusBadge>
        </div>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: () => <span className="text-left uppercase tracking-wider">{formatSentenceCase("Fecha")}</span>,
    cell: ({ row }) => (
      <div className="text-sm text-left text-muted-foreground font-bold flex items-center justify-start gap-2">
        <CalendarIcon className="w-4 h-4 text-primary" />
        <span>{formatDate(row.original.created_at)}</span>
      </div>
    ),
  },
];
