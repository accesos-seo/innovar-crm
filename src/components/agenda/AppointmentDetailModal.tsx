import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Task } from "@/types/database";
import { User, MapPin, Phone, Calendar as CalendarIcon, Tag, AlertCircle } from "lucide-react";
import { VisitOwnerPicker } from "./VisitOwnerPicker";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Task | null;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  isCompleting: boolean;
  isCanceling: boolean;
}

export function AppointmentDetailModal({
  isOpen,
  onClose,
  appointment,
  onComplete,
  onCancel,
  isCompleting,
  isCanceling
}: AppointmentDetailModalProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!appointment) return null;

  const client = appointment.clients;
  const isCompleted = appointment.status === 'completado';
  const typeLabel = appointment.appointment_type === 'visita_tecnica' ? 'Visita Técnica' : 'Cita de Diseño';

  const getDisplayTime = (time: string | undefined) => {
    if (!time) return "N/A";
    const [h, m] = time.split(':').map(Number);
    const ds = new Date();
    ds.setHours(h, m, 0, 0);
    const e = new Date(ds);
    e.setMinutes(e.getMinutes() + 90);
    return `${format(ds, "h:mm a")} - ${format(e, "h:mm a")}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border p-0 overflow-hidden" showCloseButton={false}>
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-heading font-bold text-foreground flex items-center justify-between uppercase">
              <span>Detalle de cita</span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                {typeLabel}
              </h3>
              <div className="space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm font-medium text-foreground">{client?.name || "Cliente Desconocido"}</span>
                </div>
                {client?.whatsapp_phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">{client.whatsapp_phone}</span>
                  </div>
                )}
                {client?.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-muted-foreground">{client.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-muted/30 p-4 rounded-md border border-border/50">
              <div className="flex items-start gap-3">
                <CalendarIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {appointment.due_date ? format(parseISO(appointment.due_date), "eeee d 'de' MMMM yyyy", { locale: es }) : "N/A"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Hora: {getDisplayTime(appointment.time_slot)}
                  </span>
                </div>
              </div>
              {appointment.appointment_type !== 'visita_tecnica' && (
                <div className="flex items-start gap-3 mt-3 pt-3 border-t border-border/50">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Comercial asignado</span>
                    <span className="text-sm font-medium text-foreground">{appointment.profiles?.full_name || "Sin asignar"}</span>
                  </div>
                </div>
              )}
            </div>

            {appointment.appointment_type === 'visita_tecnica' && (
              <div className="bg-muted/30 p-4 rounded-md border border-border/50">
                <VisitOwnerPicker
                  visitId={appointment.id}
                  currentVisitorId={appointment.assigned_to}
                  currentVisitorName={appointment.profiles?.full_name}
                  disabled={isCompleted}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">Estado:</span>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider
                  ${isCompleted ? 'border-primary text-primary bg-primary/10' : 'border-orange-500 text-orange-500 bg-orange-500/10'}
                `}>
                  {isCompleted ? 'Completado' : 'Pendiente'}
                </span>
              </div>
              {appointment.priority > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className={`w-4 h-4 ${appointment.priority === 2 ? 'text-destructive' : 'text-orange-500'}`} />
                  <span className="text-sm text-muted-foreground">
                    Prioridad: <span className="font-bold text-foreground">{appointment.priority === 2 ? 'Urgente (ASAP)' : 'Alta'}</span>
                  </span>
                </div>
              )}
              {appointment.projects && (
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Proyecto: <span className="font-medium text-foreground">{appointment.projects.name}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-muted/50 p-6 flex items-center gap-3 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowCancelConfirm(true)}
              disabled={isCanceling || isCompleting || isCompleted}
              className="w-full sm:w-auto border border-white/25 text-white hover:bg-destructive/30"
            >
              Cancelar cita
            </Button>

            <div className="flex items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto disabled:opacity-50 border-border text-foreground">
                  Cerrar
                </Button>
              </DialogClose>
              {!isCompleted && (
                <Button
                  type="button"
                  onClick={() => onComplete(appointment.id)}
                  disabled={isCompleting || isCanceling}
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isCompleting ? "Marcando..." : "Marcar completa"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={async () => {
          await onCancel(appointment.id);
          setShowCancelConfirm(false);
        }}
        isLoading={isCanceling}
        variant="destructive"
        title="¿Cancelar esta cita?"
        description="Se liberará el horario reservado y la cita quedará como cancelada. Esta acción no se puede deshacer."
        confirmText="Sí, cancelar"
        cancelText="Volver"
      />
    </>
  );
}
