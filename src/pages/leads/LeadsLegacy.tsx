import * as React from "react";
import {
  User,
  Plus,
  UserCheck,
  UserPlus,
  TrendingUp,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DetailModal, InlineEditField, InlineEditPhoneField, InlineEditDateField } from "@/components/shared/DetailModal";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { formatSentenceCase } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricData } from "@/components/shared/MetricsGrid";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { StatusBadge } from "@/components/ui/status-badge";
import { parseISO } from "date-fns";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { useLeads, LeadFilters } from "@/hooks/useLeads";
import { ResourceListPage, ResourceQueryResult } from "@/components/shared/ResourceListPage";
import { Lead, columns, statusMap, urgencyMap } from "./LeadsColumns";

function useLeadsQuery(
  search: string,
  pagination: { pageIndex: number; pageSize: number },
  hookParams?: unknown
): ResourceQueryResult<Lead> {
  const params = hookParams as LeadFilters | undefined;
  const { leads: data, isLoading, totalCount, archiveLeads, restoreLeads } = useLeads(search, pagination, params);
  // When viewing archived, the bulk action restores; otherwise it archives.
  const deleteItems = params?.onlyArchived ? restoreLeads : archiveLeads;
  return { data, isLoading, totalCount, deleteItems };
}

export default function LeadsLegacyPage() {
  const navigate = useNavigate();
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [filters, setFilters] = React.useState<LeadFilters>({
    status: [],
    urgency: [],
    city: "",
    dateFrom: "",
    dateTo: "",
    onlyArchived: false,
  });

  const metrics = React.useMemo<MetricData[]>(() => [
    { title: formatSentenceCase("Total solicitudes"), value: 0, description: formatSentenceCase("Leads registrados"), icon: Zap, trend: "neutral", color: "blue" },
    { title: formatSentenceCase("Nuevas hoy"), value: 3, description: formatSentenceCase("Últimas 24h"), icon: UserPlus, trend: "up", color: "green" },
    { title: formatSentenceCase("En proceso"), value: 0, description: formatSentenceCase("Revisiones activas"), icon: UserCheck, trend: "neutral", color: "purple" },
    { title: formatSentenceCase("Efectividad"), value: "18%", description: formatSentenceCase("Cierre de leads"), icon: TrendingUp, trend: "up", color: "yellow" },
  ], []);

  const toggleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status) ? prev.status.filter(s => s !== status) : [...prev.status, status]
    }));
  };

  const toggleUrgencyFilter = (urgency: string) => {
    setFilters(prev => ({
      ...prev,
      urgency: prev.urgency.includes(urgency) ? prev.urgency.filter(u => u !== urgency) : [...prev.urgency, urgency]
    }));
  };

  const clearFilters = () => {
    setFilters({ status: [], urgency: [], city: "", dateFrom: "", dateTo: "", onlyArchived: false });
  };

  const toggleOnlyArchived = () => {
    setFilters(prev => ({ ...prev, onlyArchived: !prev.onlyArchived }));
  };

  const isFiltered = filters.status.length > 0 || filters.urgency.length > 0 || !!filters.city || !!filters.dateFrom || !!filters.dateTo || !!filters.onlyArchived;

  const handleSaveField = async (field: keyof Lead, value: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    notify.success("Campo actualizado", `Solicitud: ${field} actualizado.`);
  };

  return (
    <ResourceListPage<Lead>
      title="GESTIÓN DE SOLICITUDES (LEADS)"
      subtitle="Embudo de entrada y prospección de nuevos clientes."
      icon={Zap}
      onBack={() => navigate("/")}
      createLabel="Nuevo lead"
      onCreateClick={() => navigate("/solicitudes/leads/new")}
      useQueryHook={useLeadsQuery}
      hookParams={filters}
      columns={columns}
      searchPlaceholder="Buscar solicitudes por nombre, email o teléfono..."
      metrics={metrics}
      metricsCount={4}
      filterTitle="Filtros de leads"
      filterDescription="Segmenta tus solicitudes por estado, urgencia o fecha."
      filterContent={
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Vista")}</label>
            <Button
              variant={filters.onlyArchived ? "default" : "outline"}
              onClick={toggleOnlyArchived}
              className={cn(
                "w-full text-[10px] font-bold h-10 rounded-none border-border/30 justify-start gap-2",
                filters.onlyArchived ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", filters.onlyArchived ? "bg-white" : "bg-muted-foreground")} />
              {formatSentenceCase(filters.onlyArchived ? "Mostrando solo archivados" : "Mostrar archivados")}
            </Button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Estado")}</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusMap).map(([key, { label }]) => (
                <Button
                  key={key}
                  variant={filters.status.includes(key) ? "default" : "outline"}
                  onClick={() => toggleStatusFilter(key)}
                  className={cn(
                    "text-[10px] font-bold h-10 rounded-none border-border/30",
                    filters.status.includes(key) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                  )}
                >
                  {formatSentenceCase(label)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Urgencia")}</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(urgencyMap).map(([key, { label, dot }]) => (
                <Button
                  key={key}
                  variant={filters.urgency.includes(key) ? "default" : "outline"}
                  onClick={() => toggleUrgencyFilter(key)}
                  className={cn(
                    "text-[10px] font-bold h-10 rounded-none border-border/30 gap-2",
                    filters.urgency.includes(key) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", filters.urgency.includes(key) ? "bg-white" : dot)} />
                  {formatSentenceCase(label)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Ciudad")}</label>
            <Input
              placeholder={formatSentenceCase("Ej. Bogotá")}
              value={filters.city}
              onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
              className="bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Fecha de llegada")}</label>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Desde")}</p>
                <CalendarPopover
                  selected={filters.dateFrom ? parseISO(filters.dateFrom) : undefined}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date ? date.toISOString().split('T')[0] : "" }))}
                  className="w-full text-xs"
                  placeholder={formatSentenceCase("Desde")}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Hasta")}</p>
                <CalendarPopover
                  selected={filters.dateTo ? parseISO(filters.dateTo) : undefined}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date ? date.toISOString().split('T')[0] : "" }))}
                  className="w-full text-xs"
                  placeholder={formatSentenceCase("Hasta")}
                />
              </div>
            </div>
          </div>
        </div>
      }
      isFiltered={isFiltered}
      onClearFilters={clearFilters}
      onRowClick={setSelectedLead}
      deleteTitle={filters.onlyArchived ? "¿Restaurar solicitudes?" : "¿Archivar solicitudes?"}
      deleteDescription={(count) =>
        filters.onlyArchived
          ? `Vas a restaurar ${count} solicitud(es). Volverán a aparecer en el listado activo.`
          : `Vas a archivar ${count} solicitud(es). Se ocultan del listado pero se conservan y podés recuperarlas en cualquier momento desde el filtro 'Mostrar archivados'.`
      }
      deleteConfirmText={filters.onlyArchived ? "Restaurar" : "Archivar"}
      deleteButtonLabel={filters.onlyArchived ? "Restaurar" : "Archivar"}
      emptyTitle="No hay información actual"
      emptyDescription="No se encontraron solicitudes que coincidan con los filtros actuales. Comienza creando un nuevo lead."
    >
      <DetailModal
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
        title={selectedLead?.name || ""}
        icon={Zap}
        subtitle={formatSentenceCase(`CONFIGURACIÓN > SOLICITUDES > ${selectedLead?.name}`)}
        status={{
          label: formatSentenceCase(statusMap[selectedLead?.status || "pending"]?.label || "Nuevo"),
          variant: statusMap[selectedLead?.status || "pending"]?.variant || statusMap.pending.variant
        }}
        editHref={selectedLead ? `/solicitudes/leads/${selectedLead.id}/edit` : undefined}
        onNavigate={navigate}
        footer={
          <div className="flex gap-4 w-full">
            <Button
              variant="outline"
              className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 font-bold text-[10px] h-12 rounded-none"
              onClick={() => {
                if (selectedLead) notify.error("Acción", "Use la tabla para eliminar registros.");
              }}
            >
              {formatSentenceCase("Eliminar solicitud")}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold text-[10px] h-12 rounded-none"
              onClick={() => {
                navigate(`/solicitudes/leads/${selectedLead?.id}/edit`);
                setSelectedLead(null);
              }}
            >
              {formatSentenceCase("Editar información")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <User className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground">{formatSentenceCase("Datos de contacto")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-12">
              <InlineEditPhoneField
                label={formatSentenceCase("WhatsApp / teléfono")}
                value={selectedLead?.whatsapp_phone || ""}
                onSave={(v) => handleSaveField("whatsapp_phone", v)}
              />
              <InlineEditField
                label={formatSentenceCase("Correo electrónico")}
                value={selectedLead?.email || ""}
                type="email"
                onSave={(v) => handleSaveField("email", v)}
              />
              <div className="col-span-2">
                <InlineEditField
                  label={formatSentenceCase("Dirección para visita técnica")}
                  value={selectedLead?.address || ""}
                  onSave={(v) => handleSaveField("address", v)}
                />
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground">{formatSentenceCase("Información del proyecto")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-12">
              <InlineEditField
                label={formatSentenceCase("Servicios de interés")}
                value={(() => {
                  const s = selectedLead?.services;
                  if (Array.isArray(s)) return s.join(", ");
                  if (typeof s === "string") return s;
                  return formatSentenceCase("No especificado");
                })()}
                onSave={(v) => handleSaveField("services", v)}
              />
              <InlineEditField
                label={formatSentenceCase("Ciudad / zona")}
                value={selectedLead?.city || (typeof selectedLead?.address === "string" ? selectedLead.address.split(",")[0] : "") || "---"}
                onSave={(v) => handleSaveField("city", v)}
              />
              <InlineEditField
                label={formatSentenceCase("Prioridad / Urgencia")}
                value={selectedLead?.urgency || ""}
                displayValue={(() => {
                  const u = selectedLead?.urgency as string | undefined;
                  if (!u) return <span className="text-sm font-bold text-muted-foreground italic">{formatSentenceCase("Normal / No definida")}</span>;
                  const normalizedKey = u === "ASAP" ? "high" : u === "SHORT" ? "medium" : u === "LON" ? "low" : u;
                  const config = urgencyMap[normalizedKey] || { label: u, variant: "info" };
                  return (
                    <StatusBadge variant={config.variant as any} dot animate={normalizedKey === "high" ? "pulse" : "scale"} className="py-1">
                      {normalizedKey === "high" ? "Alta / Lo antes posible" : normalizedKey === "medium" ? "Media / Mediano plazo" : normalizedKey === "low" ? "Baja / Solo averiguando" : config.label}
                    </StatusBadge>
                  );
                })()}
                onSave={(v) => handleSaveField("urgency", v)}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <UserCheck className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground">{formatSentenceCase("Asignación comercial")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-12">
              <InlineEditField
                label={formatSentenceCase("Asignado a")}
                value={selectedLead?.assigned_to || formatSentenceCase("Sin asignar")}
                onSave={(v) => handleSaveField("assigned_to", v)}
              />
              <InlineEditDateField
                label={formatSentenceCase("Fecha de asignación")}
                value={selectedLead?.assigned_at || ""}
                onSave={(v) => handleSaveField("assigned_at", v)}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-12 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Fecha de creación")}</p>
              <DateDisplay date={selectedLead?.created_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Última actualización")}</p>
              <DateDisplay date={selectedLead?.updated_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4 text-muted-foreground/60" />
            </div>
          </div>

          <div className="pt-8 block">
            <PrimaryButton
              onClick={() => {
                if (!selectedLead) return;
                const servicesString = Array.isArray(selectedLead?.services)
                  ? selectedLead.services.join("").toLowerCase()
                  : (selectedLead?.services || "").toLowerCase();
                const typeParam = servicesString.includes("cocina") ? "cocina" : "general";
                navigate(`/quotations/new?client_id=${selectedLead.id}&type=${typeParam}`);
              }}
              label="Ir a Generar Cotización Técnica"
              icon={Plus}
              className="w-full h-14 rounded-none"
            />
          </div>
        </div>
      </DetailModal>
    </ResourceListPage>
  );
}
