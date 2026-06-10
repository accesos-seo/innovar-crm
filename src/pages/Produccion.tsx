import React, { useMemo, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { addDays, differenceInDays, isBefore, parseISO, subDays } from 'date-fns';
import { CalendarClock, Factory, Gauge, Hammer, TimerOff } from 'lucide-react';
import { toast } from 'sonner';
import { CategoryHeader } from '@/components/shared/CategoryHeader';
import { MetricsGrid, MetricData } from '@/components/shared/MetricsGrid';
import { EmptyState } from '@/components/shared/EmptyState';
import { PremiumLoader } from '@/components/shared/PremiumLoader';
import { FilterSheet, FilterSection, FilterOption } from '@/components/shared/FilterSheet';
import { useAuthStore } from '@/store/authStore';
import { useSetting } from '@/hooks/settings/useSystemSettings';
import { useActiveDesigners } from '@/hooks/useActiveDesigners';
import {
  PRODUCTION_COLUMNS,
  ProductionProject,
  ProductionStatus,
  useMoveProjectStatus,
  useProductionBoard,
  WA_TRIGGER_STATUSES,
  WORK_TYPE_LABELS,
} from '@/hooks/produccion/useProductionBoard';
import { ProductionKanbanColumn } from '@/components/produccion/ProductionKanbanColumn';
import { MoveConfirmDialog } from '@/components/produccion/MoveConfirmDialog';
import { WorkshopSheet } from '@/components/produccion/WorkshopSheet';

interface PendingMove {
  project: ProductionProject;
  toStatus: ProductionStatus;
}

/** Movimientos permitidos por rol (espejo de la RPC move_project_status). */
function canMove(role: string, from: ProductionStatus, to: ProductionStatus): boolean {
  if (role === 'admin' || role === 'super_admin') return true;
  if (role === 'diseno') return from === 'en_diseno' && to === 'aprobacion_final';
  if (role === 'produccion') return from === 'en_produccion' && to === 'listo_instalacion';
  return false;
}

export default function ProduccionPage() {
  const { profile } = useAuthStore();
  const role = profile?.role ?? '';

  const { data: board, isLoading, isError } = useProductionBoard();
  const moveStatus = useMoveProjectStatus();
  const { data: designers = [] } = useActiveDesigners();
  const { data: capacityRaw } = useSetting<string>('production_capacity_max');
  const { data: staleRaw } = useSetting<string>('production_stale_days');

  const capacityMax = Number(capacityRaw) > 0 ? Number(capacityRaw) : 5;
  const staleDays = Number(staleRaw) > 0 ? Number(staleRaw) : 7;

  // Filtros (draft en el sheet → aplicados al confirmar)
  const [workTypeFilter, setWorkTypeFilter] = useState<string>('all');
  const [designerFilter, setDesignerFilter] = useState<string>('all');
  const [draftWorkType, setDraftWorkType] = useState<string>('all');
  const [draftDesigner, setDraftDesigner] = useState<string>('all');

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null);

  const projects = board?.projects ?? [];
  const phaseSince = board?.phaseSince ?? {};
  const taskCounts = board?.taskCounts ?? {};

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (workTypeFilter !== 'all' && p.work_type !== workTypeFilter) return false;
      if (designerFilter !== 'all' && p.designer_id !== designerFilter) return false;
      // Entregado: solo los últimos 30 días
      if (p.status === 'entregado') {
        const since = phaseSince[p.id];
        if (since && isBefore(parseISO(since), subDays(new Date(), 30))) return false;
      }
      return true;
    });
  }, [projects, workTypeFilter, designerFilter, phaseSince]);

  // La ficha abierta debe reflejar datos frescos tras subir archivos/mover fase
  const liveSelected = useMemo(
    () => (selectedProject ? projects.find((p) => p.id === selectedProject.id) ?? selectedProject : null),
    [selectedProject, projects]
  );

  const metrics = useMemo<MetricData[]>(() => {
    const inProduction = projects.filter((p) => p.status === 'en_produccion').length;
    const capacityPct = capacityMax > 0 ? inProduction / capacityMax : 0;
    const stale = projects.filter((p) => {
      if (p.status === 'entregado') return false;
      const since = phaseSince[p.id];
      return since && differenceInDays(new Date(), parseISO(since)) > staleDays;
    }).length;
    const upcomingInstalls = projects.filter((p) => {
      if (!p.scheduled_install_date) return false;
      const d = parseISO(p.scheduled_install_date);
      return !isBefore(d, new Date()) && isBefore(d, addDays(new Date(), 7));
    }).length;

    return [
      {
        title: 'En producción',
        value: inProduction,
        description: 'Proyectos en planta',
        icon: Hammer,
        color: 'primary',
      },
      {
        title: 'Capacidad',
        value: `${inProduction}/${capacityMax}`,
        description: capacityPct >= 1 ? 'Planta saturada' : capacityPct >= 0.8 ? 'Cerca del límite' : 'Capacidad disponible',
        icon: Gauge,
        color: capacityPct >= 1 ? 'red' : capacityPct >= 0.8 ? 'yellow' : 'green',
      },
      {
        title: 'Estancados',
        value: stale,
        description: `> ${staleDays} días sin cambio de fase`,
        icon: TimerOff,
        color: stale > 0 ? 'red' : 'green',
      },
      {
        title: 'Instalaciones',
        value: upcomingInstalls,
        description: 'Próximos 7 días',
        icon: CalendarClock,
        color: 'blue',
      },
    ];
  }, [projects, phaseSince, capacityMax, staleDays]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const project = projects.find((p) => p.id === draggableId);
    if (!project) return;
    const toStatus = destination.droppableId as ProductionStatus;

    if (!canMove(role, project.status, toStatus)) {
      toast.error('Tu rol no permite este movimiento de fase.');
      return;
    }
    // Confirmación obligatoria: los triggers de prod sobre projects.status
    // encolan WhatsApp al cliente en varias transiciones.
    setPendingMove({ project, toStatus });
  };

  const handleConfirmMove = async (note: string) => {
    if (!pendingMove) return;
    try {
      await moveStatus.mutateAsync({
        projectId: pendingMove.project.id,
        toStatus: pendingMove.toStatus,
        note,
      });
      toast.success('Fase actualizada.');
      setPendingMove(null);
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo mover el proyecto.');
    }
  };

  const toPhaseLabel = pendingMove
    ? PRODUCTION_COLUMNS.find((c) => c.id === pendingMove.toStatus)?.title ?? pendingMove.toStatus
    : '';

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <CategoryHeader
        title="Producción"
        subtitle="Tablero de planta"
        icon={Factory}
        hideBack
      />

      <MetricsGrid metrics={metrics} />

      <div className="flex justify-end mb-4">
        <FilterSheet
          title="Filtros de planta"
          description="Filtra el tablero por tipo de mueble o diseñador."
          onApply={() => {
            setWorkTypeFilter(draftWorkType);
            setDesignerFilter(draftDesigner);
          }}
          onClear={() => {
            setDraftWorkType('all');
            setDraftDesigner('all');
            setWorkTypeFilter('all');
            setDesignerFilter('all');
          }}
        >
          <FilterSection title="Tipo de mueble">
            <FilterOption label="Todos" value="all" selected={draftWorkType === 'all'} onClick={() => setDraftWorkType('all')} />
            {Object.entries(WORK_TYPE_LABELS).map(([value, label]) => (
              <FilterOption
                key={value}
                label={label}
                value={value}
                selected={draftWorkType === value}
                onClick={() => setDraftWorkType(value)}
              />
            ))}
          </FilterSection>
          <FilterSection title="Diseñador">
            <FilterOption label="Todos" value="all" selected={draftDesigner === 'all'} onClick={() => setDraftDesigner('all')} />
            {designers.map((d) => (
              <FilterOption
                key={d.id}
                label={d.full_name}
                value={d.id}
                selected={draftDesigner === d.id}
                onClick={() => setDraftDesigner(d.id)}
              />
            ))}
          </FilterSection>
        </FilterSheet>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <PremiumLoader size="md" text="Cargando tablero de planta" />
        </div>
      ) : isError ? (
        <EmptyState
          title="No pudimos cargar el tablero"
          description="Reintenta en unos segundos o revisa tu conexión."
          icon={Factory}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title="Sin proyectos en planta"
          description="Cuando un proyecto entre a una fase productiva aparecerá en este tablero."
          icon={Factory}
        />
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {PRODUCTION_COLUMNS.map((col) => (
              <ProductionKanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                projects={filteredProjects.filter((p) => p.status === col.id)}
                phaseSince={phaseSince}
                taskCounts={taskCounts}
                staleDays={staleDays}
                collapsible={col.id === 'entregado'}
                canDrag={(p) =>
                  role === 'admin' || role === 'super_admin'
                    ? true
                    : role === 'diseno'
                      ? p.status === 'en_diseno'
                      : role === 'produccion'
                        ? p.status === 'en_produccion'
                        : false
                }
                onCardClick={setSelectedProject}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      <MoveConfirmDialog
        isOpen={!!pendingMove}
        onClose={() => setPendingMove(null)}
        onConfirm={handleConfirmMove}
        isLoading={moveStatus.isPending}
        projectName={pendingMove?.project.name ?? ''}
        toPhaseLabel={toPhaseLabel}
        triggersWhatsApp={!!pendingMove && WA_TRIGGER_STATUSES.includes(pendingMove.toStatus)}
      />

      <WorkshopSheet
        project={liveSelected}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
