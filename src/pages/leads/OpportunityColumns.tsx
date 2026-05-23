import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import {
  opportunityStatusConfig,
  opportunityPriorityConfig,
  type OpportunityStatus,
  type OpportunityPriority,
} from "@/schemas/opportunity";
import type { OpportunityWithClient } from "@/hooks/useOpportunities";

export type OpportunityRowView = OpportunityWithClient;

export const opportunityColumns: ColumnDef<OpportunityRowView>[] = [
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
    id: "client_name",
    header: formatSentenceCase("Cliente"),
    cell: ({ row }) => {
      const name = row.original.client?.name || "Sin nombre";
      return (
        <div className="flex items-center gap-3">
          <UserAvatar name={name} />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {name}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: formatSentenceCase("Estado"),
    cell: ({ row }) => {
      const status = (row.original.status || "new") as OpportunityStatus;
      const config =
        opportunityStatusConfig[status] || opportunityStatusConfig.new;
      return (
        <StatusBadge variant={config.variant} dot animate="scale">
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: formatSentenceCase("Fecha llegada"),
    cell: ({ row }) => (
      <DateDisplay
        date={row.original.created_at}
        className="text-xs text-muted-foreground font-medium"
        iconClassName="w-3 h-3 opacity-60"
      />
    ),
  },
  {
    id: "whatsapp",
    header: formatSentenceCase("WhatsApp"),
    cell: ({ row }) => {
      const phone = row.original.client?.whatsapp_phone || "—";
      return (
        <div className="flex items-center gap-2 group/phone cursor-pointer w-fit">
          <div className="p-1.5 bg-[#25D366]/10 rounded-full group-hover/phone:bg-[#25D366]/20 transition-colors">
            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
          </div>
          <span className="text-xs text-muted-foreground font-bold group-hover/phone:text-primary transition-colors">
            {phone}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "priority",
    header: formatSentenceCase("Urgencia"),
    cell: ({ row }) => {
      const priority = (row.original.priority || "SHORT") as OpportunityPriority;
      const config =
        opportunityPriorityConfig[priority] || opportunityPriorityConfig.SHORT;
      return (
        <StatusBadge
          variant={config.variant}
          dot
          animate={priority === "ASAP" ? "pulse" : "none"}
        >
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    },
  },
  {
    accessorKey: "city",
    header: formatSentenceCase("Ciudad"),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-medium">
        {row.original.city ||
          (typeof row.original.address === "string"
            ? row.original.address.split(",")[0]
            : "---")}
      </span>
    ),
  },
  {
    id: "assigned_user",
    header: formatSentenceCase("Asignado"),
    cell: ({ row }) => {
      const u = row.original.assigned_user;
      if (!u) {
        return (
          <span className="text-xs italic text-muted-foreground/60">
            {formatSentenceCase("Sin asignar")}
          </span>
        );
      }
      const display = u.full_name || u.email || "—";
      return (
        <Link
          to={`/settings/users?userId=${u.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 hover:text-primary transition-colors group/asg"
          title={formatSentenceCase(`Ver perfil de ${display}`)}
        >
          <UserAvatar name={display} image={u.avatar_url ?? undefined} />
          <span className="text-xs font-bold text-muted-foreground group-hover/asg:text-primary group-hover/asg:underline transition-colors">
            {display}
          </span>
        </Link>
      );
    },
  },
];
