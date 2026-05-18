import { Task } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatSentenceCase } from '@/lib/format-utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

interface CitasListViewProps {
  appointments: Task[];
  isLoading: boolean;
  onAppointmentClick: (appointment: Task) => void;
}

export function CitasListView({ appointments, isLoading, onAppointmentClick }: CitasListViewProps) {
  if (isLoading) {
      return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando citas...</div>;
  }

  if (appointments.length === 0) {
      return (
          <div className="p-12 text-center border border-border/50 rounded-lg bg-card mt-4">
              <p className="text-muted-foreground">No hay citas en este periodo.</p>
          </div>
      );
  }

  return (
    <div className="bg-card border border-border/50 rounded-lg overflow-hidden mt-4">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="border-border/50">
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Cliente")}</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Fecha / Hora")}</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Tipo")}</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Comercial")}</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{formatSentenceCase("Estado")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((app) => (
            <TableRow 
              key={app.id} 
              className="border-border/50 hover:bg-muted/10 cursor-pointer transition-colors group"
              onClick={() => onAppointmentClick(app)}
            >
              <TableCell className="font-bold text-foreground group-hover:text-primary transition-colors">
                {app.clients?.name || '---'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {app.due_date ? format(parseISO(app.due_date), "MMM d, yyyy", { locale: es }) : '---'}
                  </span>
                  <span className="text-xs text-muted-foreground">{app.time_slot || ''}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {app.appointment_type === 'visita_tecnica' ? 'Visita Técnica' : 'Diseño'}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-tighter">
                  {app.profiles?.full_name?.split(' ')[0] || '---'}
                </span>
              </TableCell>
              <TableCell>
                 <Badge variant={app.status === 'completado' ? 'outline' : 'default'} className={cn(
                   "text-[10px] font-bold uppercase tracking-widest rounded-none px-3 py-1",
                   app.status === 'completado' ? 'text-muted-foreground border-border/50' : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20'
                 )}>
                    {app.status === 'completado' ? 'Finalizada' : formatSentenceCase(app.status)}
                 </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
