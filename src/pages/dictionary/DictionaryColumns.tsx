import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { SystemDictionaryEntry, SystemCategory } from "@/types/database";
import { Database, Zap, Repeat, HardDrive, Info } from "lucide-react";

export const categoryMap: Record<SystemCategory, { label: string; variant: any; icon: any }> = {
  BUCKET: { label: "Bucket (Almacenamiento)", variant: "info", icon: HardDrive },
  EDGE_FUNCTION: { label: "Edge Function", variant: "purple", icon: Zap },
  DB_TRIGGER: { label: "DB Trigger", variant: "warning", icon: Database },
  CRON_JOB: { label: "Cron Job", variant: "success", icon: Repeat },
};

export const statusMap = {
  active: { label: "Activo", variant: "success" as const },
  inactive: { label: "Inactivo", variant: "error" as const },
};

export const columns: ColumnDef<SystemDictionaryEntry>[] = [
  {
    accessorKey: "category",
    header: formatSentenceCase("Categoría"),
    cell: ({ row }) => {
      const category = row.original.category;
      const config = categoryMap[category] || { label: category, variant: "info", icon: Info };
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-sm">
            <Icon className="w-3.5 h-3.5 text-foreground/70" />
          </div>
          <StatusBadge variant={config.variant}>
            {config.label}
          </StatusBadge>
        </div>
      );
    },
  },
  {
    accessorKey: "name",
    header: formatSentenceCase("Nombre del Proceso"),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
          {row.original.name}
        </span>
        <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[200px]">
          {row.original.description}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "trigger_event",
    header: formatSentenceCase("Evento / Detonador"),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-medium italic line-clamp-1 max-w-[150px]">
        {row.original.trigger_event || "---"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => {
      const status = row.original.status || "active";
      const config = statusMap[status] || statusMap.active;
      return (
        <StatusBadge variant={config.variant} dot animate={status === 'active' ? 'scale' : 'none'}>
          {config.label}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "updated_at",
    header: formatSentenceCase("Última actualización"),
    cell: ({ row }) => <DateDisplay date={row.original.updated_at} className="text-xs text-muted-foreground font-medium" iconClassName="w-3 h-3 opacity-60" />,
  },
];
