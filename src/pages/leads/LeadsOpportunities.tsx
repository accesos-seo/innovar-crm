import * as React from "react";
import {
  Zap,
  UserCheck,
  UserPlus,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSentenceCase } from "@/lib/format-utils";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { MetricData } from "@/components/shared/MetricsGrid";
import { parseISO } from "date-fns";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import {
  useOpportunities,
  type OpportunityFilters,
  type OpportunityWithClient,
} from "@/hooks/useOpportunities";
import {
  ResourceListPage,
  ResourceQueryResult,
} from "@/components/shared/ResourceListPage";
import { opportunityColumns } from "./OpportunityColumns";
import {
  OPPORTUNITY_PRIORITIES,
  OPPORTUNITY_STATUSES,
  opportunityPriorityConfig,
  opportunityStatusConfig,
  type OpportunityPriority,
  type OpportunityStatus,
} from "@/schemas/opportunity";
import { OpportunityDetail } from "@/pages/opportunities/OpportunityDetail";

function useOpportunitiesQuery(
  search: string,
  pagination: { pageIndex: number; pageSize: number },
  hookParams?: unknown,
): ResourceQueryResult<OpportunityWithClient> {
  const params = hookParams as OpportunityFilters | undefined;
  const {
    opportunities,
    isLoading,
    totalCount,
    archiveOpportunities,
    restoreOpportunities,
  } = useOpportunities(search, pagination, params);

  const deleteItems = params?.onlyArchived
    ? restoreOpportunities
    : archiveOpportunities;

  return { data: opportunities, isLoading, totalCount, deleteItems };
}

