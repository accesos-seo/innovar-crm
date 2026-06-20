import * as React from "react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Plus, 
  Search, 
  TrendingUp,
  BarChart3,
  Calendar as CalendarIcon,
  PieChart,
  DollarSign,
  ArrowUpRight,
  Calculator,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce } from "use-debounce";
import { formatSentenceCase, formatCurrency } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { MetricGridSkeleton } from "@/components/shared/skeletons/MetricGridSkeleton";
import { useClosures } from "@/hooks/finanzas/useClosures";
import { AccountingClosure } from "@/types/database";
import { columns, statusMap } from "./closures/ClosuresColumns";
import { FilterSheet } from "@/components/shared/FilterSheet";
import { NewClosureModal } from "@/components/finanzas/NewClosureModal";
import { ClosureDetailPanel } from "@/components/finanzas/ClosureDetailPanel";
import { useAuthStore } from "@/store/authStore";
import { parseISO } from "date-fns";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { useClosurePeriods } from "@/hooks/finanzas/useClosurePeriods";
import { NewClosurePeriodModal } from "@/components/finanzas/NewClosurePeriodModal";
import { ClosurePeriodDetailPanel } from "@/components/finanzas/ClosurePeriodDetailPanel";

export default function CierresContablesPage() {
  const profile = useAuthStore(state => state.profile);
  const isAdmin = profile?.role === 'admin';
  const role = profile?.role;
  const canManagePeriods = role === 'admin' || role === 'super_admin';

  // Access control
  const canSee = role === 'admin' || role === 'super_admin' || role === 'comercial' || role === 'gerente';
  const canSeePeriods = role === 'admin' || role === 'super_admin' || role === 'gerente';
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 400);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [selectedClosure, setSelectedClosure] = React.useState<AccountingClosure | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isPeriodModalOpen, setIsPeriodModalOpen] = React.useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState({
    status: [] as string[],
    date_from: "",
    date_to: ""
  });

  const { data: closures = [], isLoading } = useClosures({
    status: filters.status.length > 0 ? filters.status[0] : "all",
    date_from: filters.date_from,
    date_to: filters.date_to
  });

  const navigate = useNavigate();

  const { data: periods = [] } = useClosurePeriods();

  const filteredClosures = React.useMemo(() => {
    if (!debouncedSearch) return closures;
    return closures.filter(c =>
      (c.project as any)?.name?.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [closures, debouncedSearch]);

  const paginatedClosures = React.useMemo(
    () => filteredClosures.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [filteredClosures, pageIndex, pageSize]
  );

  React.useEffect(() => { setPageIndex(0); }, [debouncedSearch, filters]);

  const metrics: MetricData[] = React.useMemo(() => {
    const totalUtilidad = filteredClosures.reduce((acc, c) => acc + (c.net_profit || 0), 0);
    const avgMargin = filteredClosures.length > 0 
      ? filteredClosures.reduce((acc, c) => acc + (c.profit_margin || 0), 0) / filteredClosures.length 
      : 0;

    return [
      { 
        title: formatSentenceCase("Cierres mes"), 
        value: filteredClosures.length.toString().padStart(2, '0'), 
        description: formatSentenceCase("Proyectos liquidados"), 
        icon: PieChart, 
        trend: "neutral", 
        color: "blue" 
      },
      { 
        title: formatSentenceCase("Margen prom"), 
        value: `${avgMargin.toFixed(1)}%`, 
        description: formatSentenceCase("Rentabilidad promedio"), 
        icon: TrendingUp, 
        trend: "up", 
        color: "green" 
      },
      { 
        title: formatSentenceCase("Utilidad mes"), 
        value: formatCurrency(totalUtilidad), 
        description: formatSentenceCase("Beneficio neto total"), 
        icon: DollarSign, 
        trend: "up", 
        color: "primary" 
      },
    ];
  }, [filteredClosures]);

  if (!canSee) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <BarChart3 className="w-12 h-12 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold tracking-tight">Acceso Restringido</h2>
        <p className="text-muted-foreground max-w-xs">No tienes permisos para visualizar el módulo de cierres contables.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Volver al Dashboard</Button>
      </div>
    );
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      date_from: "",
      date_to: ""
    });
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-8">
      <CategoryHeader 
        title={formatSentenceCase("CIERRES CONTABLES")}
        subtitle={formatSentenceCase("Cierres contables, rentabilidad y liquidación de proyectos finalizados.")}
        icon={BarChart3}
        onBack={() => navigate("/finanzas/pagos")}
        action={isAdmin ? {
          label: formatSentenceCase("Nuevo cierre"),
          icon: Plus,
          onClick: () => setIsModalOpen(true)
        } : undefined}
      />

      {isLoading && !filteredClosures.length ? (
        <MetricGridSkeleton count={3} />
      ) : (
        <MetricsGrid metrics={metrics} />
      )}

      {canSeePeriods && (
        <div className="bg-card/50 border border-border/10 rounded-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
                  {formatSentenceCase("Cierre de período")}
                </h3>
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
                  {formatSentenceCase("Utilidad neta del negocio: proyectos + gastos de bodega")}
                </p>
              </div>
            </div>
            {canManagePeriods && (
              <Button
                onClick={() => setIsPeriodModalOpen(true)}
                className="h-11 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em]"
              >
                <Plus className="w-4 h-4 mr-2" />
                {formatSentenceCase("Nuevo cierre de período")}
              </Button>
            )}
          </div>

          {periods.length === 0 ? (
            <div className="text-center py-6 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em] italic">
              {formatSentenceCase(
                canManagePeriods
                  ? "Aún no hay cierres de período. Creá el primero."
                  : "Aún no hay cierres de período."
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {periods.slice(0, 6).map((p) => {
                const meta =
                  ({
                    borrador: { label: "Borrador", dot: "bg-amber-500" },
                    confirmado: { label: "Confirmado", dot: "bg-emerald-500" },
                    revertido: { label: "Revertido", dot: "bg-destructive" },
                  } as Record<string, { label: string; dot: string }>)[p.status] || {
                    label: p.status,
                    dot: "bg-muted",
                  };
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className="text-left bg-background border border-border/10 p-4 space-y-2 hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} /> {meta.label}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground/50 tabular-nums">{p.period_end}</span>
                    </div>
                    <p
                      className={cn(
                        "text-lg font-black tabular-nums",
                        p.net_profit >= 0 ? "text-foreground" : "text-destructive"
                      )}
                    >
                      {formatCurrency(p.net_profit)}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                      {formatSentenceCase("Utilidad neta")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 items-center bg-card/50 p-4 rounded-sm border border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:border-t-primary hover:border-t-4 group">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={formatSentenceCase("Buscar proyecto...")} 
            className="pl-10 bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary font-bold"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <FilterSheet
          title={formatSentenceCase("Filtros de cierres")}
          description={formatSentenceCase("Segmenta los cierres por estado o rango de fechas.")}
          onApply={() => notify.info(formatSentenceCase("Filtros aplicados"), formatSentenceCase("La lista ha sido actualizada."))}
          onClear={clearFilters}
        >
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Estado")}</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(statusMap).map(([key, { label }]) => (
                  <Button 
                    key={key} 
                    variant={filters.status.includes(key) ? "default" : "outline"}
                    onClick={() => setFilters(prev => ({ ...prev, status: [key] }))}
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
              <label className="text-[10px] font-bold text-muted-foreground">{formatSentenceCase("Rango de fechas")}</label>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Desde")}</p>
                  <CalendarPopover
                    selected={filters.date_from ? parseISO(filters.date_from) : undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, date_from: date ? date.toISOString().split('T')[0] : "" }))}
                    className="w-full text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatSentenceCase("Hasta")}</p>
                  <CalendarPopover
                    selected={filters.date_to ? parseISO(filters.date_to) : undefined}
                    onSelect={(date) => setFilters(prev => ({ ...prev, date_to: date ? date.toISOString().split('T')[0] : "" }))}
                    className="w-full text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </FilterSheet>

        {(searchTerm || filters.status.length > 0 || filters.date_from || filters.date_to) && (
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
        data={paginatedClosures}
        isLoading={isLoading}
        totalCount={filteredClosures.length}
        pageCount={Math.max(1, Math.ceil(filteredClosures.length / pageSize))}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={setPageIndex}
        onPageSizeChange={setPageSize}
        onRowClick={setSelectedClosure}
        emptyMessage={
          <EmptyState 
            title="Sin cierres registrados"
            description="No se encontraron cierres contables. Los proyectos entregados aparecerán aquí cuando sean liquidados."
            icon={BarChart3}
            action={isAdmin ? {
              label: "Nuevo cierre contable",
              icon: Plus,
              onClick: () => setIsModalOpen(true)
            } : undefined}
          />
        }
      />

      <NewClosureModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <ClosureDetailPanel
        closure={selectedClosure}
        isOpen={!!selectedClosure}
        onClose={() => setSelectedClosure(null)}
      />

      <NewClosurePeriodModal isOpen={isPeriodModalOpen} onClose={() => setIsPeriodModalOpen(false)} />

      <ClosurePeriodDetailPanel
        periodId={selectedPeriodId}
        isOpen={!!selectedPeriodId}
        onClose={() => setSelectedPeriodId(null)}
        canManage={canManagePeriods}
      />

    </div>
  );
}

