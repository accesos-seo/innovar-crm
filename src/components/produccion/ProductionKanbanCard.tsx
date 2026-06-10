import * as React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { differenceInDays, parseISO } from 'date-fns';
import { CheckSquare, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSentenceCase } from '@/lib/format-utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import {
  ProductionProject,
  WORK_TYPE_LABELS,
} from '@/hooks/produccion/useProductionBoard';

interface ProductionKanbanCardProps {
  project: ProductionProject;
  index: number;
  phaseSince: string | null;
  staleDays: number;
  taskCount: { done: number; total: number } | null;
  isDragDisabled: boolean;
  onClick: (project: ProductionProject) => void;
}

export function ProductionKanbanCard({
  project,
  index,
  phaseSince,
  staleDays,
  taskCount,
  isDragDisabled,
  onClick,
}: ProductionKanbanCardProps) {
  const daysInPhase = phaseSince
    ? Math.max(0, differenceInDays(new Date(), parseISO(phaseSince)))
    : null;
  const isStale = daysInPhase !== null && daysInPhase > staleDays;

  return (
    <Draggable draggableId={project.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(project)}
          className={cn(
            'bg-card p-4 rounded-none border border-border/10 shadow-sm cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/30 mb-3 border-l-4',
            isStale ? 'border-l-destructive' : 'border-l-primary/10',
            snapshot.isDragging ? 'shadow-lg shadow-primary/40 rotate-2' : ''
          )}
        >
          <div className="flex justify-between items-center mb-3 gap-2">
            <StatusBadge variant="info" className="py-0.5 px-2 text-[8px] font-black tracking-widest">
              {(WORK_TYPE_LABELS[project.work_type] ?? project.work_type).toUpperCase()}
            </StatusBadge>
            {daysInPhase !== null && (
              <StatusBadge
                variant={isStale ? 'error' : 'success'}
                dot
                animate={isStale ? 'pulse' : 'none'}
                className="py-0.5 px-2 text-[8px] font-black tracking-widest"
              >
                {daysInPhase}D EN FASE
              </StatusBadge>
            )}
          </div>

          <h4 className="font-bold text-sm mb-1 text-foreground line-clamp-2 leading-tight">
            {formatSentenceCase(project.name)}
          </h4>
          {project.client && (
            <p className="text-[11px] text-muted-foreground mb-3 truncate">{project.client.name}</p>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              {taskCount && taskCount.total > 0 && (
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {taskCount.done}/{taskCount.total}
                </span>
              )}
              {project.estimated_fabrication_days != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {project.estimated_fabrication_days}d
                </span>
              )}
            </div>
            {project.designer && (
              <UserAvatar name={project.designer.full_name || 'D'} className="w-5 h-5 text-[8px]" />
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
