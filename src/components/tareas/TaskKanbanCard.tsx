import * as React from "react";
import { Task } from "@/types/database";
import { MessageSquare, Paperclip, Calendar, Tag } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { formatSentenceCase } from "@/lib/format-utils";
import { UserAvatar } from "../shared/UserAvatar";
import { StatusBadge } from "@/components/ui/status-badge";

interface TaskKanbanCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
  key?: string | number;
}

const priorityConfig: Record<number, { label: string; variant: "error" | "warning" | "success" }> = {
  2: { label: "URGENTE", variant: "error" },
  1: { label: "ALTA", variant: "warning" },
  0: { label: "NORMAL", variant: "success" }
};

const categoryColorMap: Record<string, "blue" | "purple" | "yellow" | "green" | "primary" | "error" | "info"> = {
  operativa: "blue",
  diseno: "purple",
  produccion: "yellow",
  administrativa: "green",
  seguimiento: "primary",
};

export const TaskKanbanCard: React.FC<TaskKanbanCardProps> = ({ task, index, onClick }) => {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date)) && task.status !== 'completado';
  
  const priority = priorityConfig[task.priority] || priorityConfig[0];
  
  const priorityColor = 
    task.priority === 2 ? 'border-l-destructive' :
    task.priority === 1 ? 'border-l-yellow-500' :
    'border-l-primary/10';

  const opacityClass = task.status === 'completado' ? 'opacity-60' : 'opacity-100';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            "bg-card p-4 rounded-none border border-border/10 shadow-sm cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/30 mb-3 border-l-4",
            priorityColor,
            opacityClass,
            snapshot.isDragging ? 'shadow-lg shadow-primary/40 rotate-2' : ''
          )}
        >
          <div className="flex justify-between items-center mb-3">
            <StatusBadge 
              variant={priority.variant} 
              dot 
              animate={task.priority === 2 ? 'pulse' : 'none'}
              className="py-0.5 px-2 text-[8px] font-black tracking-widest"
            >
              {priority.label}
            </StatusBadge>
            
            {task.task_category && (
              <StatusBadge 
                variant={categoryColorMap[task.task_category] as any || "primary"}
                className="py-0.5 px-2 text-[8px] font-black tracking-widest"
              >
                {task.task_category.toUpperCase()}
              </StatusBadge>
            )}
          </div>
          
          <h4 className="font-bold text-sm mb-4 text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
            {formatSentenceCase(task.title)}
          </h4>

          {task.assigned_user && (
            <div className="flex items-center gap-2 mb-3 bg-muted/20 p-2 border border-border/10">
              <UserAvatar name={task.assigned_user.full_name || "U"} image={task.assigned_user.avatar_url ?? undefined} className="w-5 h-5 text-[8px]" />
              <span className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-wider">
                {task.assigned_user.full_name}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1 mb-3">
            {task.due_date && (
              <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span>Vence: {format(parseISO(task.due_date), "d MMM", { locale: es })}</span>
                {isOverdue && <span className="uppercase text-[9px] bg-destructive/10 px-1 rounded ml-1">Vencida</span>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex gap-3 text-muted-foreground text-xs">
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{task.comments?.[0]?.count || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" />
                <span>{task.attachments?.[0]?.count || 0}</span>
              </div>
            </div>
            
            {task.tags && task.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase">{task.tags[0]} {task.tags.length > 1 && '+'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
