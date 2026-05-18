import React from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Task } from '@/types/database';
import { TaskKanbanColumn } from './TaskKanbanColumn';

interface TaskKanbanViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: string) => void;
  onReorder: (taskId: string, newStatus: string, newOrder: number) => void;
  canCreate: boolean;
}

const COLUMNS = [
  { id: 'pendiente', title: 'Pendiente' },
  { id: 'en_progreso', title: 'En Progreso' },
  { id: 'en_revision', title: 'En Revisión' },
  { id: 'bloqueado', title: 'Bloqueado' },
  { id: 'completado', title: 'Completado' },
  { id: 'cancelado', title: 'Cancelado' }
];

export function TaskKanbanView({ tasks, onTaskClick, onAddTask, onReorder, canCreate }: TaskKanbanViewProps) {
  
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    onReorder(draggableId, destination.droppableId, destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] items-start">
        {COLUMNS.map(col => (
          <TaskKanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={tasks.filter(t => t.status === col.id).sort((a, b) => (a.kanban_order || 0) - (b.kanban_order || 0))}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            canCreate={canCreate}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