export default function LeadsOpportunitiesPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<OpportunityFilters>({
    status: [],
    priority: [],
    city: "",
    dateFrom: "",
    dateTo: "",
    onlyArchived: false,
  });

  const metrics = React.useMemo<MetricData[]>(
    () => [
      {
        title: formatSentenceCase("Oportunidades activas"),
        value: 0,
        description: formatSentenceCase("Pipeline en curso"),
        icon: Zap,
        trend: "neutral",
        color: "blue",
      },
      {
        title: formatSentenceCase("Nuevas hoy"),
        value: 0,
        description: formatSentenceCase("Últimas 24h"),
        icon: UserPlus,
        trend: "up",
        color: "green",
      },
      {
        title: formatSentenceCase("Cotizadas"),
        value: 0,
        description: formatSentenceCase("En etapa de presupuesto"),
        icon: UserCheck,
        trend: "neutral",
        color: "purple",
      },
      {
        title: formatSentenceCase("Conversión"),
        value: "—",
        description: formatSentenceCase("Won / lost ratio"),
        icon: TrendingUp,
        trend: "up",
        color: "yellow",
      },
    ],
    [],
  );

  const toggleStatus = (s: OpportunityStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status?.includes(s)
        ? prev.status.filter((x) => x !== s)
        : [...(prev.status || []), s],
    }));
  };

  const togglePriority = (p: OpportunityPriority) => {
    setFilters((prev) => ({
      ...prev,
      priority: prev.priority?.includes(p)
        ? prev.priority.filter((x) => x !== p)
        : [...(prev.priority || []), p],
    }));
  };

  const clearFilters = () =>
    setFilters({
      status: [],
      priority: [],
      city: "",
      dateFrom: "",
      dateTo: "",
      onlyArchived: false,
    });

  const toggleOnlyArchived = () =>
    setFilters((prev) => ({ ...prev, onlyArchived: !prev.onlyArchived }));

  const isFiltered =
    (filters.status?.length ?? 0) > 0 ||
    (filters.priority?.length ?? 0) > 0 ||
    !!filters.city ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.onlyArchived;

  return (
    <>
      <ResourceListPage<OpportunityWithClient>
        title="GESTIÓN DE OPORTUNIDADES"
        subtitle="Embudo comercial: del prospecto al proyecto."
        icon={Zap}
        onBack={() => navigate("/")}
        createLabel="Nueva oportunidad"
        onCreateClick={() => navigate("/solicitudes/leads/new")}
        useQueryHook={useOpportunitiesQuery}
        hookParams={filters}
        columns={opportunityColumns}
        searchPlaceholder="Buscar por cliente, teléfono, ciudad o notas..."
        metrics={metrics}
        metricsCount={4}
        filterTitle="Filtros de oportunidades"
        filterDescription="Segmenta por etapa, prioridad o fecha."
        filterContent={
          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">
                {formatSentenceCase("Vista")}
              </label>
              <Button
                variant={filters.onlyArchived ? "default" : "outline"}
                onClick={toggleOnlyArchived}
                className={cn(
                  "w-full text-[10px] font-bold h-10 rounded-none border-border/30 justify-start gap-2",
                  filters.onlyArchived
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    filters.onlyArchived ? "bg-white" : "bg-muted-foreground",
                  )}
                />
                {formatSentenceCase(
                  filters.onlyArchived
                    ? "Mostrando archivadas"
                    : "Mostrar archivadas",
                )}
              </Button>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">
                {formatSentenceCase("Estado")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {OPPORTUNITY_STATUSES.map((s) => (
                  <Button
                    key={s}
                    variant={filters.status?.includes(s) ? "default" : "outline"}
                    onClick={() => toggleStatus(s)}
                    className={cn(
                      "text-[10px] font-bold h-10 rounded-none border-border/30",
                      filters.status?.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatSentenceCase(opportunityStatusConfig[s].label)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">
                {formatSentenceCase("Urgencia")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {OPPORTUNITY_PRIORITIES.map((p) => (
                  <Button
                    key={p}
                    variant={
                      filters.priority?.includes(p) ? "default" : "outline"
                    }
                    onClick={() => togglePriority(p)}
                    className={cn(
                      "text-[10px] font-bold h-10 rounded-none border-border/30 gap-2",
                      filters.priority?.includes(p)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        filters.priority?.includes(p)
                          ? "bg-white"
                          : opportunityPriorityConfig[p].dot,
                      )}
                    />
                    {formatSentenceCase(opportunityPriorityConfig[p].label)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground">
                {formatSentenceCase("Ciudad")}
              </label>
              <Input
                placeholder={formatSentenceCase("Ej. Pereira")}
                value={filters.city}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, city: e.target.value }))
                }
                className="bg-background border-border/50 h-10 rounded-none focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground">
                {formatSentenceCase("Fecha de creación")}
              </label>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">
                    {formatSentenceCase("Desde")}
                  </p>
                  <CalendarPopover
                    selected={
                      filters.dateFrom ? parseISO(filters.dateFrom) : undefined
                    }
                    onSelect={(date) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateFrom: date
                          ? date.toISOString().split("T")[0]
                          : "",
                      }))
                    }
                    className="w-full text-xs"
                    placeholder={formatSentenceCase("Desde")}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-muted-foreground tracking-widest">
                    {formatSentenceCase("Hasta")}
                  </p>
                  <CalendarPopover
                    selected={
                      filters.dateTo ? parseISO(filters.dateTo) : undefined
                    }
                    onSelect={(date) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateTo: date ? date.toISOString().split("T")[0] : "",
                      }))
                    }
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
        onRowClick={(row) => setSelectedId(row.id)}
        deleteTitle={
          filters.onlyArchived
            ? "¿Restaurar oportunidades?"
            : "¿Archivar oportunidades?"
        }
        deleteDescription={(count) =>
          filters.onlyArchived
            ? `Vas a restaurar ${count} oportunidad(es). Volverán a aparecer en el listado activo.`
            : `Vas a archivar ${count} oportunidad(es). Se ocultan del listado pero se conservan y podés recuperarlas desde el filtro 'Mostrar archivadas'.`
        }
        deleteConfirmText={filters.onlyArchived ? "Restaurar" : "Archivar"}
        deleteButtonLabel={filters.onlyArchived ? "Restaurar" : "Archivar"}
        deleteVariant={filters.onlyArchived ? "default" : "warning"}
        emptyTitle="No hay oportunidades"
        emptyDescription="No se encontraron oportunidades que coincidan con los filtros actuales. Crea una nueva oportunidad."
      />

      <OpportunityDetail
        opportunityId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
