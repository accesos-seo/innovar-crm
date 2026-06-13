import React, { useState, useEffect, useCallback } from 'react';
import { DetailModal } from '@/components/shared/DetailModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Clock, Tag, ExternalLink, X, ListTodo, Link2, Lock, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { useUpdateTask } from '@/hooks/tareas/useUpdateTask';
import { formatSentenceCase } from '@/lib/format-utils';
import { notify } from '@/components/ui/PremiumToast';
import {
  type TaskDependency,
  getBlockingTasks,
  getBlockedTasks,
  createTaskDependency,
  deleteTaskDependency,
  isDepCompleted,
} from '@/services/taskDependenciesService';

import { Task } from '@/types/database';
import { UserAvatar } from '@/components/shared/UserAvatar';

interface TaskDetailPanelProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  staff: any[];
  canEditStatus: boolean;
  canEditDetails: boolean;
  onDeleteClick?: (id: string) => void;
  allTasks?: Task[];
}

export function TaskDetailPanel({ task, isOpen, onClose, staff, canEditStatus, canEditDetails, onDeleteClick, allTasks = [] }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // ── Dependencias ────────────────────────────────────────────────────────────
  const [blockingTasks, setBlockingTasks] = useState<TaskDependency[]>([]);
  const [blockedTasks, setBlockedTasks] = useState<TaskDependency[]>([]);
  const [showAddDep, setShowAddDep] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [depRelation, setDepRelation] = useState<'blocked' | 'blocking'>('blocked');
  const [addingDep, setAddingDep] = useState(false);
  const [deletingDepId, setDeletingDepId] = useState<string | null>(null);

  const loadTaskDeps = useCallback(async (taskId: string) => {
    const [blocking, blocked] = await Promise.all([
      getBlockingTasks(taskId),
      getBlockedTasks(taskId),
    ]);
    setBlockingTasks(blocking);
    setBlockedTasks(blocked);
  }, []);

  // Cargar dependencias cuando cambia la tarea abierta
  useEffect(() => {
    if (!task?.id) {
      setBlockingTasks([]);
      setBlockedTasks([]);
      return;
    }
    loadTaskDeps(task.id);
    // Resetear UI del buscador al cambiar tarea
    setShowAddDep(false);
    setDepSearch('');
  }, [task?.id, loadTaskDeps]);

  const handleAddDep = async (relatedId: string, currentTaskId: string) => {
    if (addingDep) return; // guard contra clicks simultáneos
    setAddingDep(true);
    try {
      if (depRelation === 'blocked') {
        // Esta tarea espera a "relatedId" → relatedId bloquea a currentTaskId
        await createTaskDependency(relatedId, currentTaskId);
      } else {
        // Esta tarea bloquea a "relatedId" → currentTaskId bloquea a relatedId
        await createTaskDependency(currentTaskId, relatedId);
      }
      await loadTaskDeps(currentTaskId);
      setShowAddDep(false);
      setDepSearch('');
      notify.success('Dependencia agregada', 'La dependencia fue creada correctamente.');
    } catch (e: any) {
      notify.error('Error al agregar dependencia', e?.message ?? 'No se pudo crear la dependencia.');
    } finally {
      setAddingDep(false);
    }
  };

  const handleDeleteDep = async (depId: string, currentTaskId: string) => {
    if (deletingDepId) return;
    setDeletingDepId(depId);
    try {
      await deleteTaskDependency(depId);
      await loadTaskDeps(currentTaskId);
      notify.success('Dependencia eliminada', 'La dependencia fue eliminada.');
    } catch (e: any) {
      notify.error('Error al eliminar dependencia', e?.message ?? 'No se pudo eliminar la dependencia.');
    } finally {
      setDeletingDepId(null);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────

  if (!task) return null;

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return;
    setIsUpdatingStatus(true);
    await updateTask.mutateAsync({ id: task.id, updates: { status: newStatus } });
    setIsUpdatingStatus(false);
  };

  const getPriorityBadge = (priority: number) => {
    switch(priority) {
      case 2: return <Badge variant="destructive" className="uppercase text-[10px] h-6 flex items-center gap-1.5 px-2.5 rounded-none font-bold">🔴 Urgente</Badge>;
      case 1: return <Badge className="bg-yellow-500 hover:bg-yellow-600 uppercase text-[10px] h-6 flex items-center gap-1.5 px-2.5 rounded-none font-bold text-black">🟡 Alta</Badge>;
      default: return <Badge variant="secondary" className="uppercase text-[10px] h-6 flex items-center gap-1.5 px-2.5 rounded-none font-bold">⚪ Normal</Badge>;
    }
  };

  const statusMap: Record<string, { label: string, variant: any }> = {
    'pendiente': { label: 'Pendiente', variant: 'warning' },
    'en_progreso': { label: 'En Progreso', variant: 'info' },
    'en_revision': { label: 'En Revisión', variant: 'purple' },
    'bloqueado': { label: 'Bloqueado', variant: 'error' },
    'completado': { label: 'Completado', variant: 'success' },
    'cancelado': { label: 'Cancelado', variant: 'secondary' }
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={task.title}
      icon={ListTodo}
      subtitle={formatSentenceCase(`GESTIÓN > TAREAS > ${task.title}`)}
      status={{
        label: formatSentenceCase(statusMap[task.status]?.label || task.status),
        variant: statusMap[task.status]?.variant || "primary"
      }}
      footer={
        canEditDetails && onDeleteClick && (
          <Button
            variant="destructive"
            className="w-full h-12 rounded-none text-[10px] font-black uppercase tracking-widest transition-all border border-white/25 text-white hover:bg-destructive/30"
            onClick={() => onDeleteClick(task.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar Tarea
          </Button>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-12">
          {/* SECCIÓN 1: ESTADO Y PRIORIDAD */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Estado y Prioridad")}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-6 bg-muted/5 p-6 border border-border/10">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatSentenceCase("Estado actual")}</span>
                <Select
                  value={task.status}
                  onValueChange={handleStatusChange}
                  disabled={!canEditStatus || isUpdatingStatus}
                >
                  <SelectTrigger className="w-[200px] h-10 bg-background border-border/30 text-xs font-bold rounded-none focus:ring-primary">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_progreso">En Progreso</SelectItem>
                    <SelectItem value="en_revision">En Revisión</SelectItem>
                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{formatSentenceCase("Nivel de prioridad")}</span>
                {getPriorityBadge(task.priority)}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* SECCIÓN 2: DESCRIPCIÓN */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
              <Tag className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Descripción de la tarea")}</h3>
            </div>
            <div className="bg-muted/5 p-6 border border-border/10">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
                {task.description || formatSentenceCase("Sin descripción detallada.")}
              </p>
            </div>
          </div>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* SECCIÓN 3: ADJUNTOS Y COMENTARIOS */}
          <div className="space-y-8">
            <TaskAttachments taskId={task.id} />
            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <TaskComments taskId={task.id} />
          </div>
        </div>

        {/* Sidebar de Detalles (Derecha) */}
        <div className="space-y-8">
          <div className="space-y-6 bg-muted/5 p-6 border border-border/10">
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Categoría</p>
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                <Tag className="w-3 h-3 text-primary" />
                {formatSentenceCase(task.task_category || 'General')}
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-border/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Vencimiento</p>
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                <Clock className="w-3 h-3 text-primary" />
                {task.due_date ? format(parseISO(task.due_date), "d 'de' MMMM, yyyy", { locale: es }) : 'Sin fecha'}
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-border/10">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Asignado a</p>
              <div className="flex items-center gap-2">
                <UserAvatar name={task.assigned_user?.full_name || "Sin asignar"} image={task.assigned_user?.avatar_url ?? undefined} className="w-6 h-6" />
                <span className="text-xs font-bold text-foreground">{task.assigned_user?.full_name || 'Sin asignar'}</span>
              </div>
            </div>

            {task.project && (
              <div className="space-y-2 pt-4 border-t border-border/10">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Proyecto Relacionado</p>
                <a href={`/projects/${task.project.id}`} className="flex items-center gap-2 text-primary hover:underline group">
                  <span className="text-xs font-bold truncate">{task.project.name}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            )}

            {task.clients && (
              <div className="space-y-2 pt-4 border-t border-border/10">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Cliente</p>
                <a href={`/directory/${task.clients.id}`} className="flex items-center gap-2 text-primary hover:underline group">
                  <span className="text-xs font-bold truncate">{task.clients.name}</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>
            )}
          </div>

          {/* ── PANEL DE DEPENDENCIAS ─────────────────────────────────────── */}
          <div className="space-y-3 bg-muted/5 p-6 border border-border/10">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-1.5">
              <Link2 className="w-3 h-3" /> Dependencias
            </p>

            {/* Bloqueada por: esta tarea espera a que terminen estas */}
            {blockingTasks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Esperando a</p>
                {blockingTasks.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-sm">
                    {isDepCompleted(dep.blocker_task?.status) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    )}
                    <span className="text-xs text-foreground flex-1 truncate">
                      {dep.blocker_task?.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
                      {dep.blocker_task?.status ?? '—'}
                    </span>
                    <button
                      onClick={() => handleDeleteDep(dep.id, task.id)}
                      disabled={!!deletingDepId}
                      className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bloquea a: estas tareas esperan a que esta termine */}
            {blockedTasks.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Bloquea a</p>
                {blockedTasks.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2 px-3 py-2 bg-purple-500/5 border border-purple-500/20 rounded-sm">
                    <Link2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs text-foreground flex-1 truncate">{dep.blocked_task?.title}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
                      {dep.blocked_task?.status ?? '—'}
                    </span>
                    <button
                      onClick={() => handleDeleteDep(dep.id, task.id)}
                      disabled={!!deletingDepId}
                      className="text-muted-foreground/40 hover:text-purple-400 transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Sin dependencias */}
            {blockingTasks.length === 0 && blockedTasks.length === 0 && !showAddDep && (
              <p className="text-xs text-muted-foreground/50 py-1">Sin dependencias.</p>
            )}

            {/* Formulario para agregar */}
            {showAddDep ? (
              <div className="space-y-3 mt-2 p-3 border border-border/20 bg-muted/10">
                <div className="flex gap-2">
                  {(['blocked', 'blocking'] as const).map((rel) => (
                    <button
                      key={rel}
                      onClick={() => setDepRelation(rel)}
                      className={`flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-none border transition-colors ${
                        depRelation === rel
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border/40 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {rel === 'blocked' ? 'Esta espera a…' : 'Esta bloquea a…'}
                    </button>
                  ))}
                </div>
                <input
                  value={depSearch}
                  onChange={(e) => setDepSearch(e.target.value)}
                  placeholder="Buscar tarea por título…"
                  className="h-10 w-full rounded-none border border-border/50 bg-background/50 px-3 text-sm"
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {allTasks
                    .filter(
                      (t) =>
                        t.id !== task.id &&
                        t.title.toLowerCase().includes(depSearch.toLowerCase()) &&
                        !blockingTasks.some((d) => d.blocker_task_id === t.id) &&
                        !blockedTasks.some((d) => d.blocked_task_id === t.id)
                    )
                    .slice(0, 15)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleAddDep(t.id, task.id)}
                        disabled={addingDep}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary rounded-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="truncate">{t.title}</span>
                        <span className="ml-auto text-[10px] uppercase text-muted-foreground/60 shrink-0">{t.status}</span>
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => { setShowAddDep(false); setDepSearch(''); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddDep(true)}
                className="text-[10px] text-muted-foreground/50 hover:text-primary uppercase tracking-widest flex items-center gap-1 py-1"
              >
                <span className="text-base leading-none">+</span> Agregar dependencia
              </button>
            )}
          </div>
          {/* ── FIN PANEL DEPENDENCIAS ────────────────────────────────────── */}
        </div>
      </div>
    </DetailModal>
  );
}
