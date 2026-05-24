import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { DetailModal } from "@/components/shared/DetailModal";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Users,
  Clock,
  CheckCircle2,
  MapPin,
  Palette,
} from "lucide-react";
import { ClientSearchSelect } from "./ClientSearchSelect";
import { SlotPicker } from "./SlotPicker";
import { useActiveStaff } from "@/hooks/agenda/useActiveStaff";
import { useAvailableSlots } from "@/hooks/agenda/useAvailableSlots";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatSentenceCase, formatPersonName } from "@/lib/format-utils";
import { CalendarPopover } from "@/components/ui/calendar-popover";

export interface BookAppointmentData {
  clientId: string;
  staffId: string;
  date: string;
  timeSlot: string;
  appointmentType: 'visita_tecnica' | 'cita_diseno';
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBook: (data: BookAppointmentData) => void;
  isBooking: boolean;
  preselectedDate?: Date;
}

export function NewAppointmentModal({
  isOpen,
  onClose,
  onBook,
  isBooking,
  preselectedDate
}: NewAppointmentModalProps) {
  const [appointmentType, setAppointmentType] = useState<'visita_tecnica' | 'cita_diseno'>('visita_tecnica');
  const [clientId, setClientId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(preselectedDate || new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');

  const { data: staffList = [], isLoading: isLoadingStaff } = useActiveStaff();

  const { data: slots = [], isLoading: isLoadingSlots } = useAvailableSlots(
    staffId || undefined,
    date || new Date()
  );

  useEffect(() => {
    if (!isOpen) return;
    if (preselectedDate) {
      setDate(preselectedDate);
      const h = preselectedDate.getHours();
      const m = preselectedDate.getMinutes();
      if (h !== 0 || m !== 0) {
        setSelectedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  }, [isOpen, preselectedDate]);

  useEffect(() => {
    if (!isOpen) {
      setAppointmentType('visita_tecnica');
      setClientId('');
      setStaffId('');
      setDate(new Date());
      setSelectedTime('');
    }
  }, [isOpen]);

  const selectedSlotId = selectedTime
    ? slots.find((s) => s.start_time === selectedTime)?.slot_id ?? ''
    : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!staffId) {
      toast.error('Selecciona un comercial asignado');
      return;
    }
    if (!date) {
      toast.error('Selecciona una fecha');
      return;
    }
    if (!selectedTime) {
      toast.error('Selecciona un horario disponible');
      return;
    }

    onBook({
      clientId,
      staffId,
      date: format(date, 'yyyy-MM-dd'),
      timeSlot: selectedTime,
      appointmentType,
    });
  };

  return (
    <DetailModal
      open={isOpen}
      onOpenChange={(open: boolean) => !open && onClose()}
      title={formatSentenceCase("AGENDAR CITA")}
      icon={CalendarIcon}
      subtitle={formatSentenceCase("AGENDA > PROGRAMACIÓN")}
      footer={
        <div className="flex gap-4 w-full">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="flex-1 h-14 rounded-none border-border/30 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-muted/50 transition-all"
          >
            {formatSentenceCase("Cancelar")}
          </Button>
          <Button 
            type="submit"
            form="new-appointment-form"
            disabled={isBooking || !clientId || !staffId || !date || !selectedTime}
            className="flex-1 h-14 rounded-none bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {isBooking ? formatSentenceCase("Agendando...") : formatSentenceCase("Agendar cita")}
          </Button>
        </div>
      }
    >
      <form id="new-appointment-form" onSubmit={handleSubmit} className="space-y-10">
        {/* SECCIÓN 1: IDENTIFICACIÓN — 3 campos en fila, alturas homologadas (h-14). */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Identificación")}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {formatSentenceCase("Cliente")} <span className="text-primary">*</span>
              </label>
              <ClientSearchSelect value={clientId} onChange={setClientId} />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {formatSentenceCase("Comercial asignado")} <span className="text-primary">*</span>
              </label>
              <Select value={staffId} onValueChange={setStaffId}>
                {/* w-full anula el w-fit base del SelectTrigger (se encogía al contenido).
                    !h-12 con `!` fuerza override del data-[size=default]:h-8 que tiene
                    el componente shadcn por defecto (gana en CSS sin el bang). */}
                <SelectTrigger className="w-full !h-12 bg-background border-border/50 rounded-none focus:ring-primary font-bold">
                  <SelectValue placeholder={isLoadingStaff ? formatSentenceCase("Cargando...") : formatSentenceCase("Seleccionar comercial...")}>
                    {staffId
                      ? formatPersonName(staffList.find(opt => opt.id === staffId)?.full_name, "Usuario sin nombre")
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {formatPersonName(staff.full_name, "Usuario sin nombre")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {formatSentenceCase("Tipo de cita")} <span className="text-primary">*</span>
              </label>
              <Select value={appointmentType} onValueChange={v => setAppointmentType(v as any)}>
                <SelectTrigger className="w-full !h-12 bg-background border-border/50 rounded-none focus:ring-primary font-bold">
                  <SelectValue placeholder={formatSentenceCase("Seleccionar")}>
                    {appointmentType === 'visita_tecnica' ? (
                      <span className="flex items-center gap-2"><MapPin className="w-3 h-3 opacity-70" /> {formatSentenceCase("Técnica")}</span>
                    ) : appointmentType === 'cita_diseno' ? (
                      <span className="flex items-center gap-2"><Palette className="w-3 h-3 opacity-70" /> {formatSentenceCase("Diseño")}</span>
                    ) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  <SelectItem value="visita_tecnica">
                    <span className="flex items-center gap-2 text-xs"><MapPin className="w-3 h-3 opacity-70" /> {formatSentenceCase("Visita técnica")}</span>
                  </SelectItem>
                  <SelectItem value="cita_diseno">
                    <span className="flex items-center gap-2 text-xs"><Palette className="w-3 h-3 opacity-70" /> {formatSentenceCase("Cita diseño")}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: PROGRAMACIÓN TEMPORAL — 2 campos en fila, mismas alturas. */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-l-2 border-primary pl-4">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-black text-foreground uppercase">{formatSentenceCase("Programación Temporal")}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/5 p-8 border border-border/10">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {formatSentenceCase("Fecha disponible")} <span className="text-primary">*</span>
              </label>
              <CalendarPopover
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setSelectedTime('');
                }}
                disabled={(date) => {
                  const day = date.getDay();
                  return day !== 2 && day !== 4;
                }}
                className="bg-background border-border/50 h-12 rounded-none focus:ring-primary font-bold w-full"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {formatSentenceCase("Horario")} <span className="text-primary">*</span>
              </label>
              {staffId && date ? (
                <SlotPicker
                  slots={slots}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={(_id, _slotDate, startTime) => setSelectedTime(startTime)}
                  isLoading={isLoadingSlots}
                />
              ) : (
                <div className="p-4 border border-border/20 rounded-none text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/5 text-center h-12 flex items-center justify-center italic">
                  {formatSentenceCase("Selecciona comercial y fecha")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: INFO BANNERS — Políticas + Notificación, fila pareja. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-primary/5 border border-primary/10 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <CalendarIcon className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">{formatSentenceCase("Políticas de agenda")}</p>
            </div>
            <p className="text-xs font-bold text-foreground/80 leading-relaxed italic">
              Solo se permiten citas los días <span className="text-primary font-black uppercase">Martes y Jueves</span> según la política operativa actual.
            </p>
          </div>

          <div className="p-6 bg-muted/5 border border-border/10 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">{formatSentenceCase("Notificación automática")}</p>
            </div>
            <p className="text-xs font-bold text-foreground/60 leading-relaxed italic">
              El agendamiento notificará al <span className="text-foreground font-black">comercial</span> y al <span className="text-foreground font-black">cliente</span> vía correo electrónico.
            </p>
          </div>
        </div>
      </form>
    </DetailModal>
  );
}
