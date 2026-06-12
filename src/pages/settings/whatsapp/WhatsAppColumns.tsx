
import { ColumnDef } from "@tanstack/react-table";
import { NotificationQueueRow } from "@/types/whatsapp";
import { formatDateTime, formatSentenceCase, formatPhone } from "@/lib/format-utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export const statusMap = {
  pending: { label: "Pendiente", variant: "warning" as const },
  processing: { label: "Procesando", variant: "info" as const },
  sent: { label: "Enviado", variant: "success" as const },
  failed: { label: "Fallido", variant: "error" as const },
  skipped: { label: "Omitido", variant: "purple" as const },
};

export const deliveryStatusMap = {
  accepted: { label: "Aceptado", variant: "info" as const },
  sent: { label: "Enviado", variant: "primary" as const },
  delivered: { label: "Entregado", variant: "success" as const },
  read: { label: "Leído", variant: "success" as const }, 
  failed: { label: "Fallido", variant: "error" as const },
};

export const columns: ColumnDef<NotificationQueueRow>[] = [
  {
    accessorKey: "created_at",
    header: "Fecha",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col">
          <span className="font-bold text-xs">{formatDateTime(row.original.created_at)}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            #{row.original.id.slice(0, 8)}
          </span>
        </div>
      );
    }
  },
  {
    accessorKey: "recipient_name",
    header: "Destinatario",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-bold text-sm text-foreground">{row.original.recipient_name}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{formatPhone(row.original.recipient_phone)}</span>
      </div>
    )
  },
  {
    accessorKey: "template_name",
    header: "Plantilla",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-primary/20 text-primary bg-primary/5">
          {row.original.template_name}
        </Badge>
      </div>
    )
  },
  {
    accessorKey: "delivered_at",
    header: "Hora de entrega",
    cell: ({ row }) => {
      const { delivered_at, sent_at } = row.original;
      if (delivered_at) {
        return (
          <div className="flex flex-col">
            <span className="font-bold text-xs text-emerald-500 tabular-nums">{formatDateTime(delivered_at)}</span>
            <span className="text-[10px] text-emerald-500/60 uppercase tracking-tighter">Entregado</span>
          </div>
        );
      }
      if (sent_at) {
        return (
          <div className="flex flex-col">
            <span className="font-bold text-xs tabular-nums">{formatDateTime(sent_at)}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">Enviado</span>
          </div>
        );
      }
      return <span className="text-[10px] text-muted-foreground italic uppercase tracking-tighter">Pen. Envío</span>;
    }
  },
  {
    accessorKey: "status",
    header: "Estado Cola",
    cell: ({ row }) => {
      const status = row.original.status;
      const config = statusMap[status] || { label: status, variant: "primary" as const };
      return (
        <StatusBadge 
          variant={config.variant} 
          dot 
          animate={status === 'processing' ? 'pulse' : 'none'}
          className="font-bold uppercase text-[10px]"
        >
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    }
  },
  {
    accessorKey: "delivery_status",
    header: "Estado Meta",
    cell: ({ row }) => {
      const deliveryStatus = row.original.delivery_status;
      if (!deliveryStatus) return <span className="text-[10px] text-muted-foreground italic">---</span>;
      
      const config = deliveryStatusMap[deliveryStatus] || { label: deliveryStatus, variant: "primary" as const };
      return (
        <StatusBadge 
          variant={config.variant} 
          dot 
          animate={deliveryStatus === 'sent' || deliveryStatus === 'accepted' ? 'pulse' : 'none'}
          className="font-bold uppercase text-[10px]"
        >
          {formatSentenceCase(config.label)}
        </StatusBadge>
      );
    }
  },
  {
    id: "alerts",
    header: "",
    cell: ({ row }) => {
      const hasError = row.original.status === 'failed' || row.original.delivery_status === 'failed';
      const errorMsg = row.original.error_message || row.original.failed_reason;

      return (
        <div className="flex items-center justify-end pr-4">
          {hasError && (
            <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center text-white border border-destructive/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {row.original.delivery_status === 'read' && (
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>
      );
    }
  }
];
