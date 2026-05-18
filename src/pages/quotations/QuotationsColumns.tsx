import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { formatSentenceCase } from "@/lib/format-utils";
import { QuotationStatus } from "@/types/database";
import { Hash, DollarSign } from "lucide-react";

export const statusMap: Record<QuotationStatus, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }> = {
  draft: { label: "Borrador", variant: "info" },
  sent: { label: "Enviada", variant: "primary" },
  viewed: { label: "Vista", variant: "purple" },
  negotiation: { label: "Negociación", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "error" },
  expired: { label: "Vencida", variant: "error" },
  replaced: { label: "Reemplazada", variant: "info" },
};

export const columns: ColumnDef<any>[] = [
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
    accessorKey: "id",
    header: formatSentenceCase("Referencia"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Hash className="w-3 h-3 text-primary shrink-0" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
            {row.original.id.split('-')[0]}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold">
            v{row.original.version_number || 1}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "client.name",
    header: formatSentenceCase("Cliente"),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.original.client?.name || "Cliente"} />
        <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors line-clamp-1">
          {row.original.client?.name || formatSentenceCase("Desconocido")}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => {
      const status = (row.original.status as QuotationStatus) || "draft";
      const config = statusMap[status] || statusMap.draft;
      return (
        <StatusBadge variant={config.variant} dot animate="scale">
          {config.label}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "total_amount",
    header: formatSentenceCase("Monto total"),
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-sm font-black text-primary">
          {(row.original.total_amount || 0).toLocaleString()}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "created_at",
    header: formatSentenceCase("Fecha creación"),
    cell: ({ row }) => <DateDisplay date={row.original.created_at} className="text-xs text-muted-foreground font-medium" iconClassName="w-3 h-3 opacity-60" />,
  },
];
