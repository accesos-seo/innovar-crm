import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
import { withTimeout } from "@/lib/timeout";
import { EmptyState } from "@/components/shared/EmptyState";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  tableName: string;
  recordId: string;
  changesSummary: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

const actionMap: Record<AuditLog['action'], { label: string; color: string }> = {
  create: { label: "Creación", color: "bg-emerald-500/10 text-emerald-500" },
  update: { label: "Edición", color: "bg-blue-500/10 text-blue-500" },
  delete: { label: "Eliminación", color: "bg-destructive/10 text-destructive" },
  restore: { label: "Restauración", color: "bg-purple-500/10 text-purple-500" },
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
        {actionMap[row.original.action].label}
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
    cell: ({ row }) => <span className="text-xs text-foreground truncate max-w-[300px]">{row.original.changesSummary}</span>,
  },
];

export default function AuditSettingsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null);

  const metrics: MetricData[] = [
    { title: "Eventos Totales", value: logs.length, description: "Historial acumulado", icon: Activity, trend: "up", color: "blue" },
    { title: "Cambios Críticos", value: logs.filter(l => l.action === 'delete').length, description: "Eliminaciones", icon: ShieldCheck, trend: "neutral", color: "purple" },
    { title: "Tablas Afectadas", value: new Set(logs.map(l => l.tableName)).size, description: "Módulos activos", icon: Database, trend: "neutral", color: "green" },
    { title: "Usuarios Activos", value: new Set(logs.map(l => l.userId)).size, description: "Realizando cambios", icon: User, trend: "up", color: "yellow" },
  ];

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      if (!supabase) {
        setLogs([]);
        return;
      }
      
      const query = supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      const response = await withTimeout(query as any);
      const { data, error } = response as any;

      if (error) {
        toast.error("Error de auditoría", { description: "No se pudieron obtener los registros de auditoría." });
        setLogs([]);
        return;
      }
      setLogs(data || []);
    } catch (error: any) {
      toast.error("Error inesperado", { description: "Tiempo de espera agotado al recuperar historial." });
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogs();
  }, []);

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
          onClick: () => toast.success("Exportando auditoría en formato CSV...")
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
            data={logs}
            isLoading={isLoading}
            totalCount={logs.length}
            pageCount={1}
            pageIndex={0}
            pageSize={10}
            onPageChange={() => {}}
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
                {selectedLog ? actionMap[selectedLog.action].label : ""}
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
              <div className="bg-muted/30 p-4 border border-border/10 rounded-sm">
                <p className="text-sm text-foreground leading-relaxed">{selectedLog?.changesSummary}</p>
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
