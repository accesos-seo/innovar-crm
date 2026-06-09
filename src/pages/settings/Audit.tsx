import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  User, 
  Database, 
  Activity,
  ArrowRightLeft,
  FileJson,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatSentenceCase, formatDate, formatDateTime } from "@/lib/format-utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { DetailModal } from "@/components/shared/DetailModal";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { toast } from "sonner";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader, PremiumLoadingOverlay } from "@/components/shared/PremiumLoader";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { parseISO } from "date-fns";

import { supabase } from "@/lib/supabaseClient";
import { EmptyState } from "@/components/shared/EmptyState";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  tableName: string;
  recordId: string;
  changesSummary: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KEY_LABELS: Record<string, string> = {
  amount: "Monto", method: "Método", type: "Tipo", designer: "Diseñador",
  status: "Estado", field: "Campo", from: "De", to: "A",
  name: "Nombre", client: "Cliente", quotation: "Cotización",
};

const VALUE_LABELS: Record<string, string> = {
  advance: "Anticipo", installment: "Abono", final: "Pago Final", refund: "Reembolso",
  pending: "Pendiente", verified: "Verificado", rejected: "Rechazado",
  cancelled: "Cancelado", approved: "Aprobado",
};

function formatSummary(summary: string): string {
  if (!summary) return "—";
  const pairs = summary.match(/\w+=\S+/g);
  if (!pairs || pairs.length === 0) return summary;
  return pairs.map(pair => {
    const eqIdx = pair.indexOf("=");
    const key = pair.slice(0, eqIdx);
    let val = pair.slice(eqIdx + 1);
    if (UUID_RE.test(val)) val = val.slice(0, 8) + "…";
    else if (key === "amount") val = `$${Number(val).toLocaleString("es-CO")}`;
    else val = VALUE_LABELS[val] ?? val;
    return `${KEY_LABELS[key] ?? key}: ${val}`;
  }).join(" · ");
}

const PAGE_SIZE = 20;

const actionMap: Record<string, { label: string; color: string }> = {
  create: { label: "Creación", color: "bg-emerald-500/10 text-emerald-500" },
  update: { label: "Edición", color: "bg-blue-500/10 text-blue-500" },
  delete: { label: "Eliminación", color: "bg-destructive/10 text-destructive" },
  restore: { label: "Restauración", color: "bg-purple-500/10 text-purple-500" },
  quotation_cancelled: { label: "Cotización Cancelada", color: "bg-destructive/10 text-destructive" },
  quotation_status_changed: { label: "Estado Cotización", color: "bg-blue-500/10 text-blue-500" },
  quotation_superseded: { label: "Cotización Reemplazada", color: "bg-yellow-500/10 text-yellow-500" },
  payment_verified: { label: "Pago Verificado", color: "bg-emerald-500/10 text-emerald-500" },
  payment_rejected: { label: "Pago Rechazado", color: "bg-destructive/10 text-destructive" },
  payment_registered_manual: { label: "Pago Manual", color: "bg-purple-500/10 text-purple-500" },
};

const columns: ColumnDef<AuditLog>[] = [
  {
    accessorKey: "timestamp",
    header: "Fecha y Hora",
    cell: ({ row }) => <DateDisplay date={row.original.timestamp} showTime className="text-xs font-mono text-muted-foreground" iconClassName="w-3 h-3" />,
  },
  {
    accessorKey: "userName",
    header: "Usuario",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <UserAvatar name={row.original.userName || "Innovar"} size="sm" className="size-6" />
        <span className="text-sm font-bold text-foreground">{row.original.userName || "Sistema"}</span>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Acción",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none", actionMap[row.original.action]?.color)}>
        {actionMap[row.original.action]?.label ?? row.original.action}
      </Badge>
    ),
  },
  {
    accessorKey: "tableName",
    header: "Módulo",
    cell: ({ row }) => <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{row.original.tableName}</span>,
  },
  {
    accessorKey: "changesSummary",
    header: "Resumen de Cambios",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground max-w-[320px] truncate block">
        {formatSummary(row.original.changesSummary)}
      </span>
    ),
  },
];

