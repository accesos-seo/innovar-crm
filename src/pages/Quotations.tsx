import * as React from "react";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  FileText,
  Plus, 
  Search, 
  User,
  History,
  TrendingUp,
  FileCheck,
  FileWarning,
  FileSearch,
  Zap
} from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Quotation, QuotationStatus } from "@/types/database";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "use-debounce";
import { DetailModal, InlineEditField, InlineEditPhoneField, InlineEditDateField } from "@/components/shared/DetailModal";
import { formatDate, formatDateTime, formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DeleteFlow } from "@/components/shared/DeleteFlow";
import { notify } from "@/components/ui/PremiumToast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrimaryButton } from "@/components/shared/PrimaryButton";

import { useQuotations } from "@/hooks/useQuotations";

import { statusMap, columns } from "./quotations/QuotationsColumns";

import { FilterSheet } from "@/components/shared/FilterSheet";

export default function QuotationsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedQuotation, setSelectedQuotation] = React.useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [quotationsToDelete, setQuotationsToDelete] = React.useState<any[]>([]);

  // Filter States
  const [filters, setFilters] = React.useState({
    status: [] as string[],
    dateFrom: "" as string,
    dateTo: "" as string
  });

  const { data, isLoading, isError, error } = useQuotations(
    filters.status.length > 0 ? { status: filters.status[0] } : undefined
  );

  React.useEffect(() => {
    if (isError) {
      notify.error("Error de conexión", error?.message || "No se pudieron cargar las cotizaciones.");
    }
  }, [isError, error]);

  const filteredData = React.useMemo(() => {
    if (!data) return [];
    return data.filter(q => {
      const matchesSearch = 
        q.id.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (q as any).client?.name?.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesDateFrom = filters.dateFrom ? new Date(q.created_at) >= new Date(filters.dateFrom) : true;
      const matchesDateTo = filters.dateTo ? new Date(q.created_at) <= new Date(filters.dateTo) : true;
      
      return matchesSearch && matchesDateFrom && matchesDateTo;
    });
  }, [data, debouncedSearch, filters]);

  const totalCount = filteredData.length;

  const paginatedData = React.useMemo(
    () => filteredData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredData, pageIndex, pageSize]
  );

  React.useEffect(() => { setPageIndex(0); }, [debouncedSearch, filters]);

  const metrics: MetricData[] = React.useMemo(() => [
    { title: formatSentenceCase("Procesadas"), value: totalCount, description: formatSentenceCase("Presupuestos activos"), icon: FileText, trend: "neutral", color: "blue" },
    { title: formatSentenceCase("Aprobadas"), value: filteredData.filter(q => q.status === "approved").length, description: formatSentenceCase("Listas para producción"), icon: FileCheck, trend: "up", color: "green" },
    { title: formatSentenceCase("En negociación"), value: filteredData.filter(q => q.status === "negotiation").length, description: formatSentenceCase("Pendientes de cierre"), icon: FileSearch, trend: "neutral", color: "purple" },
    { title: formatSentenceCase("Vencidas"), value: filteredData.filter(q => q.status === "expired" || q.status === "rejected").length, description: formatSentenceCase("Requieren revisión"), icon: FileWarning, trend: "down", color: "red" },
  ], [totalCount, filteredData]);

  const handleDelete = async () => {
    // Backend API would go here
    setQuotationsToDelete([]);
    setIsDeleteDialogOpen(false);
    notify.success("Cotizaciones eliminadas", "Los registros han sido eliminados correctamente.");
  };

  const navigate = useNavigate();

  const handleSaveField = async (field: string, value: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    notify.success("Campo actualizado", `Información actualizada.`);
  };

  const toggleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status) 
        ? prev.status.filter(s => s !== status) 
        : [...prev.status, status]
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      dateFrom: "",
      dateTo: ""
    });
  };

  const isFiltered = filters.status.length > 0 || filters.dateFrom || filters.dateTo;

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader 
        title={formatSentenceCase("GESTIÓN DE COTIZACIONES")}
        subtitle={formatSentenceCase("Embudo de negociación y conversión comercial.")}
        icon={FileText}
        onBack={() => navigate("/")}
        action={{
          label: formatSentenceCase("Nueva cotización"),
          icon: Plus,
          onClick: () => navigate("/quotations/new")
        }}
      />

      {isLoading ? (
        <MetricGridSkeleton />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar cotizaciones por cliente o referencia...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros de cotización")}
          description={formatSentenceCase("Segmenta tus propuestas por estado o fecha.")}
          onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La lista ha sido actualizada."))}
          onClear={clearFilters}
        >
          <div className="space-y-8">
            {/* Estado */}
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

            {/* Rango de Fechas */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Fecha de emisión")}</label>
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
      </div>

      <DataTable
        columns={columns}
        data={paginatedData}
        isLoading={isLoading}
        totalCount={totalCount}
        pageCount={Math.max(1, Math.ceil(totalCount / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedQuotation}
        onDeleteSelected={(rows) => {
          setQuotationsToDelete(rows);
          setIsDeleteDialogOpen(true);
        }}
        emptyMessage={
          <EmptyState 
            title="No hay información actual"
            description="No se encontraron cotizaciones que coincidan con los filtros actuales. Comienza creando una nueva cotización."
            icon={FileText}
            action={{
              label: "Crear nueva cotización",
              icon: Plus,
              onClick: () => navigate("/quotations/new")
            }}
          />
        }
      />

      <DetailModal
        open={!!selectedQuotation}
        onOpenChange={(open) => !open && setSelectedQuotation(null)}
        title={`Cotización ${selectedQuotation?.id?.split('-')[0] || ""}`}
        icon={FileText}
        subtitle={formatSentenceCase(`VENTAS > COTIZACIONES > ${selectedQuotation?.client?.name || "CLIENTE"}`)}
        status={{ 
          label: formatSentenceCase(statusMap[selectedQuotation?.status as QuotationStatus]?.label || "Borrador"), 
          variant: statusMap[selectedQuotation?.status as QuotationStatus]?.variant || statusMap.draft.variant
        }}
        editHref={selectedQuotation ? `/quotations/${selectedQuotation.id}/edit` : undefined}
        onNavigate={navigate}
        footer={
          <div className="flex gap-4 w-full">
            <Button 
              variant="outline" 
              className="flex-1 border-primary/20 text-foreground hover:bg-primary/5 font-bold text-[10px] h-12 rounded-none"
              onClick={() => {
                navigate(`/quotations/${selectedQuotation?.id}`);
                setSelectedQuotation(null);
              }}
            >
              {formatSentenceCase("Detalle completo")}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold text-[10px] h-12 rounded-none"
              onClick={() => {
                navigate(`/quotations/${selectedQuotation?.id}/edit`);
                setSelectedQuotation(null);
              }}
            >
              {formatSentenceCase("Editar información")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col space-y-12">
          {/* SECCIÓN 1: DATOS DEL CLIENTE Y PROPUESTA */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <User className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground">{formatSentenceCase("Resumen de propuesta")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-12">
              <InlineEditField
                label={formatSentenceCase("Cliente asignado")}
                value={selectedQuotation?.client?.name || ""}
                onSave={(v) => handleSaveField("client", v)}
              />
              <InlineEditField
                label={formatSentenceCase("Monto total")}
                value={`$${(selectedQuotation?.total_amount || 0).toLocaleString()}`}
                onSave={(v) => handleSaveField("total_amount", v)}
              />
              <div className="col-span-2">
                <InlineEditField
                  label={formatSentenceCase("Notas / Descripción del presupuesto")}
                  value={selectedQuotation?.notes || formatSentenceCase("---")}
                  onSave={(v) => handleSaveField("notes", v)}
                />
              </div>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          {/* SECCIÓN 2: CONTROL DE VERSIONES Y VALIDEZ */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground">{formatSentenceCase("Operativa comercial")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-12">
              <InlineEditField
                label={formatSentenceCase("Versión de documento")}
                value={`v${selectedQuotation?.version_number || 1}`}
                onSave={(v) => handleSaveField("version", v)}
              />
              <InlineEditDateField
                label={formatSentenceCase("Válido hasta")}
                value={selectedQuotation?.valid_until || ""}
                onSave={(v) => handleSaveField("valid_until", v)}
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          {/* SECCIÓN 4: AUDITORÍA */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-12 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Fecha de creación")}</p>
              <DateDisplay date={selectedQuotation?.created_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{formatSentenceCase("Última actualización")}</p>
              <DateDisplay date={selectedQuotation?.updated_at} showTime className="text-sm font-bold" iconClassName="w-4 h-4 text-muted-foreground/60" />
            </div>
          </div>
        </div>
      </DetailModal>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        isLoading={false}
        title={formatSentenceCase("¿Eliminar cotizaciones?")}
        description={formatSentenceCase(`¿Estás seguro de que deseas eliminar ${quotationsToDelete.length} cotización(es)? Esta acción no se puede deshacer.`)}
        confirmText={formatSentenceCase("Eliminar")}
        cancelText={formatSentenceCase("Cancelar")}
      />
    </div>
  );
}

