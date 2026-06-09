import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, ArrowRight, Clock } from 'lucide-react';
import { useTasks } from '@/hooks/tareas/useTasks';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

function getWeekBounds(): { monday: Date; sunday: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'warning' | 'info' | 'purple' | 'error' | 'success' | 'primary' }> = {
  pendiente:   { label: 'Pendiente',   variant: 'warning' },
  en_progreso: { label: 'En progreso', variant: 'info'    },
  en_revision: { label: 'En revisión', variant: 'purple'  },
  bloqueado:   { label: 'Bloqueado',   variant: 'error'   },
  completado:  { label: 'Completado',  variant: 'success' },
  cancelado:   { label: 'Cancelado',   variant: 'primary' },
};

export function WeeklyTasksSummary() {
  const navigate = useNavigate();
  const { data: allTasks = [], isLoading } = useTasks();

  const weekTasks = React.useMemo(() => {
    const { monday, sunday } = getWeekBounds();
    return allTasks
      .filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date + 'T00:00:00');
        return d >= monday && d <= sunday;
      })
      .slice(0, 10);
  }, [allTasks]);

  const handleVerTarea = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    navigate('/tasks', { state: { taskId } });
  };

  if (isLoading || weekTasks.length === 0) return null;

  return (
    <div className="bg-card rounded-sm border border-border/10 p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-sm border border-primary/20">
            <CheckSquare className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-foreground uppercase tracking-tight">
              Tareas de Esta Semana
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">
              {weekTasks.length} tarea{weekTasks.length !== 1 ? 's' : ''} con vencimiento esta semana
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="divide-y divide-border/10">
        {weekTasks.map(task => {
          const statusCfg = STATUS_CONFIG[task.status] ?? { label: task.status, variant: 'primary' as const };
          const assignedName = (task as any).assigned_user?.full_name ?? '—';
          const dueLabel = task.due_date
            ? new Date(task.due_date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
            : null;
          const isOverdue =
            task.due_date
              ? new Date(task.due_date + 'T23:59:59') < new Date() && task.status !== 'completado'
              : false;

          return (
            <div
              key={task.id}
              className="py-4 flex items-center justify-between gap-4 group hover:bg-accent/20 -mx-4 px-4 transition-colors cursor-pointer"
              onClick={(e) => handleVerTarea(e, task.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {task.title}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {assignedName}
                  </span>
                  {dueLabel && (
                    <span className={cn(
                      'flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest',
                      isOverdue ? 'text-red-500' : 'text-muted-foreground/60'
                    )}>
                      <Clock className="w-2.5 h-2.5" />
                      {dueLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge variant={statusCfg.variant} dot>
                  {statusCfg.label}
                </StatusBadge>
                <button
                  onClick={(e) => handleVerTarea(e, task.id)}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-sm transition-all"
                >
                  Ver tarea <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
