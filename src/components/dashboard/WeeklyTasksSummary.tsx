import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, ArrowRight, Clock, ChevronDown, CalendarDays, ExternalLink,
} from 'lucide-react';
import { useTasks } from '@/hooks/tareas/useTasks';
import { useWeeklyTaskSummaries } from '@/hooks/tareas/useWeeklyTaskSummaries';
import { Task } from '@/types/database';
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

function formatWeekLabel(monday: Date): string {
  return monday.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPastWeekLabel(weekOf: string): string {
  try {
    const d = new Date(weekOf + 'T12:00:00');
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return weekOf;
  }
}

function formatDueShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  } catch {
    return null;
  }
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'warning' | 'info' | 'purple' | 'error' | 'success' | 'primary' }> = {
  pendiente:   { label: 'Pendiente',   variant: 'warning' },
  en_progreso: { label: 'En progreso', variant: 'info'    },
  en_revision: { label: 'En revisión', variant: 'purple'  },
  bloqueado:   { label: 'Bloqueado',   variant: 'error'   },
  completado:  { label: 'Completado',  variant: 'success' },
  cancelado:   { label: 'Cancelado',   variant: 'primary' },
};

// ── Fila de tarea compartida ──────────────────────────────────────────────────
interface TaskRowProps {
  title: string;
  status?: string;
  dueDate?: string | null;
  isOverdue?: boolean;
  onVerTarea: (e: React.MouseEvent) => void;
  hasExternalLink?: boolean;
}

