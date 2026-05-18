import React, { useState } from 'react';
import { DetailModal } from '@/components/shared/DetailModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, User, UserPlus, Clock, Tag, ExternalLink, X, ListTodo } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { useUpdateTask } from '@/hooks/tareas/useUpdateTask';
import { formatSentenceCase } from '@/lib/format-utils';

import { Task } from '@/types/database';

interface TaskDetailPanelProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  staff: any[];
  canEditStatus: boolean;
  canEditDetails: boolean;
  onDeleteClick?: (id: string) => void;
}

export function TaskDetailPanel({ task, isOpen, onClose, staff, canEditStatus, canEditDetails, onDeleteClick }: TaskDetailPanelProps) {
  const updateTask = useUpdateTask();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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
            variant="outline" 
            className="w-full h-12 border-destructive/20 text-destructive hover:bg-destructive hover:text-white rounded-none text-[10px] font-black uppercase tracking-widest transition-all" 
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

          <div className="h-px bg-border/10 w-full" />

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

          <div className="h-px bg-border/10 w-full" />

          {/* SECCIÓN 3: ADJUNTOS Y COMENTARIOS */}
          <div className="space-y-8">
            <TaskAttachments taskId={task.id} />
            <div className="h-px bg-border/10 w-full" />
            <TaskComments taskId={task.id} />
          </div>
        </div>

        {/* Sidebar de Detalles (Derecha - Pattern horizontal) */}
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
                <User className="w-3 h-3 text-primary" />
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
        </div>
      </div>
    </DetailModal>
  );
}
