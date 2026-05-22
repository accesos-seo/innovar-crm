import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { Client } from "@/types/database";
import { MessageSquare } from "lucide-react";

export interface Lead extends Omit<Client, 'id'> {
  id: string;
  status?: "pending" | "contacted" | "qualified" | "lost" | "converted";
  urgency?: "low" | "medium" | "high";
  city?: string;
  services?: string | string[];
  assigned_to?: string;
  assigned_at?: string;
}

export const statusMap: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }> = {
  pending: { label: "Nuevo", variant: "warning" },
  contacted: { label: "En contacto", variant: "info" },
  qualified: { label: "Cotizado", variant: "success" },
  lost: { label: "Perdido", variant: "error" },
  converted: { label: "Convertido", variant: "purple" },
};

export const urgencyMap: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "primary" | "purple"; dot: string; color: string }> = {
  high: { label: "Alta", variant: "error", dot: "bg-red-500", color: "text-red-500" },
  medium: { label: "Media", variant: "warning", dot: "bg-amber-500", color: "text-amber-500" },
  low: { label: "Baja", variant: "info", dot: "bg-blue-500", color: "text-blue-500" },
};

export const columns: ColumnDef<Lead>[] = [
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
    header: formatSentenceCase("Nombre"),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <UserAvatar name={row.original.name || "Usuario"} />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {row.original.name}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => {
      const status = row.original.status || "pending";
      const config = statusMap[status] || statusMap.pending;
      return (
        <StatusBadge variant={config.variant} dot animate="scale">
          {config.label}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: formatSentenceCase("Fecha llegada"),
    cell: ({ row }) => <DateDisplay date={row.original.created_at} className="text-xs text-muted-foreground font-medium" iconClassName="w-3 h-3 opacity-60" />,
  },
  {
    accessorKey: "whatsapp_phone",
    header: formatSentenceCase("WhatsApp"),
    cell: ({ row }) => (
      <div className="flex items-center gap-2 group/phone cursor-pointer w-fit">
        <div className="p-1.5 bg-[#25D366]/10 rounded-full group-hover/phone:bg-[#25D366]/20 transition-colors">
          <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
        </div>
        <span className="text-xs text-muted-foreground font-bold group-hover/phone:text-primary transition-colors">
          {row.original.whatsapp_phone}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "urgency",
    header: formatSentenceCase("Urgencia"),
    cell: ({ row }) => {
      const raw = row.original.urgency as string | undefined;
      const normalized = raw === "ASAP" ? "high" : raw === "SHORT" ? "medium" : raw === "LON" ? "low" : raw || "medium";
      const variant = normalized === "high" ? "error" : normalized === "medium" ? "warning" : "info";
      const label = normalized === "high" ? "Alta" : normalized === "medium" ? "Media" : "Baja";

      return (
        <StatusBadge variant={variant} dot animate={normalized === 'high' ? 'pulse' : 'none'}>
          {label}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "city",
    header: formatSentenceCase("Ciudad"),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-medium">
        {row.original.city || (typeof row.original.address === 'string' ? row.original.address.split(',')[0] : "---")}
      </span>
    ),
  },
];
