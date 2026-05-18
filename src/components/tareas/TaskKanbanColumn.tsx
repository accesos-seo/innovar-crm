import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Task } from '@/types/database';
import { TaskKanbanCard } from './TaskKanbanCard';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskKanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  canCreate: boolean;
  key?: string | number;
}

export const TaskKanbanColumn: React.FC<TaskKanbanColumnProps> = ({ id, title, tasks, onTaskClick, onAddTask, canCreate }) => {
  const isBlocked = id === 'bloqueado';
  
  return (
    <div className={`
      flex flex-col w-[300px] min-w-[300px] bg-background/50 border border-border/50 rounded-lg shrink-0
      ${isBlocked ? 'bg-destructive/10 border-destructive/20' : ''}
    `}>
      <div className="p-3 border-b border-border/50 flex justify-between items-center">
        <h3 className={`font-bold text-sm tracking-widest uppercase ${isBlocked ? 'text-destructive' : 'text-foreground'}`}>
          {title} <span className="text-muted-foreground font-normal ml-1">({tasks.length})</span>
        </h3>
      </div>
      
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 p-2 overflow-y-auto overflow-x-hidden min-h-[150px]
              ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}
            `}
          >
            {tasks.map((task, index) => (
              <TaskKanbanCard 
                key={task.id} 
                task={task} 
                index={index} 
                onClick={onTaskClick} 
              />
            ))}
            {provided.placeholder}
            
            {canCreate && (
              <Button 
                variant="ghost" 
                className="w-full mt-2 border border-dashed border-border/50 text-muted-foreground hover:bg-muted/30 text-xs font-bold uppercase tracking-widest"
                onClick={() => onAddTask(id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Tarea
              </Button>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
