import * as React from "react";
import { Task } from "@/types/database";
import { format, isPast, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { formatSentenceCase } from "@/lib/format-utils";
import { DateDisplay } from "@/components/shared/DateDisplay";
import { cn } from "@/lib/utils";

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  selectedTasks: string[];
  toggleTaskSelection: (taskId: string) => void;
  toggleAll: () => void;
}

const statusMap: Record<string, { label: string; variant: "success" | "info" | "warning" | "error" | "purple" | "primary" }> = {
  pendiente: { label: "Pendiente", variant: "warning" },
  en_progreso: { label: "En progreso", variant: "info" },
  en_revision: { label: "En revisión", variant: "purple" },
  bloqueado: { label: "Bloqueado", variant: "error" },
  completado: { label: "Completado", variant: "success" },
  cancelado: { label: "Cancelado", variant: "primary" },
};

export function TaskListView({ tasks, onTaskClick, selectedTasks, toggleTaskSelection, toggleAll }: TaskListViewProps) {

  const getPriorityBadge = (priority: number) => {
    switch(priority) {
      case 2: return <StatusBadge variant="error" className="py-0.5 px-2">Urgente</StatusBadge>;
      case 1: return <StatusBadge variant="warning" className="py-0.5 px-2">Alta</StatusBadge>;
      default: return <StatusBadge variant="success" className="py-0.5 px-2">Baja</StatusBadge>;
    }
  };

  const getStatusBadgeOptions = (status: string) => {
    switch(status) {
      case 'pendiente': return 'bg-muted text-muted-foreground border-muted-foreground/30';
      case 'en_progreso': return 'bg-primary/20 text-primary border-primary/30';
      case 'en_revision': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'bloqueado': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'completado': return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'cancelado': return 'bg-muted/50 text-muted-foreground border-border/50 line-through opacity-70';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="bg-card border border-border/10 rounded-sm overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-[10px] text-muted-foreground uppercase bg-muted/30 border-b border-border/10">
            <tr>
              <th className="p-4 w-10">
                <Checkbox 
                  checked={selectedTasks.length === tasks.length && tasks.length > 0} 
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todas"
                  className="border-border/50 data-[state=checked]:bg-primary"
                />
              </th>
              <th className="px-6 py-4 font-black tracking-[0.2em]">{formatSentenceCase("Tarea")}</th>
              <th className="px-6 py-4 font-black tracking-[0.2em] hidden md:table-cell">{formatSentenceCase("Estado")}</th>
              <th className="px-6 py-4 font-black tracking-[0.2em] hidden lg:table-cell">{formatSentenceCase("Categoría")}</th>
              <th className="px-6 py-4 font-black tracking-[0.2em]">{formatSentenceCase("Asignado")}</th>
              <th className="px-6 py-4 font-black tracking-[0.2em]">{formatSentenceCase("Vencimiento")}</th>
              <th className="px-6 py-4 font-black tracking-[0.2em] hidden sm:table-cell">{formatSentenceCase("Prioridad")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/5">
            {tasks.map(task => {
              const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'completado';
              const status = statusMap[task.status] || { label: task.status, variant: "primary" };
              
              return (
                <tr 
                  key={task.id} 
                  className={cn(
                    "group transition-all duration-300 hover:bg-muted/30 cursor-pointer",
                    isOverdue && "bg-destructive/5 hover:bg-destructive/10"
                  )}
                  onClick={() => onTaskClick(task)}
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedTasks.includes(task.id)} 
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                      aria-label="Seleccionar"
                      className="border-border/50 data-[state=checked]:bg-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      {task.project && (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {task.project.name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <StatusBadge variant={status.variant} dot animate={task.status === 'en_progreso' ? 'scale' : 'none'}>
                      {status.label}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      {task.task_category || '---'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={task.assigned_user?.full_name || "U"} className="w-6 h-6" />
                      <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                        {task.assigned_user?.full_name || formatSentenceCase("Sin asignar")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <DateDisplay 
                      date={task.due_date} 
                      className={cn(
                        "text-xs font-bold",
                        isOverdue ? "text-destructive" : "text-muted-foreground"
                      )} 
                    />
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    {getPriorityBadge(task.priority)}
                  </td>
                </tr>
              )
            })}
            
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No se encontraron tareas con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