function exportLogsToCSV(logs: AuditLog[]) {
  if (logs.length === 0) {
    return false;
  }
  const headers = [
    "Fecha/Hora", "Usuario", "Acción", "Módulo",
    "ID Registro", "Resumen de Cambios", "IP", "Dispositivo",
  ];
  const rows = logs.map(log => [
    log.timestamp,
    log.userName || "Sistema",
    actionMap[log.action]?.label ?? log.action,
    log.tableName,
    log.recordId || "",
    formatSummary(log.changesSummary),
    log.ipAddress || "",
    log.userAgent || "",
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export default function AuditSettingsPage() {
  const navigate = useNavigate();
  const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);
  const [pageIndex, setPageIndex] = React.useState(0);

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);
      if (error) {
        toast.error("Error de auditoría", { description: "No se pudieron obtener los registros de auditoría." });
        return [];
      }
      return (data || []) as AuditLog[];
    },
  });

  const metrics: MetricData[] = [
    { title: "Eventos Totales", value: logs.length, description: "Historial acumulado", icon: Activity, trend: "up", color: "blue" },
    { title: "Cambios Críticos", value: logs.filter(l => l.action === 'delete').length, description: "Eliminaciones", icon: ShieldCheck, trend: "neutral", color: "purple" },
    { title: "Tablas Afectadas", value: new Set(logs.map(l => l.tableName)).size, description: "Módulos activos", icon: Database, trend: "neutral", color: "green" },
    { title: "Usuarios Activos", value: new Set(logs.map(l => l.userId)).size, description: "Realizando cambios", icon: User, trend: "up", color: "yellow" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="AUDITORÍA Y ACCESOS"
        subtitle="Trazabilidad total de acciones, cambios y seguridad del sistema."
        icon={History}
        onBack={() => navigate("/settings")}
        action={{
          label: "Exportar Log",
          icon: Download,
          onClick: () => {
            const ok = exportLogsToCSV(logs);
            if (ok) toast.success(`${logs.length} registros exportados como CSV`);
            else toast.error("Sin registros para exportar");
          }
        }}
      />

      {isLoading && <PremiumLoadingOverlay text="Recuperando Historial de Auditoría" />}

      <MetricsGrid metrics={metrics} />

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Filtrar por usuario, módulo o acción..." 
                className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
              />
            </div>
            
            <FilterSheet
              title="Filtros de Auditoría"
              description="Segmenta el historial por acciones o fechas."
              onApply={() => toast.info("Filtros aplicados")}
              onClear={() => {}}
            >
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rango de fechas</label>
                  <div className="grid grid-cols-1 gap-4">
                    <CalendarPopover 
                      placeholder="Desde"
                      className="w-full text-xs h-12"
                    />
                    <CalendarPopover 
                      placeholder="Hasta"
                      className="w-full text-xs h-12"
                    />
                  </div>
                </div>
              </div>
            </FilterSheet>
          </div>

          <DataTable
            columns={columns}
            data={logs.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)}
            isLoading={isLoading}
            totalCount={logs.length}
            pageCount={Math.max(1, Math.ceil(logs.length / PAGE_SIZE))}
            pageIndex={pageIndex}
            pageSize={PAGE_SIZE}
            onPageChange={setPageIndex}
            onPageSizeChange={() => {}}
            onRowClick={setSelectedLog}
            emptyMessage={
              <EmptyState 
                title="Sin registros de auditoría"
                description="No se encontraron eventos en el historial para los filtros seleccionados."
                icon={History}
              />
            }
          />

      <DetailModal
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
        title="Detalle de Evento"
        icon={History}
        subtitle={`Log ID: ${selectedLog?.id}`}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pb-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Usuario Responsable</p>
              <p className="text-sm font-bold text-foreground">{selectedLog?.userName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Acción Ejecutada</p>
              <Badge variant="outline" className={cn("mt-1 text-[10px] font-bold uppercase tracking-widest", selectedLog ? actionMap[selectedLog.action]?.color : "")}>
                {selectedLog ? (actionMap[selectedLog.action]?.label ?? selectedLog.action) : ""}
              </Badge>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 py-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Módulo Afectado</p>
              <p className="text-sm font-bold text-foreground uppercase tracking-widest">{selectedLog?.tableName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">ID del Registro</p>
              <p className="text-sm font-mono font-bold text-primary">{selectedLog?.recordId}</p>
            </div>
            <div className="col-span-2 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Resumen de Cambios</p>
              <div className="bg-muted/30 p-4 border border-border/10 rounded-sm space-y-2">
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedLog ? formatSummary(selectedLog.changesSummary) : ""}
                </p>
                {selectedLog?.changesSummary && (
                  <p className="text-[10px] font-mono text-muted-foreground/50 break-all">
                    {selectedLog.changesSummary}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pt-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Dirección IP</p>
              <p className="text-xs font-mono text-foreground">{selectedLog?.ipAddress}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Dispositivo / Navegador</p>
              <p className="text-xs text-foreground">{selectedLog?.userAgent}</p>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/10 flex gap-4">
          <Button variant="outline" className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
            <FileJson className="w-4 h-4" />
            Ver JSON Completo
          </Button>
          <Button variant="outline" className="flex-1 border-border/50 text-muted-foreground hover:bg-accent/50 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
            <Eye className="w-4 h-4" />
            Ver Registro Afectado
          </Button>
        </div>
      </DetailModal>
    </motion.div>
  );
}
