
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { 
  MessageSquare, 
  Search, 
  Filter, 
  RefreshCw, 
  Zap, 
  Send, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  Database,
  Info,
  Calendar,
  History,
  Activity,
  FileText
} from "lucide-react";

import { formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";

import { useWhatsApp, useWhatsAppEvents } from "@/hooks/useWhatsApp";
import { columns, statusMap, deliveryStatusMap } from "./whatsapp/WhatsAppColumns";
import { NotificationQueueRow, MetaWhatsappStatusEvent } from "@/types/whatsapp";

import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { DataTable } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { DetailModal } from "@/components/shared/DetailModal";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateDisplay } from "@/components/shared/DateDisplay";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PremiumToaster, notify } from "@/components/ui/PremiumToast";
import { formatSentenceCase, formatDateTime, formatPhone } from "@/lib/format-utils";
import { cn } from "@/lib/utils";

export default function WhatsAppSettingsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedMessage, setSelectedMessage] = React.useState<NotificationQueueRow | null>(null);

  // Filter States
  const [filters, setFilters] = React.useState({
    status: "" as string,
    delivery_status: "" as string
  });

  const { 
    messages, 
    totalCount, 
    isLoading, 
    isProcessing, 
    processMessages, 
    refresh 
  } = useWhatsApp({
    status: filters.status,
    delivery_status: filters.delivery_status,
    searchTerm: debouncedSearch
  });

  const paginatedMessages = React.useMemo(
    () => messages.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [messages, pageIndex, pageSize]
  );

  const metrics: MetricData[] = React.useMemo(() => [
    { 
      title: formatSentenceCase("Total Mensajes"), 
      value: totalCount, 
      description: formatSentenceCase("En cola general"), 
      icon: MessageSquare, 
      trend: "neutral", 
      color: "blue" 
    },
    { 
      title: formatSentenceCase("Pendientes"), 
      value: messages.filter(m => m.status === 'pending').length, 
      description: formatSentenceCase("Por procesar"), 
      icon: Clock, 
      trend: "neutral", 
      color: "yellow" 
    },
    { 
      title: formatSentenceCase("Entregados"), 
      value: messages.filter(m => m.delivery_status === 'delivered' || m.delivery_status === 'read').length, 
      description: formatSentenceCase("Éxito en Meta"), 
      icon: Zap, 
      trend: "up", 
      color: "green" 
    },
    { 
      title: formatSentenceCase("Fallidos"), 
      value: messages.filter(m => m.status === 'failed' || m.delivery_status === 'failed').length, 
      description: formatSentenceCase("Error de envío"), 
      icon: AlertCircle, 
      trend: "down", 
      color: "red" 
    },
  ], [totalCount, messages]);

  const clearFilters = () => {
    setFilters({
      status: "",
      delivery_status: ""
    });
  };

  const handleProcess = async () => {
    try {
      await processMessages({ dry_run: false, limit: 25 });
    } catch (err) {
      // Error handled by mutation
    }
  };

  const isFiltered = filters.status || filters.delivery_status;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8 pb-20">
      <CategoryHeader 
        title={formatSentenceCase("NOTIFICACIONES WHATSAPP")}
        subtitle={formatSentenceCase("Monitoreo en tiempo real de la cola de envíos y estados de Meta.")}
        icon={MessageSquare}
        onBack={() => navigate("/settings")}
        action={{
          label: formatSentenceCase(isProcessing ? "Procesando..." : "Procesar Pendientes"),
          icon: isProcessing ? RefreshCw : Send,
          onClick: handleProcess,
          className: isProcessing ? "opacity-50 pointer-events-none" : ""
        }}
      />

      {isLoading ? (
        <MetricGridSkeleton />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar por teléfono, nombre o ID de Meta...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros de WhatsApp")}
          description={formatSentenceCase("Filtra la cola de notificaciones por estado de procesamiento o entrega.")}
          onApply={() => refresh()}
          onClear={clearFilters}
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Estado de la cola")}</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusMap).map(([key, { label }]) => (
                  <Button 
                    key={key} 
                    variant={filters.status === key ? "default" : "outline"}
                    onClick={() => setFilters(prev => ({ ...prev, status: prev.status === key ? "" : key }))}
                    className={cn(
                      "text-[10px] font-bold h-10 rounded-none border-border/30",
                      filters.status === key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatSentenceCase(label)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatSentenceCase("Estado de entrega Meta")}</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(deliveryStatusMap).map(([key, { label }]) => (
                  <Button 
                    key={key} 
                    variant={filters.delivery_status === key ? "default" : "outline"}
                    onClick={() => setFilters(prev => ({ ...prev, delivery_status: prev.delivery_status === key ? "" : key }))}
                    className={cn(
                      "text-[10px] font-bold h-10 rounded-none border-border/30",
                      filters.delivery_status === key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                    )}
                  >
                    {formatSentenceCase(label)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </FilterSheet>

        {(searchTerm || isFiltered) && (
          <Button 
            variant="ghost" 
            onClick={() => {
              setSearchTerm("");
              clearFilters();
            }}
            className="text-xs font-bold text-primary"
          >
            {formatSentenceCase("Limpiar búsqueda")}
          </Button>
        )}

        <div className="flex-1" />
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => refresh()}
          className="h-10 w-10 border-border/50 text-muted-foreground hover:text-primary transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={paginatedMessages}
        isLoading={isLoading}
        totalCount={totalCount}
        pageCount={Math.max(1, Math.ceil(totalCount / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedMessage}
        emptyMessage={
          <EmptyState 
            title="Cola de mensajes vacía"
            description="No se encontraron registros que coincidan con los criterios actuales."
            icon={MessageSquare}
          />
        }
      />

      <DetailModal
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
        title={selectedMessage?.recipient_name || "Detalle del Mensaje"}
        icon={MessageSquare}
        subtitle={formatSentenceCase(`WHATSAPP > TRAZABILIDAD > ID: ${selectedMessage?.id.slice(0, 8)}`)}
        status={{ 
          label: formatSentenceCase(statusMap[selectedMessage?.status || "pending"]?.label || "Pendiente"), 
          variant: (statusMap[selectedMessage?.status || "pending"]?.variant as any) || "warning"
        }}
        onNavigate={navigate}
      >
        <WhatsAppDetail message={selectedMessage} />
      </DetailModal>
    </div>
  );
}

function WhatsAppDetail({ message }: { message: NotificationQueueRow | null }) {
  if (!message) return null;

  const { data: events, isLoading: isLoadingEvents } = useWhatsAppEvents(message.provider_message_id);

  return (
    <div className="flex flex-col space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* SECCIÓN 1: DATOS GENERALES */}
      <div className="grid grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight italic">Información Base</h3>
          </div>
          <div className="space-y-6 bg-muted/5 p-6 border border-border/10">
            <DetailItem label="Destinatario" value={message.recipient_name} />
            <DetailItem label="Teléfono" value={formatPhone(message.recipient_phone)} />
            <DetailItem label="Evento" value={formatSentenceCase(message.event_type.replace(/_/g, ' '))} />
            <DetailItem 
              label="Plantilla" 
              value={
                <Badge variant="outline" className="text-[10px] font-black tracking-widest border-primary/20 text-primary">
                  {message.template_name} ({message.template_language})
                </Badge>
              } 
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase tracking-tight italic">Estado y Trazabilidad</h3>
          </div>
          <div className="space-y-6 bg-muted/5 p-6 border border-border/10">
            <DetailItem label="Provider Message ID" value={message.provider_message_id || "N/A"} className="font-mono text-[11px]" />
            <DetailItem 
              label="Estado Entrega Meta" 
              value={message.delivery_status ? (
                <StatusBadge variant={(deliveryStatusMap[message.delivery_status]?.variant as any) || "primary"} dot className="text-[10px] font-black">
                  {formatSentenceCase(deliveryStatusMap[message.delivery_status]?.label || message.delivery_status)}
                </StatusBadge>
              ) : "N/A"} 
            />
            <DetailItem label="Intentos" value={message.attempt_count.toString()} />
            <DetailItem 
              label="Última Actualización Meta" 
              value={message.last_delivery_status_at ? formatDateTime(message.last_delivery_status_at) : "N/A"} 
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: LÍNEA DE TIEMPO INTERNA */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-black text-foreground uppercase tracking-tight italic">Cronología del Sistema</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <TimeMetric label="Creado" date={message.created_at} active />
          <TimeMetric label="Procesado" date={message.processing_at} active={!!message.processing_at} />
          <TimeMetric label="Enviado" date={message.sent_at} active={!!message.sent_at} />
          <TimeMetric 
            label="Hora de entrega" 
            date={message.delivered_at} 
            active={!!message.delivered_at} 
            variant="success"
            subtitle={
              message.sent_at && message.delivered_at ? 
              `Tardó ${formatDistanceStrict(new Date(message.sent_at), new Date(message.delivered_at), { locale: es })}` : 
              undefined
            }
          />
        </div>
      </div>

      {/* SECCIÓN 3: EVENTOS DE META */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-black text-foreground uppercase tracking-tight italic">Eventos de Webhook (Meta)</h3>
        </div>
        
        {isLoadingEvents ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/20 animate-pulse border border-border/10" />)}
          </div>
        ) : events && events.length > 0 ? (
          <div className="border border-border/10 overflow-hidden divide-y divide-border/10">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-4 bg-muted/5 hover:bg-muted/10 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    event.status === 'read' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                    event.status === 'delivered' ? "bg-primary shadow-[0_0_8px_rgba(0,255,200,0.5)]" :
                    event.status === 'failed' ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-blue-500"
                  )} />
                  <span className="text-[10px] font-black uppercase text-foreground tracking-wider">{event.status}</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-muted-foreground">{formatDateTime(event.status_timestamp)}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <FileText className="w-3 h-3 text-primary cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-black/90 p-4 max-w-xs overflow-auto font-mono text-[10px] border-primary/20">
                          <pre>{JSON.stringify(event.raw_payload, null, 2)}</pre>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-muted/5 p-8 border border-border/10 flex flex-col items-center justify-center text-center opacity-50 italic">
            <Database className="w-10 h-10 mb-4 opacity-10" />
            <p className="text-xs font-bold text-muted-foreground">Esperando confirmación de eventos por parte de Meta...</p>
          </div>
        )}
      </div>

      {/* SECCIÓN 4: DIAGNÓSTICO DE ERRORES */}
      {(message.error_message || message.failed_reason) && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-destructive pl-4 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <h3 className="text-xs font-black uppercase tracking-tight italic">Diagnóstico de Error</h3>
          </div>
          <div className="bg-destructive/10 p-6 border border-destructive/20 space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-destructive tracking-[0.2em]">Mensaje de Error</p>
              <p className="text-sm font-bold text-foreground leading-relaxed">{message.error_message || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-destructive tracking-[0.2em]">Razón Técnica</p>
              <p className="text-xs font-mono bg-black/20 p-4 rounded-sm border border-destructive/10 overflow-auto">{message.failed_reason || "No se especificó razón técnica adicional."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className={cn("text-xs font-bold text-foreground", className)}>
        {value || "---"}
      </div>
    </div>
  );
}

function TimeMetric({ label, date, active, variant = "primary", subtitle }: { label: string; date: string | null; active: boolean; variant?: "primary" | "success" | "error"; subtitle?: string }) {
  return (
    <div className={cn(
      "p-4 border transition-all relative overflow-hidden h-full flex flex-col justify-between",
      active ? (
        variant === "success" ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
        variant === "error" ? "bg-destructive/10 border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]" :
        "bg-primary/10 border-primary/20 shadow-[0_0_15px_rgba(0,255,200,0.1)]"
      ) : "bg-muted/5 border-border/10 opacity-40"
    )}>
      <div>
        <p className={cn(
          "text-[9px] font-black uppercase tracking-widest mb-1",
          active ? (
            variant === "success" ? "text-emerald-400" :
            variant === "error" ? "text-destructive" :
            "text-primary"
          ) : "text-muted-foreground"
        )}>{label}</p>
        <p className="text-xs font-black text-foreground tabular-nums">
          {date ? formatDateTime(date) : "---"}
        </p>
        {subtitle && (
          <p className="text-[10px] font-bold text-muted-foreground mt-2 italic transition-all group-hover:text-primary">
            {subtitle}
          </p>
        )}
      </div>
      {active && (
        <div className={cn(
          "absolute -right-2 -bottom-2 opacity-10",
          variant === "success" ? "text-emerald-500" :
          variant === "error" ? "text-destructive" : "text-primary"
        )}>
          <Clock className="w-12 h-12" />
        </div>
      )}
    </div>
  );
}

import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
