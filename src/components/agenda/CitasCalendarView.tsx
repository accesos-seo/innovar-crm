import { useState } from 'react';
import { format, addDays, getDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CitasCalendarViewProps {
  startDate: Date;
  appointments: Task[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSlotClick: (date: Date, time: string) => void;
  onAppointmentClick: (appointment: Task) => void;
  isLoading: boolean;
}

const HOURS = ['08:30', '10:00', '14:00', '15:30'];

export function CitasCalendarView({
  startDate,
  appointments,
  onPrevWeek,
  onNextWeek,
  onSlotClick,
  onAppointmentClick,
  isLoading
}: CitasCalendarViewProps) {
  
  // Create an array of 7 days starting from startDate
  const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const endDate = days[6];

  // Helper to format hour "14:00" string to display
  const displayHour = (hStr: string) => {
    const [h, m] = hStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return format(d, 'h:mm a');
  };

  return (
    <div className="bg-card border border-border/50 rounded-lg flex flex-col h-[600px] overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onPrevWeek} className="w-8 h-8 rounded-sm bg-card border-border/50 hover:bg-muted/50">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold text-foreground capitalize">
            {format(startDate, "d MMM", { locale: es })} - {format(endDate, "d MMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={onNextWeek} className="w-8 h-8 rounded-sm bg-card border-border/50 hover:bg-muted/50">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 w-full relative">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-8 divide-x divide-border/20 border-b border-border/20 sticky top-0 bg-card z-10 w-full h-[60px]">
            <div className="flex items-center justify-center bg-muted/10 h-full">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Hora</span>
            </div>
            {days.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div key={i} className={`flex flex-col items-center justify-center h-full ${isToday ? 'bg-primary/5' : ''}`}>
                  <span className={`text-xs font-bold uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className={`text-xl font-heading ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid Body */}
          <div className="relative w-full">
             {HOURS.map((hour, hIndex) => (
                <div key={hour} className="grid grid-cols-8 divide-x divide-border/20 border-b border-border/20 w-full min-h-[100px]">
                  
                  {/* Row Time Label */}
                  <div className="flex flex-col items-center justify-center bg-muted/10">
                    <span className="text-xs font-bold text-muted-foreground mt-2">{displayHour(hour)}</span>
                  </div>

                  {/* Day Columns */}
                  {days.map((day, dIndex) => {
                    const isTuesdayOrThursday = day.getDay() === 2 || day.getDay() === 4;
                    
                    // Find appointment for this day and time
                    const appointment = appointments.find(app => {
                      if (!app.due_date || !app.time_slot) return false;
                      const [yy, mm, dd] = app.due_date.split('-');
                      const appDate = new Date(Number(yy), Number(mm)-1, Number(dd));
                      return isSameDay(appDate, day) && app.time_slot.startsWith(hour);
                    });

                    return (
                      <div 
                        key={dIndex} 
                        className={`p-1.5 relative flex flex-col justify-start transition-all duration-200
                          ${!appointment && isTuesdayOrThursday ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer group' : ''}
                          ${!isTuesdayOrThursday && !appointment ? 'bg-background/50 cursor-not-allowed opacity-60 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.02)_8px,rgba(255,255,255,0.02)_16px)]' : ''}
                        `}
                        onClick={() => {
                          if (!appointment && isTuesdayOrThursday) {
                            onSlotClick(day, hour);
                          }
                        }}
                      >
                         {appointment ? (
                            <div 
                               onClick={(e) => { e.stopPropagation(); onAppointmentClick(appointment); }}
                               className={`
                                  w-full h-full min-h-[80px] rounded-sm p-3 relative cursor-pointer overflow-hidden
                                  flex flex-col border transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl
                                  ${appointment.status === 'completado' 
                                      ? 'bg-muted/30 border-muted border-l-4 border-l-muted-foreground text-muted-foreground opacity-70 hover:shadow-muted/20 hover:border-muted-foreground/30'
                                      : 'bg-primary/20 border-primary/30 border-l-4 border-l-primary text-primary-foreground hover:bg-primary/30 hover:shadow-primary/30 hover:border-primary/50'
                                  }
                               `}
                            >
                               <span className={`text-[10px] uppercase font-black tracking-widest ${appointment.status === 'completado' ? 'text-muted-foreground' : 'text-primary'}`}>
                                 {appointment.appointment_type === 'visita_tecnica' ? 'Visita' : 'Diseño'}
                               </span>
                               <span className={`font-semibold text-sm leading-tight mt-1 mb-2 ${appointment.status === 'completado' ? 'text-muted-foreground' : 'text-foreground'}`}>
                                 {appointment.clients?.name || 'Cliente desconocido'}
                               </span>
                               <div className="mt-auto flex items-center justify-between">
                                  <span className="text-[10px] opacity-70 truncate max-w-[80%]">
                                    {appointment.profiles?.full_name?.split(' ')[0]}
                                  </span>
                               </div>
                            </div>
                         ) : (
                            <div className={`w-full h-full flex flex-col items-center justify-center rounded-sm transition-all
                                ${isTuesdayOrThursday ? 'border border-dashed border-primary/30 group-hover:border-primary/50' : ''}
                            `}>
                                {isTuesdayOrThursday && (
                                  <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xl font-light text-primary leading-none">+</span>
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-primary mt-1">Agendar</span>
                                  </div>
                                )}
                            </div>
                         )}
                      </div>
                    )
                  })}

                </div>
             ))}
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