function TaskRow({ title, status, dueDate, isOverdue, onVerTarea, hasExternalLink }: TaskRowProps) {
  const statusCfg = status ? (STATUS_CONFIG[status] ?? { label: status, variant: 'primary' as const }) : null;
  const dueLabel = formatDueShort(dueDate);

  return (
    <div
      className="py-3.5 flex items-center justify-between gap-4 group hover:bg-accent/20 px-4 transition-colors cursor-pointer"
      onClick={onVerTarea}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
          {title}
        </p>
        {dueLabel && (
          <span className={cn(
            'flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mt-0.5',
            isOverdue ? 'text-red-500' : 'text-muted-foreground/60'
          )}>
            <Clock className="w-2.5 h-2.5" />
            {dueLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {statusCfg && (
          <StatusBadge variant={statusCfg.variant} dot>
            {statusCfg.label}
          </StatusBadge>
        )}
        <button
          onClick={onVerTarea}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-sm transition-all"
        >
          Ver tarea{' '}
          {hasExternalLink
            ? <ExternalLink className="w-3 h-3" />
            : <ArrowRight className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function WeeklyTasksSummary() {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<'current' | 'past' | null>('current');

  const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
  const { summaries, loading: summariesLoading, unreadCount, markAsRead } = useWeeklyTaskSummaries();

  // ── Esta semana: tareas con due_date en la semana actual ────────────────────
  const { weekTasks, monday } = React.useMemo(() => {
    const bounds = getWeekBounds();
    const filtered = allTasks
      .filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date + 'T00:00:00');
        return d >= bounds.monday && d <= bounds.sunday;
      })
      .slice(0, 30);
    return { weekTasks: filtered, monday: bounds.monday };
  }, [allTasks]);

  // Agrupar por proyecto
  const tasksByProject = React.useMemo(() => {
    const groups = new Map<string, { projectId: string | null; tasks: Task[] }>();
    for (const task of weekTasks) {
      const name = task.project?.name?.trim() || 'Sin proyecto';
      const existing = groups.get(name);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(name, { projectId: task.project?.id ?? null, tasks: [task] });
      }
    }
    return groups;
  }, [weekTasks]);

  const pendingCount = weekTasks.filter(t => t.status === 'pendiente' || t.status === 'en_progreso').length;
  const doneCount = weekTasks.filter(t => t.status === 'completado').length;

  // ── Semana pasada: del snapshot histórico ──────────────────────────────────
  // summaries[0] = semana más reciente (puede ser la actual si fue generado)
  // Filtramos: solo mostramos snapshots de semanas anteriores a esta semana
  const bounds = getWeekBounds();
  const pastSummary = summaries.find(s => {
    const weekDate = new Date(s.week_of + 'T12:00:00');
    return weekDate < bounds.monday;
  });

  const handleVerTareaLive = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    navigate('/tasks', { state: { taskId: task.id } });
  };

  const handleVerTareaHistorical = (e: React.MouseEvent, taskId: string | undefined, url: string | undefined) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (taskId) {
      navigate('/tasks', { state: { taskId } });
    }
  };

  const handleToggleSection = async (section: 'current' | 'past') => {
    setOpenSection(prev => prev === section ? null : section);
    if (section === 'past' && pastSummary && !pastSummary.is_read) {
      await markAsRead(pastSummary.id);
    }
  };

  if ((tasksLoading && allTasks.length === 0) || summariesLoading) return null;
  if (weekTasks.length === 0 && !pastSummary) return null;

  return (
    <div className="bg-card rounded-sm border border-border/10 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-8 pt-6 pb-4 border-b border-border/10">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            Resúmenes Semanales de Tareas
          </h2>
        </div>
        {unreadCount > 0 && (
          <span className="text-[10px] font-black uppercase tracking-widest bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-sm">
            {unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Esta semana ── */}
      {weekTasks.length > 0 && (
        <>
          <button
            onClick={() => handleToggleSection('current')}
            className="w-full flex items-center justify-between gap-4 px-8 py-5 hover:bg-accent/20 transition-colors text-left"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-2 bg-primary/10 rounded-sm border border-primary/20 shrink-0">
                <CalendarDays className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  Semana del {formatWeekLabel(monday)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {weekTasks.length} tarea{weekTasks.length !== 1 ? 's' : ''} esta semana
                  {pendingCount > 0 && ` · ${pendingCount} activa${pendingCount !== 1 ? 's' : ''}`}
                  {doneCount > 0 && ` · ${doneCount} completada${doneCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-sm">
                Esta semana
              </span>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                openSection === 'current' && 'rotate-180'
              )} />
            </div>
          </button>

          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            openSection === 'current' ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
          )}>
            <div className="border-t border-border/10">
              {Array.from(tasksByProject.entries()).map(([projectName, { tasks: projectTasks }]) => (
                <div key={projectName}>
                  {/* Sub-header de proyecto */}
                  <div className="px-8 pt-4 pb-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                      {projectName}
                    </span>
                  </div>
                  <div className="divide-y divide-border/10 px-4">
                    {projectTasks.map((task: Task) => {
                      const isOverdue =
                        task.due_date
                          ? new Date(task.due_date + 'T23:59:59') < new Date() && task.status !== 'completado'
                          : false;
                      return (
                        <TaskRow
                          key={task.id}
                          title={task.title}
                          status={task.status}
                          dueDate={task.due_date}
                          isOverdue={isOverdue}
                          onVerTarea={(e) => handleVerTareaLive(e, task)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="px-8 py-4 border-t border-border/10 flex justify-end">
                <button
                  onClick={() => navigate('/tasks')}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Ver todas las tareas <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Semana pasada (snapshot histórico) ── */}
      {pastSummary && (
        <>
          <button
            onClick={() => handleToggleSection('past')}
            className={cn(
              'w-full flex items-center justify-between gap-4 px-8 py-5 transition-colors text-left border-t border-border/10',
              !pastSummary.is_read
                ? 'bg-primary/5 hover:bg-primary/10'
                : 'hover:bg-accent/20'
            )}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="p-2 bg-muted/40 rounded-sm border border-border/20 shrink-0">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  Semana del {formatPastWeekLabel(pastSummary.week_of)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {pastSummary.tasks_data
                    ? `${pastSummary.tasks_data.reduce((acc, g) => acc + (g.tasks?.length ?? 0), 0)} tareas guardadas`
                    : 'Resumen guardado'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {!pastSummary.is_read && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest bg-muted/50 text-muted-foreground border border-border/30 px-3 py-1 rounded-sm">
                Semana pasada
              </span>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                openSection === 'past' && 'rotate-180'
              )} />
            </div>
          </button>

          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            openSection === 'past' ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
          )}>
            <div className="border-t border-border/10">
              {pastSummary.tasks_data && pastSummary.tasks_data.length > 0 ? (
                pastSummary.tasks_data.map((group) => (
                  <div key={group.project_name}>
                    <div className="px-8 pt-4 pb-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                        {group.project_name}
                      </span>
                    </div>
                    <div className="divide-y divide-border/10 px-4">
                      {(group.tasks || []).map((task, i) => (
                        <TaskRow
                          key={task.id || i}
                          title={task.title}
                          status={task.status}
                          dueDate={task.due_date}
                          onVerTarea={(e) => handleVerTareaHistorical(e, task.id, task.url)}
                          hasExternalLink={!!task.url}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-8 py-6">
                  <div
                    className="text-sm text-muted-foreground prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: pastSummary.summary_content || 'Sin detalle disponible.' }}
                  />
                </div>
              )}

              <div className="px-8 py-3 border-t border-border/10">
                <p className="text-[10px] text-muted-foreground/50">
                  Generado automáticamente · {new Date(pastSummary.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
