import * as React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ProductionProject,
  ProductionStatus,
} from '@/hooks/produccion/useProductionBoard';
import { ProductionKanbanCard } from './ProductionKanbanCard';

interface ProductionKanbanColumnProps {
  id: ProductionStatus;
  title: string;
  projects: ProductionProject[];
  phaseSince: Record<string, string>;
  taskCounts: Record<string, { done: number; total: number }>;
  staleDays: number;
  /** Columna colapsable (Entregado arranca colapsada). */
  collapsible?: boolean;
  canDrag: (project: ProductionProject) => boolean;
  onCardClick: (project: ProductionProject) => void;
}

export function ProductionKanbanColumn({
  id,
  title,
  projects,
  phaseSince,
  taskCounts,
  staleDays,
  collapsible = false,
  canDrag,
  onCardClick,
}: ProductionKanbanColumnProps) {
  const [collapsed, setCollapsed] = React.useState(collapsible);

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] bg-background/50 border border-border/50 rounded-lg shrink-0">
      <div className="p-3 border-b border-border/50 flex justify-between items-center">
        <h3 className="font-bold text-sm tracking-widest uppercase text-foreground">
          {title} <span className="text-muted-foreground font-normal ml-1">({projects.length})</span>
        </h3>
        {collapsible && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={collapsed ? 'Expandir columna' : 'Colapsar columna'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 p-2 overflow-y-auto overflow-x-hidden',
              collapsed ? 'min-h-[40px]' : 'min-h-[150px]',
              snapshot.isDraggingOver ? 'bg-primary/5' : ''
            )}
          >
            {!collapsed &&
              projects.map((project, index) => (
                <ProductionKanbanCard
                  key={project.id}
                  project={project}
                  index={index}
                  phaseSince={phaseSince[project.id] ?? null}
                  staleDays={staleDays}
                  taskCount={taskCounts[project.id] ?? null}
                  isDragDisabled={!canDrag(project)}
                  onClick={onCardClick}
                />
              ))}
            {collapsed && projects.length > 0 && (
              <p className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-widest font-bold">
                {projects.length} proyecto{projects.length === 1 ? '' : 's'} (últimos 30 días)
              </p>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
