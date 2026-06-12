import * as React from "react";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Calendar, Plus, Clock, CheckCircle2, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { addWeeks, subWeeks, addHours, parse } from "date-fns";

import { useAppointments } from "@/hooks/agenda/useAppointments";
import { useBookAppointment } from "@/hooks/agenda/useBookAppointment";
import { useCompleteAppointment } from "@/hooks/agenda/useCompleteAppointment";
import { useCancelAppointment } from "@/hooks/agenda/useCancelAppointment";

import { CitasCalendarView } from "@/components/agenda/CitasCalendarView";
import { CitasListView } from "@/components/agenda/CitasListView";
import { NewAppointmentModal } from "@/components/agenda/NewAppointmentModal";
import { AppointmentDetailModal } from "@/components/agenda/AppointmentDetailModal";
import { Task } from "@/types/database";

export default function AgendaPage() {
  const navigate = useNavigate();

  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<Task | null>(null);

  const { data: appointments = [], isLoading } = useAppointments(date, view);
  
  const bookMutation = useBookAppointment();
  const completeMutation = useCompleteAppointment();
  const cancelMutation = useCancelAppointment();

  const handleNextWeek = () => {
    setDate(prev => addWeeks(prev, 1));
  };

  const handlePrevWeek = () => {
    setDate(prev => subWeeks(prev, 1));
  };

  const handleSlotClick = (clickedDate: Date, timeStr: string) => {
    // timeStr e.g. "14:00"
    const parsedTime = parse(timeStr, "HH:mm", new Date());
    const finalDate = new Date(clickedDate);
    finalDate.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);
    
    setSelectedDateForNew(finalDate);
    setIsNewModalOpen(true);
  };

  const handleAppointmentClick = (app: Task) => {
    setSelectedAppointment(app);
    setIsDetailModalOpen(true);
  };

  const handleBook = async (data: {
    clientId: string;
    staffId: string;
    date: string;
    timeSlot: string;
    appointmentType: 'visita_tecnica' | 'cita_diseno';
    address?: string;
  }) => {
    await bookMutation.mutateAsync(data);
    setIsNewModalOpen(false);
  };

  const handleComplete = async (taskId: string) => {
    await completeMutation.mutateAsync(taskId);
    setIsDetailModalOpen(false);
  };

  const handleCancel = async (taskId: string) => {
    await cancelMutation.mutateAsync(taskId);
    setIsDetailModalOpen(false);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    let pending = 0;
    let today = 0;
    let completed = 0;
    
    const todayStr = new Date().toISOString().split('T')[0];

    appointments.forEach(app => {
      if (app.status === 'completado') {
        completed++;
      } else {
        pending++;
        if (app.due_date && app.due_date.startsWith(todayStr)) {
          today++;
        }
      }
    });

    return { pending, today, completed };
  }, [appointments]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto w-full space-y-8"
    >
      {/* ZONA 1 */}
      <CategoryHeader 
        title="AGENDA & TAREAS"
        subtitle="Gestión de citas de diseño, visitas técnicas y recordatorios operativos. (Martes y Jueves)"
        icon={Calendar}
        onBack={() => navigate("/")}
        action={{
          label: "Nueva Cita",
          icon: Plus,
          onClick: () => {
            setSelectedDateForNew(new Date());
            setIsNewModalOpen(true);
          }
        }}
      />

      {/* ZONA 2 - MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/50 border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/20 group border-l-4 border-l-orange-500/20 hover:border-l-orange-500">
          <CardContent className="p-6 flex items-center justify-between bg-gradient-to-r from-orange-500/5 to-transparent">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Pendientes</p>
              <p className="text-3xl font-heading font-bold text-foreground">{metrics.pending.toString().padStart(2, '0')}</p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-sm border border-orange-500/20 group-hover:bg-orange-500/20 transition-colors">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 group border-l-4 border-l-blue-500/20 hover:border-l-blue-500">
          <CardContent className="p-6 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Hoy</p>
              <p className="text-3xl font-heading font-bold text-foreground">{metrics.today.toString().padStart(2, '0')}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-sm border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/10 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 group border-l-4 border-l-primary/20 hover:border-l-primary">
          <CardContent className="p-6 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Completadas</p>
              <p className="text-3xl font-heading font-bold text-foreground">{metrics.completed.toString().padStart(2, '0')}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-sm border border-primary/20 group-hover:bg-primary/20 transition-colors">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONA 3 - CONTENT */}
      <Tabs defaultValue="calendario" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="calendario" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium flex items-center gap-2">
               <Calendar className="w-4 h-4" />
               Calendario
            </TabsTrigger>
            <TabsTrigger value="lista" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium flex items-center gap-2">
               <List className="w-4 h-4" />
               Lista
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="calendario" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
           <CitasCalendarView
             startDate={date}
             appointments={appointments}
             onPrevWeek={handlePrevWeek}
             onNextWeek={handleNextWeek}
             onSlotClick={handleSlotClick}
             onAppointmentClick={handleAppointmentClick}
             isLoading={isLoading}
           />
        </TabsContent>

        <TabsContent value="lista" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
           <CitasListView
             appointments={appointments}
             isLoading={isLoading}
             onAppointmentClick={handleAppointmentClick}
           />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewAppointmentModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onBook={handleBook}
        isBooking={bookMutation.isPending}
        preselectedDate={selectedDateForNew}
      />

      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        appointment={selectedAppointment}
        onComplete={handleComplete}
        onCancel={handleCancel}
        isCompleting={completeMutation.isPending}
        isCanceling={cancelMutation.isPending}
      />

    </motion.div>
  );
}

