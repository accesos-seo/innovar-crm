import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ListTodo, Activity, CheckCircle2 } from 'lucide-react';
import { Task } from '@/types/database';
import { cn } from '@/lib/utils';

interface TaskMetricsProps {
  tasks: Task[];
}

export function TaskMetrics({ tasks }: TaskMetricsProps) {
  const pending = tasks.filter(t => t.status === 'pendiente').length;
  const inProgress = tasks.filter(t => t.status === 'en_progreso' || t.status === 'en_revision').length;
  const completed = tasks.filter(t => t.status === 'completado').length;

  const cardBaseClasses = "bg-card/50 border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl rounded-sm overflow-hidden border-l-4";

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className={cn(
        cardBaseClasses,
        "border-l-yellow-500/20 hover:border-l-yellow-500 hover:shadow-yellow-500/30"
      )}>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Pendientes</p>
            <h3 className="text-3xl font-black text-foreground tracking-tight">{pending.toString().padStart(2, '0')}</h3>
          </div>
          <div className="w-12 h-12 rounded-none bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
            <ListTodo className="w-6 h-6 text-yellow-500" />
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        cardBaseClasses,
        "border-l-primary/20 hover:border-l-primary hover:shadow-primary/30"
      )}>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">En Progreso</p>
            <h3 className="text-3xl font-black text-foreground tracking-tight">{inProgress.toString().padStart(2, '0')}</h3>
          </div>
          <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center border border-primary/20">
            <Activity className="w-6 h-6 text-primary" />
          </div>
        </CardContent>
      </Card>
      
      <Card className={cn(
        cardBaseClasses,
        "border-l-green-500/20 hover:border-l-green-500 hover:shadow-green-500/30"
      )}>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">Completadas</p>
            <h3 className="text-3xl font-black text-foreground tracking-tight">{completed.toString().padStart(2, '0')}</h3>
          </div>
          <div className="w-12 h-12 rounded-none bg-green-500/10 flex items-center justify-center border border-green-500/20">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
